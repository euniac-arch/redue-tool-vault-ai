/**
 * robots.txt Sitemap: lines + live sitemap.xml / sitemapindex fetch.
 *
 * Auxiliary I/O is fail-safe: timeout / `fetch failed` / TLS refusal never
 * throw and never abort the parent diagnosis. Callers always receive a
 * `{ exists: false, urls: [], error: 'timeout_or_failed' }` stand-in.
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
	/** True when a valid urlset/sitemapindex was fetched. */
	exists: boolean;
	/** Page `<loc>` hrefs when a urlset was parsed; empty on failure. */
	urls: string[];
	/** Set when the live fetch timed out or the TLS/HTTP hop failed. */
	error?: string | null;
}

export const SITEMAP_UNREACHABLE_ERROR = 'timeout_or_failed';
/** Auxiliary same-origin resource — hard-capped so HTTPS refusal cannot stall Track 1/2. */
const SITEMAP_FETCH_TIMEOUT_MS = 3_000;

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

function decodeXmlLoc(raw: string): string {
	return raw
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.trim();
}

/** Every `<loc>` href from a urlset or sitemapindex body. */
export function extractSitemapLocs(xml: string): string[] {
	const locMatches = (xml || '').match(/<loc\b[^>]*>[\s\S]*?<\/loc>/gi) || [];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const tag of locMatches) {
		const href = decodeXmlLoc(tag.replace(/<\/?loc\b[^>]*>/gi, ''));
		if (!href) continue;
		const key = href.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(href);
	}
	return out;
}

export function parseSitemapXml(xml: string): { valid: boolean; urlCount: number; isIndex: boolean } {
	try {
		const text = (xml || '').replace(/^\uFEFF/, '').trim();
		if (!text) return { valid: false, urlCount: 0, isIndex: false };

		const isIndex = /<sitemapindex[\s>]/i.test(text);
		const isUrlset = /<urlset[\s>]/i.test(text);
		if (!isIndex && !isUrlset) {
			// Some CMS emit a HTML 200 "sitemap" page — not a valid sitemap.
			return { valid: false, urlCount: 0, isIndex: false };
		}

		const locs = extractSitemapLocs(text);
		return {
			valid: locs.length > 0 || isIndex || isUrlset,
			urlCount: locs.length,
			isIndex,
		};
	} catch (err) {
		console.error('[sitemap] parseSitemapXml failed:', err);
		return { valid: false, urlCount: 0, isIndex: false };
	}
}

export type EnumeratedSitemap = {
	locs: string[];
	sitemapUrls: string[];
	isIndex: boolean;
	exists: boolean;
	urls: string[];
	error?: string | null;
};

function emptyEnumeratedSitemap(error: string | null = SITEMAP_UNREACHABLE_ERROR): EnumeratedSitemap {
	return { locs: [], sitemapUrls: [], isIndex: false, exists: false, urls: [], error };
}

async function fetchAuxSitemap(url: string, forceRefresh?: boolean): Promise<FetchedPage | null> {
	try {
		return await fetchPageResource(url, {
			timeoutMs: SITEMAP_FETCH_TIMEOUT_MS,
			forceRefresh,
			accept: 'application/xml,text/xml,text/plain;q=0.8,*/*;q=0.4',
			skipSsrf: true,
			skipProtocolUpgrade: true,
			skipUaRetry: true,
			maxChars: 800_000,
		});
	} catch (err) {
		console.error('[sitemap] auxiliary fetch failed:', url, err);
		return null;
	}
}

/**
 * Recursively collect every page `<loc>` from robots.txt Sitemap lines,
 * `/sitemap.xml`, `/sitemap_index.xml`, and nested sitemapindex children.
 */
export async function enumerateSitemapUrls(
	origin: string,
	robotsText: string,
	opts?: { forceRefresh?: boolean; maxSitemaps?: number; maxLocs?: number; timeBudgetMs?: number },
): Promise<EnumeratedSitemap> {
	try {
		const maxSitemaps = opts?.maxSitemaps ?? 4;
		const maxLocs = opts?.maxLocs ?? 400;
		const deadlineAt = Date.now() + (opts?.timeBudgetMs ?? 2_000);
		const declared = extractSitemapUrlsFromRobots(robotsText);
		const root = origin.replace(/\/+$/, '');
		const fallbacks = [`${root}/sitemap.xml`, `${root}/sitemap_index.xml`];
		const queue = [...declared, ...fallbacks.filter((u) => !declared.includes(u))];
		const fetched = new Set<string>();
		const pageLocs: string[] = [];
		const sitemapUrls: string[] = [];
		let sawIndex = false;
		let lastError: string | null = null;

		while (queue.length > 0 && fetched.size < maxSitemaps && pageLocs.length < maxLocs) {
			if (Date.now() > deadlineAt) {
				console.warn(
					`[sitemap] enumerate time budget exceeded after ${fetched.size} sitemap(s) / ${pageLocs.length} loc(s) — returning partial set.`,
				);
				break;
			}
			const batch: string[] = [];
			while (queue.length > 0 && batch.length < 4 && fetched.size + batch.length < maxSitemaps) {
				const url = queue.shift();
				if (!url) break;
				const key = url.toLowerCase();
				if (fetched.has(key)) continue;
				fetched.add(key);
				batch.push(url);
			}
			if (batch.length === 0) break;

			const settled = await Promise.allSettled(
				batch.map((url) => fetchAuxSitemap(url, opts?.forceRefresh)),
			);

			for (let i = 0; i < settled.length; i += 1) {
				const outcome = settled[i];
				const url = batch[i] as string;
				if (outcome.status === 'rejected') {
					console.error('[sitemap] enumerate candidate rejected:', url, outcome.reason);
					lastError = SITEMAP_UNREACHABLE_ERROR;
					continue;
				}
				const page = outcome.value;
				if (!page || !page.ok || !page.text) {
					if (page?.error) lastError = page.error;
					continue;
				}
				let parsed: ReturnType<typeof parseSitemapXml>;
				try {
					parsed = parseSitemapXml(page.text);
				} catch (err) {
					console.error('[sitemap] enumerate parse failed:', url, err);
					continue;
				}
				if (!parsed.valid) continue;
				sitemapUrls.push(url);
				if (parsed.isIndex) sawIndex = true;

				let locs: string[] = [];
				try {
					locs = extractSitemapLocs(page.text);
				} catch (err) {
					console.error('[sitemap] extract loc failed:', url, err);
				}
				for (const loc of locs) {
					if (parsed.isIndex) {
						if (queue.length + fetched.size < maxSitemaps) queue.push(loc);
						continue;
					}
					if (pageLocs.length >= maxLocs) break;
					pageLocs.push(loc);
				}
			}
		}

		const exists = pageLocs.length > 0 || sitemapUrls.length > 0;
		return {
			locs: pageLocs,
			sitemapUrls,
			isIndex: sawIndex,
			exists,
			urls: pageLocs,
			error: exists ? null : lastError,
		};
	} catch (err) {
		console.error('[sitemap] enumerateSitemapUrls failed:', err);
		return emptyEnumeratedSitemap();
	}
}

function evidenceFor(result: Omit<SitemapCheckResult, 'evidence'>): string {
	if (result.error) return `GET ${result.url || 'sitemap'} — ${result.error}`;
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
	let parsed = { valid: false, urlCount: 0, isIndex: false };
	let urls: string[] = [];
	try {
		parsed = page.ok ? parseSitemapXml(page.text) : parsed;
		if (page.ok && page.text && !parsed.isIndex) urls = extractSitemapLocs(page.text);
	} catch (err) {
		console.error('[sitemap] toResult parse failed:', url, err);
	}
	const ok = page.ok && parsed.valid;
	const result = {
		ok,
		status: page.status,
		url,
		urlCount: parsed.urlCount,
		isIndex: parsed.isIndex,
		fromRobots,
		exists: ok,
		urls,
		error: ok ? null : page.error || SITEMAP_UNREACHABLE_ERROR,
	};
	return { ...result, evidence: evidenceFor(result) };
}

function emptySitemapCheck(originOrUrl: string, fromRobots = false): SitemapCheckResult {
	const url = /\/sitemap/i.test(originOrUrl)
		? originOrUrl
		: `${originOrUrl.replace(/\/+$/, '')}/sitemap.xml`;
	const result = {
		ok: false,
		status: null,
		url,
		urlCount: 0,
		isIndex: false,
		fromRobots,
		exists: false,
		urls: [] as string[],
		error: SITEMAP_UNREACHABLE_ERROR,
	};
	return { ...result, evidence: evidenceFor(result) };
}

/**
 * Prefer Sitemap: URLs declared in robots.txt, then `/sitemap.xml`
 * and `/sitemap_index.xml` on the final origin.
 *
 * All candidates are fetched concurrently (`Promise.allSettled`) — previously
 * this awaited them one at a time, so a slow/unreachable host could stack up
 * to 4 * timeoutMs of sequential waiting before falling back. The first
 * *valid* result is picked in declared-priority order, independent of which
 * settles first.
 */
export async function fetchSitemapCheck(
	origin: string,
	robotsText: string,
	opts?: { forceRefresh?: boolean },
): Promise<SitemapCheckResult> {
	try {
		const declared = extractSitemapUrlsFromRobots(robotsText);
		const fallbacks = [`${origin.replace(/\/+$/, '')}/sitemap.xml`, `${origin.replace(/\/+$/, '')}/sitemap_index.xml`];
		const candidates = [...declared, ...fallbacks.filter((u) => !declared.includes(u))].slice(0, 4);

		const settled = await Promise.allSettled(
			candidates.map((url) =>
				fetchPageResource(url, {
					timeoutMs: SITEMAP_FETCH_TIMEOUT_MS,
					forceRefresh: opts?.forceRefresh,
					accept: 'application/xml,text/xml,text/plain;q=0.8,*/*;q=0.4',
					skipSsrf: true,
					skipProtocolUpgrade: true,
					skipUaRetry: true,
					maxChars: 400_000,
				})
					.then((page) => toResult(page, url, declared.includes(url)))
					.catch((err) => {
						console.error('[sitemap] candidate fetch failed:', url, err);
						return emptySitemapCheck(url, declared.includes(url));
					}),
			),
		);

		for (let i = 0; i < settled.length; i += 1) {
			const outcome = settled[i];
			if (outcome.status === 'fulfilled' && outcome.value.ok) return outcome.value;
			if (outcome.status === 'rejected') {
				console.error('[sitemap] candidate fetch failed:', candidates[i], outcome.reason);
			}
		}

		const firstFulfilled = settled.find((row) => row.status === 'fulfilled');
		if (firstFulfilled && firstFulfilled.status === 'fulfilled') return firstFulfilled.value;

		const first = candidates[0] || `${origin.replace(/\/+$/, '')}/sitemap.xml`;
		return emptySitemapCheck(first, declared.length > 0);
	} catch (err) {
		console.error('[sitemap] fetchSitemapCheck failed:', err);
		return emptySitemapCheck(origin);
	}
}
