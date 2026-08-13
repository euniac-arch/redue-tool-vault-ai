import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { reportToHistoryEntry, type AuditHistoryEntry } from '@/lib/audit-history-storage';
import { authOptions } from '@/lib/auth';
import { listAuditProjects } from '@/lib/firebase/audit-projects';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { prisma } from '@/lib/prisma';
import type { AuditReport } from '@/lib/site-auditor';

export const runtime = 'nodejs';

const HISTORY_LIMIT = 50;

/**
 * GET /api/audit/history — free-audit history (newest first).
 * When Firestore Admin is configured, `audit_projects` is the sole source of truth
 * (same store admin bulk-delete clears) so deleted projects cannot reappear via Prisma.
 * Fallback: signed-in user's Prisma AuditLead rows when Firebase is unavailable.
 */
export async function GET() {
	const session = await getServerSession(authOptions);
	const items: AuditHistoryEntry[] = [];
	const seen = new Set<string>();

	if (isFirebaseAdminConfigured()) {
		try {
			const docs = await listAuditProjects(HISTORY_LIMIT);
			for (const doc of docs) {
				const report = doc.auditPayload?.report;
				if (!report?.url || seen.has(doc.id)) continue;
				seen.add(doc.id);
				items.push(reportToHistoryEntry(doc.id, report, doc.createdAt));
			}

			items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
			return NextResponse.json({
				items: items.slice(0, HISTORY_LIMIT),
				total: Math.min(items.length, HISTORY_LIMIT),
				source: 'firestore',
			});
		} catch (err) {
			console.error('[audit/history] Firestore list failed:', err);
		}
	}

	if (session?.user?.id) {
		try {
			const leads = await prisma.auditLead.findMany({
				where: { userId: session.user.id },
				orderBy: { createdAt: 'desc' },
				take: HISTORY_LIMIT,
				select: {
					id: true,
					reportJson: true,
					createdAt: true,
				},
			});

			for (const lead of leads) {
				if (seen.has(lead.id)) continue;
				try {
					const report = JSON.parse(lead.reportJson) as AuditReport;
					seen.add(lead.id);
					items.push(reportToHistoryEntry(lead.id, report, lead.createdAt.toISOString()));
				} catch {
					// Skip corrupted rows rather than failing the whole list.
				}
			}
		} catch (err) {
			console.error('[audit/history] Prisma list failed:', err);
		}
	}

	items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

	return NextResponse.json({
		items: items.slice(0, HISTORY_LIMIT),
		total: Math.min(items.length, HISTORY_LIMIT),
		source: session?.user?.id ? 'prisma' : 'empty',
	});
}
