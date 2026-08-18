import { getAuditProjectById } from '@/lib/firebase/audit-projects';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
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

/**
 * Load a persisted diagnosis by Firestore / Prisma id.
 * Same source-of-truth order as GET /api/audit/[id].
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

	if (isFirebaseAdminConfigured()) return null;

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

	try {
		const report = JSON.parse(lead.reportJson) as AuditReport;
		return {
			id: lead.id,
			createdAt: lead.createdAt.toISOString(),
			score: lead.score,
			report: ensureExecutiveSummary(report),
			source: 'prisma',
		};
	} catch {
		return null;
	}
}
