import * as cheerio from 'cheerio';
import {
	extractContentScopedHeadings,
	parseHeadings,
	parseImages,
	parseMeta,
	splitPageTitle,
	type NavLinkItem,
} from '@/lib/audit/parser';

export type CrawledPageMeta = {
	urlPath: string;
	title: string;
	h1: string;
	description: string;
	/** Subpage image alt gaps for per-file issue targeting */
	missingAlt?: number;
	imagesTotal?: number;
	headingSkipDetected?: boolean;
	headingSkipExamples?: string[];
};

const SUBPAGE_FETCH_TIMEOUT_MS = 5_000;
const MAX_SUBPAGES = 24;
const MAX_HTML_CHARS = 1_500_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; ReduAiAuditBot/1.0; +https://redue.ai/audit)';

/** Keep in sync with dynamic-php-schema PAGING_TITLE_NOISE_RE (avoid circular import). */
const PAGING_TITLE_NOISE_RE = /(^[0-9]+페이지$|^Page\s*[0-9]+$)/i;

function isPagingNoiseTitle(value: string): boolean {
	return PAGING_TITLE_NOISE_RE.test(String(value || '').replace(/\s+/g, ' ').trim());
}

function isCodeLikeTitle(value: string): boolean {
	const s = value.trim();
	return !s || /^[a-z]?\d{1,6}$/i.test(s) || /^\d+[a-z]?$/i.test(s);
}

function normKey(value: string): string {
	return value.replace(/\s+/g, '').toLowerCase();
}

/** True when text is empty, site chrome, paging noise, or identical to the main-page title. */
function isSiteWideLabel(value: string, siteName?: string, mainTitle?: string): boolean {
	const n = normKey(value);
	if (!n) return true;
	if (isPagingNoiseTitle(value)) return true;
	const siteN = normKey(siteName || '');
	if (siteN && (n === siteN || (siteN.length >= 4 && (siteN.includes(n) || n.includes(siteN))))) {
		return true;
	}
	const mainN = normKey(mainTitle || '');
	if (mainN && n === mainN) return true;
	return false;
}

/** Prefer content-scoped H1 / page meta over site-wide chrome title. */
export function pickPageTitleH1(opts: {
	fullTitle: string;
	pageTitle: string;
	h1Texts: string[];
	siteName?: string;
	navLabel?: string;
	mainTitle?: string;
}): { title: string; h1: string } {
	const site = (opts.siteName || '').trim();
	const scopedH1 = opts.h1Texts.find((t) => {
		if (!t.trim() || isPagingNoiseTitle(t)) return false;
		return !isSiteWideLabel(t, site, opts.mainTitle);
	});

	const splitRaw = splitPageTitle(opts.fullTitle, site) || opts.pageTitle;
	const split = splitRaw && !isPagingNoiseTitle(splitRaw) ? splitRaw : '';
	const nav = (opts.navLabel || '').trim();
	const navOk = Boolean(nav && !isPagingNoiseTitle(nav));
	const splitOk = Boolean(split && !isCodeLikeTitle(split) && !isSiteWideLabel(split, site, opts.mainTitle));

	// Priority: content H1 → page-specific <title> segment → nav → leftovers
	let title = '';
	if (scopedH1) title = scopedH1;
	else if (splitOk && split) title = split;
	else if (navOk) title = nav;
	else if (split && !isSiteWideLabel(split, site, opts.mainTitle)) title = split;
	else title = site;

	const h1 = scopedH1 || title;
	return { title, h1 };
}

/**
 * Prefer the subpage's own meta description; drop values that are clearly the
 * shared homepage description copied into every template.
 */
export function pickPageDescription(opts: {
	metaDescription?: string;
	ogDescription?: string | null;
	mainDescription?: string;
	siteName?: string;
}): string {
	const candidates = [opts.metaDescription, opts.ogDescription || ''].map((v) =>
		(v || '').replace(/\s+/g, ' ').trim(),
	);
	const mainN = normKey(opts.mainDescription || '');
	const siteN = normKey(opts.siteName || '');

	for (const desc of candidates) {
		if (!desc) continue;
		const n = normKey(desc);
		if (mainN && n === mainN) continue;
		if (siteN && n === siteN) continue;
		return desc;
	}
	return '';
}

function withNocacheParam(url: string, forceRefresh: boolean): string {
	if (!forceRefresh) return url;
	try {
		const u = new URL(url);
		u.searchParams.set('_redue_nocache', String(Date.now()));
		return u.toString();
	} catch {
		const sep = url.includes('?') ? '&' : '?';
		return `${url}${sep}_redue_nocache=${Date.now()}`;
	}
}

async function fetchHtml(
	url: string,
	opts?: { forceRefresh?: boolean },
): Promise<{ ok: boolean; text: string }> {
	const forceRefresh = opts?.forceRefresh === true;
	const fetchUrl = withNocacheParam(url, forceRefresh);
	try {
		const res = await fetch(fetchUrl, {
			headers: {
				'User-Agent': USER_AGENT,
				Accept: 'text/html,application/xhtml+xml',
				...(forceRefresh
					? {
							'Cache-Control': 'no-cache, no-store, must-revalidate',
							Pragma: 'no-cache',
						}
					: {}),
			},
			cache: 'no-store',
			signal: AbortSignal.timeout(SUBPAGE_FETCH_TIMEOUT_MS),
			redirect: 'follow',
		});
		if (!res.ok) return { ok: false, text: '' };
		const text = (await res.text()).slice(0, MAX_HTML_CHARS);
		return { ok: true, text };
	} catch {
		return { ok: false, text: '' };
	}
}

function shouldCrawlHref(hrefPath: string, mainPath: string): boolean {
	const path = (hrefPath || '').split('#')[0] || '';
	if (!path || path === '/' || path === mainPath) return false;
	if (/\.(css|js|png|jpe?g|gif|svg|webp|ico|pdf|zip|woff2?)$/i.test(path.split('?')[0] || '')) return false;
	if (/\/(login|logout|register|admin|adm)\b/i.test(path)) return false;
	// Prefer HTML/PHP content pages (incl. board.php?bo_table=*)
	if (/\.php(?:\?|$)/i.test(path)) return true;
	if (/\.(html?|htm)(?:\?|$)/i.test(path)) return true;
	if (/[?&](bo_table|co_id|it_id|ca_id)=/i.test(path)) return true;
	// Numeric / short slug paths common on Korean hospital themes
	if (/\/[a-z]?\d{2,4}(?:\.php)?$/i.test(path.split('?')[0] || '')) return true;
	return false;
}

/**
 * Fetch collected subpage URLs and extract content-scoped Title / H1 / description.
 * Bound by count + timeout so the main audit stays fast.
 */
export async function crawlCollectedPageMetas(opts: {
	origin: string;
	mainUrl: string;
	collectedUrls: string[];
	siteName?: string;
	mainTitle?: string;
	mainDescription?: string;
	navItems?: NavLinkItem[];
	limit?: number;
	/** Bust CDN/proxy HTML caches on re-audit. */
	forceRefresh?: boolean;
}): Promise<CrawledPageMeta[]> {
	const limit = opts.limit ?? MAX_SUBPAGES;
	const forceRefresh = opts.forceRefresh === true;
	let mainPath = '/';
	try {
		const u = new URL(opts.mainUrl);
		mainPath = `${u.pathname}${u.search}` || '/';
	} catch {
		/* keep / */
	}

	const navByHref = new Map<string, string>();
	for (const n of opts.navItems || []) {
		if (n?.url && n?.name) navByHref.set(n.url.toLowerCase(), n.name.trim());
	}

	const candidates = [...new Set(opts.collectedUrls)]
		.filter((href) => shouldCrawlHref(href, mainPath))
		.slice(0, limit);

	const out: CrawledPageMeta[] = [];
	const concurrency = 4;

	for (let i = 0; i < candidates.length; i += concurrency) {
		const batch = candidates.slice(i, i + concurrency);
		const rows = await Promise.all(
			batch.map(async (hrefPath) => {
				const abs = new URL(hrefPath, opts.origin).toString();
				const fetched = await fetchHtml(abs, { forceRefresh });
				if (!fetched.ok || !fetched.text) {
					const navLabel = navByHref.get(hrefPath.toLowerCase());
					if (!navLabel) return null;
					return {
						urlPath: hrefPath,
						title: navLabel,
						h1: navLabel,
						description: '',
					} satisfies CrawledPageMeta;
				}
				const $ = cheerio.load(fetched.text);
				const meta = parseMeta($, opts.siteName);
				const h1Texts = extractContentScopedHeadings($);
				const images = parseImages($);
				const headings = parseHeadings($);
				const navLabel = navByHref.get(hrefPath.toLowerCase());
				const picked = pickPageTitleH1({
					fullTitle: meta.title,
					pageTitle: meta.pageTitle,
					h1Texts,
					siteName: opts.siteName,
					navLabel,
					mainTitle: opts.mainTitle,
				});
				const description = pickPageDescription({
					metaDescription: meta.metaDescription,
					ogDescription: meta.ogDescription,
					mainDescription: opts.mainDescription,
					siteName: opts.siteName,
				});
				return {
					urlPath: hrefPath,
					title: picked.title,
					h1: picked.h1,
					description,
					missingAlt: images.missingAlt,
					imagesTotal: images.total,
					headingSkipDetected: headings.hasSkip,
					headingSkipExamples: headings.skipExamples,
				} satisfies CrawledPageMeta;
			}),
		);
		for (const row of rows) {
			if (row) out.push(row);
		}
	}

	return out;
}
