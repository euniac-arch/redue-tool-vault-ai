import type { AuditHistoryEntry } from '@/lib/audit/history-entry';
import { reportToHistoryEntry } from '@/lib/audit/history-entry';
import type { LatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import { resolveProjectSiteName } from '@/lib/audit/project-site-name';
import { GUIDE_SEO_MAX_DEFAULT } from '@/lib/guide/types';

export interface GuideHistoryRow {
	id: string;
	url: string;
	brandName: string;
	timestamp: string;
	seoScore: number;
	seoMaxScore: number;
	aiTrustScore: number;
	hasReport: boolean;
	entry: AuditHistoryEntry;
}

function hostPath(raw: string): string {
	try {
		const u = new URL(raw);
		return `${u.hostname.replace(/^www\./, '').toLowerCase()}${u.pathname.replace(/\/+$/, '') || '/'}`;
	} catch {
		return (raw || '').trim().toLowerCase();
	}
}

export function formatGuideHistoryTime(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '일시 미상';
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function hostnameFallback(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./i, '') || url;
	} catch {
		return url.trim() || '알 수 없는 사이트';
	}
}

export function mergeLatestIntoHistory(
	entries: AuditHistoryEntry[],
	latest: LatestAuditPayload | null | undefined,
): AuditHistoryEntry[] {
	const safe = (Array.isArray(entries) ? entries : []).filter((row) => row && (row.url || row.report?.url));
	if (!latest?.report?.url) return safe;
	const latestKey = hostPath(latest.report.url);
	if (safe.some((row) => hostPath(row.url || row.report?.url || '') === latestKey)) {
		return safe;
	}
	try {
		return [
			reportToHistoryEntry(latest.auditId || `latest-${latest.savedAt}`, latest.report, latest.savedAt),
			...safe,
		];
	} catch {
		return [
			{
				id: latest.auditId || `latest-${latest.savedAt}`,
				url: latest.report.url,
				score: Number.isFinite(latest.score) ? latest.score : 0,
				maxScore: Number.isFinite(latest.maxScore) ? latest.maxScore : GUIDE_SEO_MAX_DEFAULT,
				status: 'warning',
				statusLabel: '진단',
				geoScore: 0,
				categories: [],
				fetchedAt: latest.savedAt,
				createdAt: latest.savedAt,
				report: latest.report,
			} as AuditHistoryEntry,
			...safe,
		];
	}
}

export function toGuideHistoryRow(entry: AuditHistoryEntry): GuideHistoryRow {
	const url = (entry?.url || entry?.report?.url || '').trim();
	let brandName = '';
	try {
		if (entry?.report?.url) brandName = resolveProjectSiteName(entry.report);
	} catch {
		brandName = '';
	}
	const seoMax =
		Number.isFinite(entry?.maxScore) && (entry.maxScore as number) > 0
			? Math.round(entry.maxScore)
			: GUIDE_SEO_MAX_DEFAULT;
	const seoScore = Number.isFinite(entry?.score) ? Math.round(entry.score) : 0;
	const aiTrustScore = Number.isFinite(entry?.geoScore) ? Math.round(entry.geoScore as number) : 0;
	return {
		id: entry?.id || `history-${url || 'unknown'}`,
		url,
		brandName: brandName || hostnameFallback(url),
		timestamp: entry?.createdAt || entry?.fetchedAt || '',
		seoScore: Math.min(seoMax, Math.max(0, seoScore)),
		seoMaxScore: seoMax,
		aiTrustScore: Math.min(100, Math.max(0, aiTrustScore)),
		hasReport: Boolean(entry?.report?.url),
		entry,
	};
}

export function filterGuideHistoryRows(rows: GuideHistoryRow[], query: string): GuideHistoryRow[] {
	const q = query.trim().toLowerCase();
	if (!q) return rows;
	return rows.filter(
		(row) => row.brandName.toLowerCase().includes(q) || row.url.toLowerCase().includes(q),
	);
}
