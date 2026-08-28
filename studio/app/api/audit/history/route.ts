import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { reportToHistoryEntry, type AuditHistoryEntry } from '@/lib/audit/history-entry';
import { authOptions } from '@/lib/auth';
import { listAuditProjects } from '@/lib/firebase/audit-projects';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { prisma } from '@/lib/prisma';
import type { AuditReport } from '@/lib/site-auditor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function noStoreJson(body: unknown, init?: { status?: number }) {
	return NextResponse.json(body, {
		status: init?.status,
		headers: {
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
		},
	});
}

const HISTORY_LIMIT = 50;

function historyUrlKey(raw: string): string {
	try {
		const u = new URL(raw);
		const host = u.hostname.replace(/^www\./, '').toLowerCase();
		const path = u.pathname.replace(/\/+$/, '') || '/';
		return `${host}${path}`;
	} catch {
		return raw.trim().toLowerCase().replace(/\/+$/, '');
	}
}

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
	let session: Awaited<ReturnType<typeof getServerSession>> = null;
	try {
		session = await getServerSession(authOptions);
	} catch (err) {
		// Never let a transient session-lookup failure (e.g. mid-restart) surface
		// as a hard 500 — the client falls back to the guest/local list otherwise.
		console.error('[audit/history] getServerSession failed:', err);
		return noStoreJson({ history: [], items: [], total: 0, source: 'empty' });
	}

	if (!session?.user?.id) {
		return noStoreJson({ history: [], items: [], total: 0, source: 'empty' });
	}

	const items: AuditHistoryEntry[] = [];
	const seen = new Set<string>();

	if (isFirebaseAdminConfigured()) {
		try {
			const docs = await listAuditProjects(200);
			for (const doc of docs) {
				if (doc.userId !== session.user.id) continue;
				if (seen.has(doc.id)) continue;
				const report = doc.auditPayload?.report;
				if (!report?.url) continue;
				seen.add(doc.id);
				items.push(reportToHistoryEntry(doc.id, report, doc.createdAt));
			}
		} catch (err) {
			console.error('[audit/history] Firestore audit_projects list failed:', err);
		}
	}

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

	const byUrl = new Map<string, AuditHistoryEntry>();
	for (const item of items) {
		const key = historyUrlKey(item.url);
		const existing = byUrl.get(key);
		if (!existing) {
			byUrl.set(key, item);
			continue;
		}
		if (new Date(item.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
			byUrl.set(key, item);
		}
	}
	const history = [...byUrl.values()]
		.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
		.slice(0, HISTORY_LIMIT);

	return noStoreJson({
		history,
		items: history,
		total: history.length,
		source: isFirebaseAdminConfigured() ? 'firestore+prisma' : 'prisma',
	});
}
