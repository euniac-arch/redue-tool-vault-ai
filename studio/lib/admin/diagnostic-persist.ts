/**
 * Persist a completed site audit into Firestore `diagnostics`.
 * Called from `POST /api/audit/scan` and `POST /api/diagnostics`.
 */
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import {
	addDiagnostic,
	findLatestDiagnosticByDomain,
	getDiagnosticById,
	updateDiagnostic,
	upsertDiagnostic,
	type DiagnosticDocInput,
} from '@/lib/firebase/diagnostics';
import type { AuditReport } from '@/lib/site-auditor';
import { buildDiagnosticFromReport, hostnameFromUrl, requestedByFromActor } from './diagnostic-from-audit';
import { formatDisplayDateTime, type DiagnosticDetail } from './diagnostic-management';

export type PersistDiagnosticInput = {
	report: AuditReport;
	requestedBy?: string | null;
	userId?: string | null;
	userType?: string | null;
	/** Existing diagnostics / audit_projects id to overwrite. */
	replaceId?: string | null;
	auditProjectId?: string | null;
	/** When true, update the latest row for the same domain instead of inserting. */
	overwrite?: boolean;
};

function toWriteInput(
	detail: DiagnosticDetail,
	opts: PersistDiagnosticInput,
): DiagnosticDocInput {
	return {
		siteName: detail.siteName,
		domain: detail.domain,
		url: detail.url || opts.report.url,
		category: detail.category,
		totalScore: detail.totalScore,
		geoScore: detail.geoScore,
		schemaScore: detail.schemaScore,
		status: detail.status,
		issues: detail.issues,
		reportData: detail.reportData || {
			url: opts.report.url,
			knowledgeGraphScore: detail.knowledgeGraphScore,
			localSovScore: detail.localSovScore,
			recommendations: detail.recommendations,
			summary: detail.summary,
			prescriptionIssued: detail.prescriptionIssued,
		},
		requestedBy: detail.requestedBy,
		userId: opts.userId ?? null,
		userType: opts.userType ?? null,
		auditProjectId: opts.auditProjectId ?? null,
	};
}

export async function persistDiagnosticFromReport(
	opts: PersistDiagnosticInput,
): Promise<DiagnosticDetail | null> {
	if (!isFirebaseAdminConfigured()) return null;

	const requestedBy = requestedByFromActor({
		email: opts.requestedBy,
		userType: opts.userType,
	});
	const preferredId = (opts.replaceId || opts.auditProjectId || '').trim() || undefined;
	const stampedAt = formatDisplayDateTime(new Date().toISOString());
	const detail = buildDiagnosticFromReport(opts.report, {
		id: preferredId,
		requestedBy,
		createdAt: stampedAt,
	});
	const payload = toWriteInput(detail, opts);

	const withId = (id: string): DiagnosticDetail => ({
		...detail,
		id,
		createdAt: stampedAt,
		reportShareUrl: `/audit/result?id=${encodeURIComponent(id)}`,
	});

	if (preferredId && opts.overwrite) {
		const existing = await getDiagnosticById(preferredId);
		if (existing) {
			await updateDiagnostic(preferredId, payload, { refreshCreatedAt: true });
			return withId(preferredId);
		}
		await upsertDiagnostic(preferredId, payload, { refreshCreatedAt: true });
		return withId(preferredId);
	}

	if (opts.overwrite) {
		const latest = await findLatestDiagnosticByDomain(hostnameFromUrl(opts.report.url));
		if (latest) {
			await updateDiagnostic(latest.id, payload, { refreshCreatedAt: true });
			return withId(latest.id);
		}
	}

	if (preferredId) {
		await upsertDiagnostic(preferredId, payload, { refreshCreatedAt: true });
		return withId(preferredId);
	}

	const created = await addDiagnostic(payload);
	return withId(created.id);
}
