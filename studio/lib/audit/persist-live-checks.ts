import 'server-only';

import { getAdminFirestore, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { AUDIT_PROJECTS_COLLECTION, stripUndefinedDeep } from '@/lib/firebase/audit-projects-types';
import { applyLiveSnapshotToReport } from '@/lib/audit/live-check-merge';
import { prisma } from '@/lib/prisma';
import type { LiveCheckPersistStatus, LiveEngineChecksSnapshot } from '@/types/live-engine-check';

export type PersistLiveChecksResult = {
	/** True only when at least one store confirmed the write. */
	ok: boolean;
	status: LiveCheckPersistStatus;
	/** Stores that were actually updated. */
	stores: Array<'firestore' | 'prisma_report' | 'prisma_lead'>;
	/** The snapshot as stored, merged with earlier grounded results. Present when saved. */
	snapshot?: LiveEngineChecksSnapshot;
};

type StoreOutcome =
	| { status: 'saved'; snapshot: LiveEngineChecksSnapshot }
	| { status: 'stale' | 'record_not_found' | 'skipped' | 'error' | 'unavailable' };

function parseReport(reportJson: string): Record<string, unknown> | null {
	try {
		const report = JSON.parse(reportJson) as unknown;
		return report && typeof report === 'object' ? (report as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

async function persistFirestore(id: string, siteUrl: string, snapshot: LiveEngineChecksSnapshot): Promise<StoreOutcome> {
	if (!isFirebaseAdminConfigured()) return { status: 'unavailable' };
	try {
		const db = getAdminFirestore();
		const ref = db.collection(AUDIT_PROJECTS_COLLECTION).doc(id);
		// The transaction makes read-compare-write atomic, so an older request cannot overwrite a newer one.
		return await db.runTransaction(async (tx): Promise<StoreOutcome> => {
			const doc = await tx.get(ref);
			const report = (doc.data() as { auditPayload?: { report?: Record<string, unknown> } } | undefined)?.auditPayload?.report;
			if (!doc.exists || !report) return { status: 'record_not_found' };
			const outcome = applyLiveSnapshotToReport(report, siteUrl, snapshot);
			if (outcome.status === 'host_mismatch') return { status: 'skipped' };
			if (outcome.status === 'stale') return { status: 'stale' };
			tx.update(ref, { 'auditPayload.report.liveEngineChecks': stripUndefinedDeep(outcome.snapshot) });
			return { status: 'saved', snapshot: outcome.snapshot };
		});
	} catch (error) {
		console.error('[live-check persist] Firestore update failed:', error instanceof Error ? error.message : error);
		return { status: 'error' };
	}
}

async function persistPrismaReport(id: string, siteUrl: string, snapshot: LiveEngineChecksSnapshot): Promise<StoreOutcome> {
	try {
		return await prisma.$transaction(async (tx): Promise<StoreOutcome> => {
			const row = await tx.auditReport.findUnique({ where: { id }, select: { reportJson: true } });
			const report = row ? parseReport(row.reportJson) : null;
			if (!row || !report) return { status: 'record_not_found' };
			const outcome = applyLiveSnapshotToReport(report, siteUrl, snapshot);
			if (outcome.status === 'host_mismatch') return { status: 'skipped' };
			if (outcome.status === 'stale') return { status: 'stale' };
			await tx.auditReport.update({ where: { id }, data: { reportJson: JSON.stringify(outcome.report) } });
			return { status: 'saved', snapshot: outcome.snapshot };
		});
	} catch (error) {
		console.error('[live-check persist] AuditReport update failed:', error instanceof Error ? error.message : error);
		return { status: 'error' };
	}
}

async function persistPrismaLead(id: string, siteUrl: string, snapshot: LiveEngineChecksSnapshot): Promise<StoreOutcome> {
	try {
		return await prisma.$transaction(async (tx): Promise<StoreOutcome> => {
			const row = await tx.auditLead.findUnique({ where: { id }, select: { reportJson: true } });
			const report = row ? parseReport(row.reportJson) : null;
			if (!row || !report) return { status: 'record_not_found' };
			const outcome = applyLiveSnapshotToReport(report, siteUrl, snapshot);
			if (outcome.status === 'host_mismatch') return { status: 'skipped' };
			if (outcome.status === 'stale') return { status: 'stale' };
			await tx.auditLead.update({ where: { id }, data: { reportJson: JSON.stringify(outcome.report) } });
			return { status: 'saved', snapshot: outcome.snapshot };
		});
	} catch (error) {
		console.error('[live-check persist] AuditLead update failed:', error instanceof Error ? error.message : error);
		return { status: 'error' };
	}
}

/**
 * Writes the latest live re-verification onto the saved audit record.
 *
 * Only the `liveEngineChecks` field changes. Scores and the rest of the report are
 * untouched. A write needs the saved site to match the checked site, and it is skipped
 * when a newer request already stored its snapshot. `ok` is true only when a store
 * confirmed the write.
 *
 * Access policy: reading, deleting, and rescanning a saved audit already require only
 * the audit id (see `app/api/audit/[id]/route.ts`), so the id is the credential here too.
 * The snapshot is built on the server, and only the checked site is client-supplied.
 */
export async function persistLiveEngineChecks(
	auditId: string,
	siteUrl: string,
	snapshot: LiveEngineChecksSnapshot,
): Promise<PersistLiveChecksResult> {
	const id = auditId.trim();
	if (!id) return { ok: false, status: 'skipped', stores: [] };

	const [firestore, report, lead] = await Promise.all([
		persistFirestore(id, siteUrl, snapshot),
		persistPrismaReport(id, siteUrl, snapshot),
		persistPrismaLead(id, siteUrl, snapshot),
	]);

	const stores: PersistLiveChecksResult['stores'] = [];
	let saved: LiveEngineChecksSnapshot | undefined;
	const named: Array<['firestore' | 'prisma_report' | 'prisma_lead', StoreOutcome]> = [
		['firestore', firestore],
		['prisma_report', report],
		['prisma_lead', lead],
	];
	for (const [name, outcome] of named) {
		if (outcome.status === 'saved') {
			stores.push(name);
			saved ??= outcome.snapshot;
		}
	}
	if (saved) return { ok: true, status: 'saved', stores, snapshot: saved };

	const statuses = named.map(([, outcome]) => outcome.status);
	const status: LiveCheckPersistStatus = statuses.includes('stale')
		? 'stale'
		: statuses.includes('error')
			? 'error'
			: statuses.includes('skipped')
				? 'skipped'
				: 'record_not_found';
	return { ok: false, status, stores };
}
