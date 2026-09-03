import type { LatestAuditPayload } from '@/lib/audit/latest-audit-payload';

export function auditResultHref(audit: LatestAuditPayload | null | undefined, siteUrl: string): string | undefined {
	if (audit?.auditId) return `/audit/result?id=${encodeURIComponent(audit.auditId)}`;
	const url = audit?.report.url || siteUrl;
	if (url) return `/audit/result?url=${encodeURIComponent(url)}`;
	return undefined;
}

export function pagesFromAudit(audit: LatestAuditPayload | null | undefined, siteUrl: string): string[] {
	const metas = audit?.report.pageMetas ?? [];
	const collected = audit?.report.collectedUrls ?? [];
	const rows = [
		...metas.map((item) => item.urlPath),
		...collected,
		audit?.report.url,
		siteUrl,
	];
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of rows) {
		const value = (raw || '').trim();
		if (!value) continue;
		const key = value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(value);
	}
	return out;
}

function tokens(text: string): string[] {
	return text
		.toLowerCase()
		.split(/[^a-z0-9가-힣.]+/)
		.filter((item) => item.length >= 2);
}

export function pagesMatchingQueries(queries: readonly string[], pages: readonly string[]): string[] {
	if (!pages.length) return [];
	const hits: string[] = [];
	const seen = new Set<string>();
	for (const page of pages) {
		const hay = page.toLowerCase();
		const matched = queries.some((query) => tokens(query).some((token) => hay.includes(token)));
		if (!matched) continue;
		if (seen.has(hay)) continue;
		seen.add(hay);
		hits.push(page);
	}
	return hits;
}

export function pageTitleFromPath(page: string): string {
	try {
		const path = page.includes('://') ? new URL(page).pathname : page;
		const file = path.split('/').filter(Boolean).pop() || path;
		return file || page;
	} catch {
		return page;
	}
}

const HOME_FILES = new Set(['index', 'index.php', 'index.html', 'home', '', '/']);

export function isHomePage(page: string): boolean {
	const title = pageTitleFromPath(page).toLowerCase();
	if (HOME_FILES.has(title)) return true;
	try {
		if (page.includes('://')) {
			return new URL(page).pathname.replace(/\/+$/, '') === '';
		}
	} catch {
		/* not a URL */
	}
	return page.replace(/\/+$/, '') === '';
}

/** Prefer a query-matched page; otherwise a named audit page (not the homepage). */
export function preferredContentPage(matched: readonly string[], pages: readonly string[]): string | undefined {
	const namedMatch = matched.find((page) => !isHomePage(page));
	if (namedMatch) return namedMatch;
	const named = pages.find((page) => !isHomePage(page));
	return named || matched[0] || pages[0];
}
