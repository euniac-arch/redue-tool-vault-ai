import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { reportToHistoryEntry, type AuditHistoryEntry } from '@/lib/audit-history-storage';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { AuditReport } from '@/lib/site-auditor';

export const runtime = 'nodejs';

/**
 * GET /api/audit/history — signed-in user's free-audit history (newest first).
 * Guests should use localStorage via the client helper instead.
 */
export async function GET() {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
	}

	const leads = await prisma.auditLead.findMany({
		where: { userId: session.user.id },
		orderBy: { createdAt: 'desc' },
		take: 50,
		select: {
			id: true,
			reportJson: true,
			createdAt: true,
		},
	});

	const items: AuditHistoryEntry[] = [];
	for (const lead of leads) {
		try {
			const report = JSON.parse(lead.reportJson) as AuditReport;
			items.push(reportToHistoryEntry(lead.id, report, lead.createdAt.toISOString()));
		} catch {
			// Skip corrupted rows rather than failing the whole list.
		}
	}

	return NextResponse.json({ items, total: items.length });
}
