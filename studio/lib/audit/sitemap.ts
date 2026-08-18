/**
 * robots.txt Sitemap: lines + live sitemap.xml / sitemapindex fetch.
 */

import { fetchPageResource, type FetchedPage } from '@/lib/audit/fetch-page';

export interface SitemapCheckResult {
	ok: boolean;
	status: number | null;
	url: string | null;
	urlCount: number;
	isIndex: boolean;
	fromRobots: boolean;
	evidence: string;
}

const SITEMAP_LINE_RE = /^sitemap\s*:\s*(\S+)/gim;

export function extractSitemapUrlsFromRobots(robotsText: string): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	const re = new RegExp(SITEMAP_LINE_RE.source, SITEMAP_LINE_RE.flags);
	let match: RegExpExecArray | null;
	while ((match = re.exec(robotsText || '')) != null) {
		const raw = (match[1] || '').trim().replace(/[>\]]+$/, '');
		if (!raw) continue;
		try {
			const href = new URL(raw).href;
			if (seen.has(href)) continue;
			seen.add(href);
			out.push(href);
		} catch {
			// skip non-absolute Sitemap: values
		}
	}
	return out;
}

export function parseSitemapXml(xml: string): { valid: boolean; urlCount: number; isIndex: boolean } {
	const text = (xml || '').replace(/^\uFEFF/, '').trim();
	if (!text) return { valid: false, urlCount: 0, isIndex: false };

	const isIndex = /<sitemapindex[\s>]/i.test(text);
	const isUrlset = /<urlset[\s>]/i.test(text);
	if (!isIndex && !isUrlset) {
		// Some CMS emit a HTML 200 "sitemap" page — not a valid sitemap.
		return { valid: false, urlCount: 0, isIndex: false };
	}

	const locMatches = text.match(/<loc\b[^>]*>[\s\S]*?<\/loc>/gi) || [];
	return {
		valid: locMatches.length > 0 || isIndex || isUrlset,
		urlCount: locMatches.length,
		isIndex,
	};
}

function evidenceFor(result: Omit<SitemapCheckResult, 'evidence'>): string {
	if (!result.url) return 'GET sitemap — unreachable';
	if (!result.ok) return `GET ${result.url} — ${result.status ?? 'unreachable'}`;
	const kind = result.isIndex ? 'sitemapindex' : 'urlset';
	const via = result.fromRobots ? 'robots.txt Sitemap' : 'origin fallback';
	return `GET ${result.url} — ${result.status ?? 200} · ${kind} · ${result.urlCount} loc (${via})`;
}

function toResult(
	page: FetchedPage,
	url: string,
	fromRobots: boolean,
): SitemapCheckResult {
	const parsed = page.ok ? parseSitemapXml(page.text) : { valid: false, urlCount: 0, isIndex: false };
	const result = {
		ok: page.ok && parsed.valid,
		status: page.status,
		url,
		urlCount: parsed.urlCount,
		isIndex: parsed.isIndex,
		fromRobots,
	};
	return { ...result, evidence: evidenceFor(result) };
}

/**
 * Prefer Sitemap: URLs declared in robots.txt, then `/sitemap.xml`
 * and `/sitemap_index.xml` on the final origin.
 */
export async function fetchSitemapCheck(
	origin: string,
	robotsText: string,
	opts?: { forceRefresh?: boolean },
): Promise<SitemapCheckResult> {
	const declared = extractSitemapUrlsFromRobots(robotsText);
	const fallbacks = [`${origin.replace(/\/+$/, '')}/sitemap.xml`, `${origin.replace(/\/+$/, '')}/sitemap_index.xml`];
	const candidates = [...declared, ...fallbacks.filter((u) => !declared.includes(u))];

	for (const url of candidates.slice(0, 4)) {
		const page = await fetchPageResource(url, {
			timeoutMs: 5000,
			forceRefresh: opts?.forceRefresh,
			accept: 'application/xml,text/xml,text/plain;q=0.8,*/*;q=0.4',
			skipSsrf: true,
			maxChars: 400_000,
		});
		const result = toResult(page, url, declared.includes(url));
		if (result.ok) return result;
	}

	const first = candidates[0] || `${origin.replace(/\/+$/, '')}/sitemap.xml`;
	return {
		ok: false,
		status: null,
		url: first,
		urlCount: 0,
		isIndex: false,
		fromRobots: declared.length > 0,
		evidence: `GET ${first} — not a valid urlset/sitemapindex`,
	};
}
