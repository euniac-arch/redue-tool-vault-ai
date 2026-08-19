import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { reportToHistoryEntry, type AuditHistoryEntry } from '@/lib/audit-history-storage';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { AuditReport } from '@/lib/site-auditor';

export const runtime = 'nodejs';

const HISTORY_LIMIT = 50;

function parseStoredReport(reportJson: string): AuditReport | null {
	try {
		const report = JSON.parse(reportJson) as AuditReport;
		return report?.url ? report : null;
	} catch {
		return null;
	}
}

/**
 * GET /api/audit/history — signed-in user's durable Prisma diagnosis history
 * (newest first). Guests receive an empty list; the client falls back to localStorage.
 */
export async function GET() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ history: [], items: [], total: 0, source: 'empty' });
	}

	const items: AuditHistoryEntry[] = [];
	const seen = new Set<string>();

	try {
		const reports = await prisma.auditReport.findMany({
			where: { userId: session.user.id },
			orderBy: { createdAt: 'desc' },
			take: HISTORY_LIMIT,
		});

		for (const row of reports) {
			if (seen.has(row.id)) continue;
			const report = parseStoredReport(row.reportJson);
			if (!report) continue;
			seen.add(row.id);
			items.push(reportToHistoryEntry(row.id, report, row.createdAt.toISOString()));
		}
	} catch (err) {
		console.error('[audit/history] Prisma AuditReport list failed:', err);
	}

	if (items.length < HISTORY_LIMIT) {
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
				const report = parseStoredReport(lead.reportJson);
				if (!report) continue;
				seen.add(lead.id);
				items.push(reportToHistoryEntry(lead.id, report, lead.createdAt.toISOString()));
			}
		} catch (err) {
			console.error('[audit/history] Prisma AuditLead list failed:', err);
		}
	}

	items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	const history = items.slice(0, HISTORY_LIMIT);

	return NextResponse.json({
		history,
		items: history,
		total: history.length,
		source: 'prisma',
	});
}
