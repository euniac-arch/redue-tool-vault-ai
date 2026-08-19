import { getAuditProjectById } from '@/lib/firebase/audit-projects';
import { prisma } from '@/lib/prisma';
import { ensureExecutiveSummary } from '@/lib/audit/executive-summary';
import type { AuditReport } from '@/lib/site-auditor';

export type SavedAuditReport = {
	id: string;
	report: AuditReport;
	createdAt?: string;
	source: 'firestore' | 'prisma';
	score?: number;
	issueCount?: number;
};

function fromJson(id: string, reportJson: string, createdAt: Date, score?: number): SavedAuditReport | null {
	try {
		const report = JSON.parse(reportJson) as AuditReport;
		if (!report?.url) return null;
		return {
			id,
			createdAt: createdAt.toISOString(),
			score,
			report: ensureExecutiveSummary(report),
			source: 'prisma',
		};
	} catch {
		return null;
	}
}

/**
 * Load a persisted diagnosis by Firestore / Prisma id.
 * Prisma AuditReport is always consulted so signed-in admin history
 * survives even when Firestore is configured but missing that row.
 */
export async function loadSavedAuditReport(id: string): Promise<SavedAuditReport | null> {
	const trimmed = id.trim();
	if (!trimmed) return null;

	const firestoreDoc = await getAuditProjectById(trimmed).catch(() => null);
	if (firestoreDoc?.auditPayload?.report) {
		return {
			id: firestoreDoc.id,
			createdAt: firestoreDoc.createdAt,
			score: firestoreDoc.score,
			issueCount: firestoreDoc.issueCount,
			report: ensureExecutiveSummary(firestoreDoc.auditPayload.report),
			source: 'firestore',
		};
	}

	const saved = await prisma.auditReport.findUnique({
		where: { id: trimmed },
		select: { id: true, reportJson: true, createdAt: true, score: true },
	});
	if (saved) {
		const parsed = fromJson(saved.id, saved.reportJson, saved.createdAt, saved.score);
		if (parsed) return parsed;
	}

	const lead = await prisma.auditLead.findUnique({
		where: { id: trimmed },
		select: {
			id: true,
			score: true,
			reportJson: true,
			createdAt: true,
		},
	});
	if (!lead) return null;

	return fromJson(lead.id, lead.reportJson, lead.createdAt, lead.score);
}
