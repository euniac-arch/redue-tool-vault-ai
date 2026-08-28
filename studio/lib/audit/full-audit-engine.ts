/**
 * Full Audit + Incremental Delta Cache — single census/parse/cache module.
 *
 * 1) Enumerate every public HTML route (sitemap, robots, GNB, CMS patterns, BFS).
 * 2) Fetch HTML only (concurrency 5–10), pinpoint-extract body, hash H1+body+image/script signature.
 * 3) Reuse unchanged pages via content_hash; deep-parse only new/changed URLs.
 *    `forceRefresh` disables reuse entirely so a manual re-diagnosis always reflects
 *    the freshly fetched DOM (e.g. an `alt=""` fix) instead of a stale cache entry.
 */

import { createHash } from 'crypto';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import {
	pickPageDescription,
	pickPageTitleH1,
	type CrawledPageMeta,
} from '@/lib/audit/crawl-page-metas';
import { extractGnbNavigationPages } from '@/lib/audit/extractors/gnb-pages';
import {
	extractMainContentText,
	resolvePageDescription,
	summarizeBodyText,
} from '@/lib/audit/extractors/page-description';
import { fetchPageResource } from '@/lib/audit/fetch-page';
import {
	clearMemoryDeltaCache,
	emptyDeltaCache,
	loadDeltaCache,
	normalizeSiteOrigin,
	saveDeltaCache,
	type DeltaCacheDocument,
	type DeltaCachePage,
} from '@/lib/audit/full-audit-cache';
import {
	extractContentScopedH2,
	extractContentScopedHeadings,
	extractInternalLinks,
	parseImages,
	parseJsonLd,
	parseMeta,
	type ImageAltIssue,
	type MissingImageRow,
	type NavLinkItem,
} from '@/lib/audit/parser';
import {
	formatPageDisplay,
	IMAGE_ALT_ISSUE_CAP,
	normalizeImageSrc,
	toMissingImageRow,
} from '@/lib/audit/extractors/heading-alt-details';
import {
	collectRenderBlockingScripts,
	type RenderBlockingScript,
} from '@/lib/audit/extractors/page-resource-trackers';
import { enumerateSitemapUrls, extractSitemapUrlsFromRobots } from '@/lib/audit/sitemap';
import { detectCmsFromHtml, isGnuboardHtml } from '@/lib/crawling/cms-from-html';

export const FULL_AUDIT_CONCURRENCY = 8;
export const FULL_AUDIT_FETCH_TIMEOUT_MS = 8_000;
export const FULL_AUDIT_MAX_PAGES = 500;
export const FULL_AUDIT_MAX_HTML_CHARS = 1_500_000;
export const FULL_AUDIT_MAX_BFS_ROUNDS = 2;
/**
 * Wall-clock ceiling on the whole BFS crawl below. Each page fetch already has its own
 * `FULL_AUDIT_FETCH_TIMEOUT_MS` cap, but with up to `FULL_AUDIT_MAX_PAGES` pages that per-page
 * cap alone does not bound total runtime — a large site could still take several minutes and
 * leave `/api/audit/scan`'s caller hanging well past its own deadline. Once this budget is
 * exceeded the crawl stops picking up new pages and returns whatever it already parsed instead
 * of continuing indefinitely; kept comfortably under the scan route's `TRACK_1_2_DEADLINE_MS`.
 */
export const FULL_AUDIT_TIME_BUDGET_MS = 45_000;

const ASSET_EXT_RE = /\.(css|js|mjs|map|png|jpe?g|gif|svg|webp|avif|ico|bmp|pdf|zip|rar|7z|mp4|mp3|woff2?|ttf|eot|otf|exe|dmg)(?:$|\?)/i;
const ACCOUNT_RE =
	/\/(login|logout|register|admin|adm|member_confirm|password_lost|member_leave|password|write|delete|download)\.php(?:\?|$)/i;
const ACCOUNT_DIR_RE = /\/(login|logout|register|admin|adm|ncp_|data\/editor)\b/i;
const BOARD_POST_RE = /[?&]wr_id=\d+/i;
const PAGING_RE = /[?&](page|sfl|stx|sod|sst|sop)=/i;
const STATIC_SUBPAGE_RE = /(?:^|\/)(?:s|sub)?\d{2,4}\.php$/i;
const CONTENTS_PHP_RE = /\/contents\/[a-z0-9_-]+\.php/i;
const THEME_PHP_RE = /\/theme\/[^/?#]+\/(?:html|contents|sub|page|tail)?\/?[a-z0-9_.-]+\.php/i;
const BOARD_TABLE_RE = /board\.php\?[^"'<\s]*bo_table=([a-z0-9_]+)/gi;
const CONTENT_ID_RE = /content\.php\?[^"'<\s]*co_id=([a-z0-9_]+)/gi;
const HREF_PHP_RE =
	/(?:href|action|src|url)\s*[=:]\s*['"]([^'"]+\.php(?:\?[^'"]*)?)['"]/gi;
const QUOTED_ROUTE_RE =
	/['"](\/(?:bbs|theme|contents|html|page|sub|shop)\/[^'"]+\.php(?:\?[^'"]*)?)['"]/gi;
const BARE_SUBPAGE_RE = /(?:^|['"(\s])((?:s|sub)?\d{2,4}\.php)(?=['")\s?]|$)/gi;

const PINPOINT_BODY_SELECTORS = [
	'#sub_content',
	'.sub_content',
	'.sub_con',
	'#sub_contents',
	'#contents',
	'#bo_v_con',
	'main',
	'article',
	'.content_area',
	'#container',
	'#content',
	'[role="main"]',
	'.sub_contents',
	'.sub-content',
	'#bo_v',
	'#bo_list',
	'.board_list',
	'.board_view',
	'#wrapper',
	'.content',
] as const;

const PINPOINT_CHROME_SELECTORS = [
	'script',
	'style',
	'noscript',
	'iframe',
	'header',
	'nav',
	'footer',
	'aside',
	'.gnb',
	'#gnb',
	'#hd',
	'.header',
	'#ft',
	'.footer',
	'#aside',
	'.lnb',
	'#lnb',
	'.hd_pops',
	'#hd_pop',
].join(', ');

export type FullAuditSource =
	| 'seed'
	| 'sitemap'
	| 'robots'
	| 'gnb'
	| 'html_link'
	| 'cms_pattern'
	| 'gnuboard_board'
	| 'gnuboard_contents'
	| 'bfs';

export type FullAuditMode = 'full' | 'incremental';

export type FullAuditProgressPhase = 'discover' | 'analyze' | 'cache' | 'done';

export type FullAuditProgress = {
	phase: FullAuditProgressPhase;
	mode: FullAuditMode;
	pagesFound: number;
	pagesParsed: number;
	currentIndex: number;
	currentUrl?: string;
	cacheHits: number;
	cacheMisses: number;
	percent: number;
	message: string;
};

export type FullAuditPageSnapshot = {
	url: string;
	urlPath: string;
	page_title: string;
	h1: string;
	h2: string[];
	summary: string;
	schema_type: string;
	content_hash: string;
	last_audited: number;
	source: FullAuditSource;
	cacheHit: boolean;
	missingAlt?: number;
	imagesTotal?: number;
	headingSkipDetected?: boolean;
	imageAltIssues?: ImageAltIssue[];
	missing_images?: MissingImageRow[];
	imageSrcs?: string[];
	renderBlockingScriptItems?: RenderBlockingScript[];
};

export type FullAuditVerification = {
	pagesFound: number;
	pagesParsed: number;
	missingUrls: string[];
	log: string;
};

export type FullAuditResult = {
	siteOrigin: string;
	mode: FullAuditMode;
	pagesFound: number;
	pagesParsed: number;
	cacheHits: number;
	cacheMisses: number;
	progressMessage: string;
	verification: FullAuditVerification;
	sources: Partial<Record<FullAuditSource, number>>;
	discoveredUrls: string[];
	pages: FullAuditPageSnapshot[];
	pageMetas: CrawledPageMeta[];
	cache: DeltaCacheDocument;
};

export type FullAuditFetchHtml = (url: string) => Promise<{ ok: boolean; text: string }>;

export type RunFullAuditOptions = {
	origin: string;
	mainUrl: string;
	homepageHtml?: string;
	robotsText?: string;
	navItems?: NavLinkItem[];
	siteName?: string;
	mainTitle?: string;
	mainDescription?: string;
	industryType?: string;
	cmsHint?: string;
	forceRefresh?: boolean;
	useDeltaCache?: boolean;
	concurrency?: number;
	maxPages?: number;
	maxBfsRounds?: number;
	/** Overrides `FULL_AUDIT_TIME_BUDGET_MS` — wall-clock ceiling on the whole BFS crawl. */
	timeBudgetMs?: number;
	lang?: 'ko' | 'en';
	onProgress?: (progress: FullAuditProgress) => void;
	fetchHtml?: FullAuditFetchHtml;
	/** Pre-enumerated sitemap `<loc>` paths (skips a live sitemap crawl when set). */
	sitemapLocs?: string[];
	/** Injected cache (tests). When omitted, memory/file/Firestore backends load. */
	cache?: DeltaCacheDocument | null;
	persistCache?: boolean;
};

export type FullAuditReportSlice = {
	mode: FullAuditMode;
	pagesFound: number;
	pagesParsed: number;
	cacheHits: number;
	cacheMisses: number;
	progressMessage: string;
	verificationLog: string;
	sources?: Partial<Record<FullAuditSource, number>>;
};

export function toFullAuditReportSlice(result: FullAuditResult): FullAuditReportSlice {
	return {
		mode: result.mode,
		pagesFound: result.pagesFound,
		pagesParsed: result.pagesParsed,
		cacheHits: result.cacheHits,
		cacheMisses: result.cacheMisses,
		progressMessage: result.progressMessage,
		verificationLog: result.verification.log,
		sources: result.sources,
	};
}

export function normalizeAuditPagePath(raw: string, origin: string): string | null {
	const href = String(raw || '').trim();
	if (!href || /^(javascript:|#|mailto:|tel:|sms:|data:)/i.test(href)) return null;
	try {
		const abs = new URL(href, origin);
		const host = new URL(origin).hostname.replace(/^www\./i, '').toLowerCase();
		if (abs.hostname.replace(/^www\./i, '').toLowerCase() !== host) return null;
		if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return null;
		abs.hash = '';
		abs.searchParams.delete('_redue_nocache');
		const path = abs.pathname || '/';
		if (ASSET_EXT_RE.test(path)) return null;
		const search = abs.search || '';
		const hrefPath = search ? `${path}${search}` : path;
		if (ACCOUNT_RE.test(hrefPath) || ACCOUNT_DIR_RE.test(hrefPath)) return null;
		return hrefPath;
	} catch {
		return null;
	}
}

export function isPublicHtmlRoute(hrefPath: string, opts?: { allowPosts?: boolean }): boolean {
	const path = (hrefPath || '').split('#')[0] || '';
	if (!path) return false;
	if (ASSET_EXT_RE.test(path.split('?')[0] || '')) return false;
	if (ACCOUNT_RE.test(path) || ACCOUNT_DIR_RE.test(path)) return false;
	if (!opts?.allowPosts && BOARD_POST_RE.test(path)) return false;
	if (PAGING_RE.test(path) && !/[?&](bo_table|co_id|it_id|ca_id)=/i.test(path)) return false;
	const file = (path.split('?')[0] || '').toLowerCase();
	if (/\.php$/i.test(file)) return true;
	if (/\.html?$/i.test(file)) return true;
	if (/[?&](bo_table|co_id|it_id|ca_id)=/i.test(path)) return true;
	if (STATIC_SUBPAGE_RE.test(file)) return true;
	if (CONTENTS_PHP_RE.test(file) || THEME_PHP_RE.test(file)) return true;
	if (file === '/' || /\/index\.(php|html?)$/i.test(file)) return true;
	if (!/\.[a-z0-9]{1,5}$/i.test(file)) return true;
	return false;
}

export function extractPublicRoutePatterns(html: string, origin: string): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	const push = (raw: string, allowPosts = false) => {
		const path = normalizeAuditPagePath(raw, origin);
		if (!path || !isPublicHtmlRoute(path, { allowPosts })) return;
		const key = path.toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);
		out.push(path);
	};

	const scan = (re: RegExp, allowPosts = false) => {
		const copy = new RegExp(re.source, re.flags);
		let match: RegExpExecArray | null;
		while ((match = copy.exec(html || '')) != null) {
			push(match[1] || match[0], allowPosts);
		}
	};

	scan(HREF_PHP_RE);
	scan(QUOTED_ROUTE_RE);
	scan(BARE_SUBPAGE_RE);

	const boards = new Set<string>();
	const boardRe = new RegExp(BOARD_TABLE_RE.source, BOARD_TABLE_RE.flags);
	let boardMatch: RegExpExecArray | null;
	while ((boardMatch = boardRe.exec(html || '')) != null) {
		const table = boardMatch[1];
		if (table) boards.add(table);
	}
	for (const table of boards) {
		push(`/bbs/board.php?bo_table=${table}`);
		push(`/board.php?bo_table=${table}`);
	}

	const contentRe = new RegExp(CONTENT_ID_RE.source, CONTENT_ID_RE.flags);
	let contentMatch: RegExpExecArray | null;
	while ((contentMatch = contentRe.exec(html || '')) != null) {
		const id = contentMatch[1];
		if (id) push(`/bbs/content.php?co_id=${id}`);
	}

	const contentsRe = /(?:['"])(\/contents\/[a-z0-9_-]+\.php)['"]/gi;
	let contentsMatch: RegExpExecArray | null;
	while ((contentsMatch = contentsRe.exec(html || '')) != null) {
		push(contentsMatch[1]);
	}

	return out;
}

export function extractGnuboardPublicRoutes(html: string, origin: string): string[] {
	if (!isGnuboardHtml(html) && !/g5\['menu_table'\]|me_link|g5_bo_table/i.test(html)) {
		return extractPublicRoutePatterns(html, origin).filter((p) =>
			/board\.php|content\.php|\/contents\/|\/theme\//i.test(p),
		);
	}
	return extractPublicRoutePatterns(html, origin);
}

function sameOriginLoc(loc: string, origin: string): string | null {
	try {
		const abs = new URL(loc, origin);
		const host = new URL(origin).hostname.replace(/^www\./i, '').toLowerCase();
		if (abs.hostname.replace(/^www\./i, '').toLowerCase() !== host) return null;
		return normalizeAuditPagePath(abs.href, origin);
	} catch {
		return normalizeAuditPagePath(loc, origin);
	}
}

export function collectDiscoveredUrls(opts: {
	origin: string;
	mainUrl: string;
	homepageHtml?: string;
	robotsText?: string;
	sitemapLocs?: string[];
	navItems?: NavLinkItem[];
}): { urls: string[]; sources: Map<string, FullAuditSource> } {
	const origin = normalizeSiteOrigin(opts.origin);
	const sources = new Map<string, FullAuditSource>();
	const urls: string[] = [];

	const add = (raw: string, source: FullAuditSource, allowPosts = false) => {
		const path = normalizeAuditPagePath(raw, origin);
		if (!path || !isPublicHtmlRoute(path, { allowPosts })) return;
		const key = path.toLowerCase();
		if (sources.has(key)) return;
		sources.set(key, source);
		urls.push(path);
	};

	add('/', 'seed');
	try {
		const main = new URL(opts.mainUrl);
		add(`${main.pathname}${main.search}` || '/', 'seed');
	} catch {
		/* keep / */
	}

	for (const item of opts.navItems || []) {
		if (item?.url) add(item.url, 'gnb');
	}

	if (opts.homepageHtml) {
		try {
			const $ = cheerio.load(opts.homepageHtml);
			for (const page of extractGnbNavigationPages($, opts.mainUrl, { limit: 400 })) {
				add(page.url, 'gnb');
			}
			for (const href of extractInternalLinks($, opts.mainUrl, 800)) {
				add(href, 'html_link');
			}
		} catch {
			/* regex fallback below */
		}
		for (const path of extractPublicRoutePatterns(opts.homepageHtml, origin)) {
			const cms = /board\.php|content\.php|\/contents\/|\/theme\//i.test(path);
			add(path, cms ? 'cms_pattern' : 'html_link');
		}
		if (isGnuboardHtml(opts.homepageHtml)) {
			for (const path of extractGnuboardPublicRoutes(opts.homepageHtml, origin)) {
				add(path, /board\.php/.test(path) ? 'gnuboard_board' : 'gnuboard_contents');
			}
		}
	}

	for (const loc of opts.sitemapLocs || []) {
		const path = sameOriginLoc(loc, origin);
		if (path) add(path, 'sitemap', true);
	}

	for (const sitemapUrl of extractSitemapUrlsFromRobots(opts.robotsText || '')) {
		const path = sameOriginLoc(sitemapUrl, origin);
		if (path && !/sitemap/i.test(path)) add(path, 'robots');
	}

	return { urls, sources };
}

export function extractPinpointBody($: CheerioAPI): string {
	for (const sel of PINPOINT_BODY_SELECTORS) {
		const root = $(sel).first();
		if (!root.length) continue;
		const clone = root.clone();
		clone.find(PINPOINT_CHROME_SELECTORS).remove();
		const text = clone
			.text()
			.replace(/[\u0000-\u001f\u007f]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
		if (text.length >= 30) return text;
	}
	return extractMainContentText($);
}

export function normalizeHashCorpus(value: string): string {
	return String(value || '')
		.replace(/[\u0000-\u001f\u007f]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
}

/**
 * `extraSignals` covers DOM defects that don't move the body-text/H1 corpus at all
 * (e.g. adding an `alt=""`, flipping a `<script>` from sync to `defer`) — without
 * folding them in, a page whose only edit was `alt` coverage would hash-match the
 * prior delta-cache entry and silently keep serving the stale missing-alt list.
 */
export function computeContentHash(h1: string, bodyText: string, extraSignals: string[] = []): string {
	const corpus = [normalizeHashCorpus(bodyText), normalizeHashCorpus(h1), ...extraSignals.map(normalizeHashCorpus)].join(
		'\n',
	);
	return createHash('sha256').update(corpus, 'utf8').digest('hex');
}

/** Compact per-image `src::issue_type` signature so alt-only edits change the content hash. */
function imageDefectSignature(images: { total: number; missingAlt: number; missing_images?: MissingImageRow[] }): string {
	const rows = (images.missing_images || [])
		.map((row) => `${row.img_src}::${row.issue_type || row.issue || ''}`)
		.sort();
	return [`total:${images.total}`, `missing:${images.missingAlt}`, ...rows].join('|');
}

/** Compact per-script signature so async/defer fixes change the content hash. */
function renderBlockingSignature(scripts: RenderBlockingScript[]): string {
	return scripts
		.map((row) => `${row.scriptSrc}::${row.isHead ? 'head' : 'body'}`)
		.sort()
		.join('|');
}

function pickSchemaType(types: string[]): string {
	const pageLike = types.find((t) =>
		/WebPage|AboutPage|Medical|FAQ|HowTo|Article|Collection|ItemList|Contact|Physician|Hospital|Clinic/i.test(t),
	);
	return pageLike || types[0] || '';
}

function summarizePinpoint(body: string): string {
	const compact = summarizeBodyText(body);
	if (compact) return compact;
	const lines = body
		.split(/(?<=다\.|요\.|니다\.|[.!?。])\s+/)
		.map((s) => s.trim())
		.filter((s) => s.length >= 12)
		.slice(0, 3);
	return lines.join(' ').slice(0, 220);
}

export function parsePinpointPage(opts: {
	html: string;
	urlPath: string;
	origin: string;
	siteName?: string;
	mainTitle?: string;
	mainDescription?: string;
	navLabel?: string;
	industryType?: string;
}): Omit<FullAuditPageSnapshot, 'source' | 'cacheHit' | 'url'> {
	const $ = cheerio.load(opts.html);
	const meta = parseMeta($, opts.siteName);
	const h1Texts = extractContentScopedHeadings($);
	const h2 = extractContentScopedH2($, 6);
	const schema = parseJsonLd($, opts.html);
	const picked = pickPageTitleH1({
		fullTitle: meta.title,
		pageTitle: meta.pageTitle,
		h1Texts,
		siteName: opts.siteName,
		navLabel: opts.navLabel,
		mainTitle: opts.mainTitle,
	});
	let pageUrl = opts.urlPath;
	try {
		pageUrl = new URL(opts.urlPath, opts.origin).toString();
	} catch {
		/* keep path */
	}
	const images = parseImages($, {
		pageUrl,
		pageTitle: picked.title,
		origin: opts.origin,
		scope: 'content',
	});
	const renderBlockingScriptItems = collectRenderBlockingScripts($, { pageUrl });
	const body = extractPinpointBody($);
	const metaDesc = pickPageDescription({
		metaDescription: meta.metaDescription,
		ogDescription: meta.ogDescription,
		mainDescription: opts.mainDescription,
		siteName: opts.siteName,
	});
	const summary =
		summarizePinpoint(body) ||
		resolvePageDescription({
			siteName: opts.siteName || '',
			pageTitle: picked.title,
			url: opts.urlPath,
			gnb: opts.navLabel,
			industryType: opts.industryType,
			existingMeta: metaDesc,
			bodyText: body,
			mainDescription: opts.mainDescription,
		});
	return {
		urlPath: opts.urlPath,
		page_title: picked.title,
		h1: picked.h1,
		h2,
		summary,
		schema_type: pickSchemaType(schema.types),
		content_hash: computeContentHash(picked.h1, body, [
			imageDefectSignature(images),
			renderBlockingSignature(renderBlockingScriptItems),
		]),
		last_audited: Date.now(),
		missingAlt: images.missingAlt,
		imagesTotal: images.total,
		headingSkipDetected: false,
		imageAltIssues: images.imageAltIssues,
		missing_images: images.missing_images,
		imageSrcs: images.imageSrcs,
		renderBlockingScriptItems,
	};
}

export function formatFullAuditProgress(opts: {
	phase: FullAuditProgressPhase;
	mode: FullAuditMode;
	pagesFound: number;
	pagesParsed: number;
	currentIndex: number;
	currentUrl?: string;
	cacheHits: number;
	cacheMisses: number;
	lang?: 'ko' | 'en';
}): FullAuditProgress {
	const total = Math.max(0, opts.pagesFound);
	const percent = total === 0 ? 100 : Math.min(100, Math.round((opts.currentIndex / total) * 100));
	const ko = opts.lang !== 'en';
	let message = '';
	if (opts.phase === 'discover') {
		message = ko
			? `사이트맵·메뉴·CMS 경로에서 공개 페이지 수집 중... (${opts.pagesFound}개 발견)`
			: `Collecting public pages from sitemap, menus, and CMS routes... (${opts.pagesFound} found)`;
	} else if (opts.phase === 'analyze') {
		const idx = Math.max(1, opts.currentIndex);
		message = ko
			? `전체 ${total}개 페이지 중 ${idx}번째 페이지 정밀 분석 중... [${percent}%]`
			: `Deep-analyzing page ${idx} of ${total}... [${percent}%]`;
	} else if (opts.phase === 'done' && opts.mode === 'incremental') {
		message = ko
			? `전체 ${total}개 중 ${opts.cacheHits}개 캐시 재사용, 변경된 ${opts.cacheMisses}개 페이지 신규 분석 완료`
			: `Reused ${opts.cacheHits} of ${total} from cache; finished ${opts.cacheMisses} changed pages`;
	} else {
		message = ko
			? `전체 ${total}개 페이지 정밀 분석 완료 [${percent}%]`
			: `Finished deep analysis of ${total} pages [${percent}%]`;
	}
	return { ...opts, percent, message };
}

export function formatVerificationLog(found: number, parsed: number, missing: string[]): string {
	return `[full-audit] Total Pages Found=${found} Parsed=${parsed} missing=${missing.length}${
		missing.length ? ` sample=${missing.slice(0, 5).join(',')}` : ''
	}`;
}

/**
 * `deadlineAt`: once past this timestamp, workers stop picking up new items instead of
 * draining the whole queue — items not started stay `undefined` in the result array so the
 * caller can filter them out. Existing in-flight items are still awaited to completion.
 */
async function mapPool<T, R>(
	items: T[],
	concurrency: number,
	worker: (item: T, index: number) => Promise<R>,
	deadlineAt?: number,
): Promise<Array<R | undefined>> {
	const results: Array<R | undefined> = new Array(items.length);
	let cursor = 0;
	let deadlineHit = false;
	const run = async () => {
		while (cursor < items.length) {
			if (deadlineAt && Date.now() > deadlineAt) {
				deadlineHit = true;
				return;
			}
			const index = cursor;
			cursor += 1;
			results[index] = await worker(items[index] as T, index);
		}
	};
	const n = Math.max(1, Math.min(concurrency, items.length || 1));
	await Promise.all(Array.from({ length: n }, () => run()));
	if (deadlineHit) {
		console.warn(
			`[full-audit] time budget exceeded mid-crawl — stopped after ${cursor}/${items.length} of this batch.`,
		);
	}
	return results;
}

function defaultFetchHtml(forceRefresh: boolean): FullAuditFetchHtml {
	return async (url: string) => {
		const page = await fetchPageResource(url, {
			timeoutMs: FULL_AUDIT_FETCH_TIMEOUT_MS,
			forceRefresh,
			accept: 'text/html,application/xhtml+xml',
			skipSsrf: true,
			skipProtocolUpgrade: true,
			skipUaRetry: true,
			maxChars: FULL_AUDIT_MAX_HTML_CHARS,
		});
		if (!page.ok || page.botChallenge || !page.text) return { ok: false, text: '' };
		return { ok: true, text: page.text };
	};
}

function snapshotToCachePage(page: FullAuditPageSnapshot): DeltaCachePage {
	return {
		page_title: page.page_title,
		h1: page.h1,
		summary: page.summary,
		schema_type: page.schema_type,
		content_hash: page.content_hash,
		last_audited: page.last_audited,
		url_path: page.urlPath,
		h2: page.h2,
		missing_alt: page.missingAlt,
		images_total: page.imagesTotal,
		heading_skip: page.headingSkipDetected,
		render_blocking: (page.renderBlockingScriptItems || []).slice(0, 15).map((row) => ({
			page_url: row.pageUrl,
			script_src: row.scriptSrc,
			full_tag: row.fullTag,
			is_head: row.isHead,
			recommendation: row.recommendation,
		})),
		missing_alt_images: (
			page.missing_images?.length
				? page.missing_images
				: (page.imageAltIssues || []).map((issue) => toMissingImageRow(issue))
		)
			.slice(0, IMAGE_ALT_ISSUE_CAP)
			.map((row) => {
				const pageUrl = row.page_url || page.urlPath;
				const issueType =
					row.issue_type ||
					(row.issue === '공백(alt="")'
						? ('empty' as const)
						: row.issue === '불용어(image/사진 등)'
							? ('stopword' as const)
							: ('missing' as const));
				return {
					page_url: pageUrl,
					page_display: row.page_display || formatPageDisplay(pageUrl),
					img_src: row.img_src,
					normalized_src: row.normalized_src || normalizeImageSrc(row.img_src, { pageUrl }),
					current_alt: row.current_alt,
					issue_type: issueType,
					suggested_alt: row.suggested_alt,
					issue: row.issue,
				};
			}),
		image_srcs: (page.imageSrcs || []).slice(0, 80),
		source: page.source,
	};
}

function cachePageToSnapshot(
	urlPath: string,
	origin: string,
	cached: DeltaCachePage,
	source: FullAuditSource,
): FullAuditPageSnapshot {
	return {
		url: new URL(urlPath, origin).toString(),
		urlPath,
		page_title: cached.page_title,
		h1: cached.h1,
		h2: cached.h2 || [],
		summary: cached.summary,
		schema_type: cached.schema_type,
		content_hash: cached.content_hash,
		last_audited: cached.last_audited,
		source: (cached.source as FullAuditSource) || source,
		cacheHit: true,
		missingAlt: cached.missing_alt,
		imagesTotal: cached.images_total,
		headingSkipDetected: cached.heading_skip,
		renderBlockingScriptItems: (cached.render_blocking || []).map((row) => ({
			pageUrl: row.page_url,
			scriptSrc: row.script_src,
			fullTag: row.full_tag,
			isHead: row.is_head,
			recommendation: row.recommendation,
			recommendationKind: row.is_head ? ('add_defer' as const) : ('move_to_body_end' as const),
		})),
		imageAltIssues: (cached.missing_alt_images || []).map((row) => {
			const normalizedSrc =
				row.normalized_src || normalizeImageSrc(row.img_src, { pageUrl: row.page_url });
			return {
				src: row.img_src,
				alt: row.current_alt,
				issue:
					row.issue_type === 'empty' ? '공백' : row.issue_type === 'stopword' ? '불용어 사용' : '누락',
				issueType: row.issue_type,
				selector: '',
				pageUrl: row.page_url,
				pageDisplay: row.page_display || formatPageDisplay(row.page_url),
				imgSrc: row.img_src,
				normalizedSrc: normalizedSrc || undefined,
				href: normalizedSrc && !normalizedSrc.startsWith('data:') ? normalizedSrc : undefined,
				suggestedAlt: row.suggested_alt,
			};
		}),
		missing_images: (cached.missing_alt_images || []).map((row) => ({
			page_url: row.page_url,
			page_display: row.page_display || formatPageDisplay(row.page_url),
			img_src: row.img_src,
			normalized_src: row.normalized_src || normalizeImageSrc(row.img_src, { pageUrl: row.page_url }),
			current_alt: row.current_alt,
			issue:
				row.issue === '공백(alt="")' || row.issue === '불용어(image/사진 등)' || row.issue === 'alt 누락'
					? row.issue
					: row.issue_type === 'empty'
						? '공백(alt="")'
						: row.issue_type === 'stopword'
							? '불용어(image/사진 등)'
							: 'alt 누락',
			issue_type: row.issue_type,
			suggested_alt: row.suggested_alt,
		})),
		imageSrcs: cached.image_srcs,
	};
}

export function snapshotsToPageMetas(
	pages: FullAuditPageSnapshot[],
	mainPath = '/',
): CrawledPageMeta[] {
	return pages
		.filter((page) => {
			const path = page.urlPath.split('#')[0] || '';
			return path && path !== '/' && path !== mainPath && !/^\/index\.(php|html?)$/i.test(path);
		})
		.map((page) => ({
			urlPath: page.urlPath,
			title: page.page_title,
			h1: page.h1,
			description: page.summary,
			missingAlt: page.missingAlt,
			imagesTotal: page.imagesTotal,
			headingSkipDetected: page.headingSkipDetected,
			imageAltIssues: page.imageAltIssues,
			missing_images: page.missing_images,
			imageSrcs: page.imageSrcs,
			source: page.source,
			renderBlockingScriptItems: page.renderBlockingScriptItems,
		}));
}

export async function runFullAudit(opts: RunFullAuditOptions): Promise<FullAuditResult> {
	const pipelineStartedAt = Date.now();
	const timeBudgetMs = opts.timeBudgetMs ?? FULL_AUDIT_TIME_BUDGET_MS;
	const deadlineAt = pipelineStartedAt + timeBudgetMs;
	const origin = normalizeSiteOrigin(opts.origin);
	const concurrency = Math.min(10, Math.max(5, opts.concurrency ?? FULL_AUDIT_CONCURRENCY));
	const maxPages = opts.maxPages ?? FULL_AUDIT_MAX_PAGES;
	const maxBfsRounds = opts.maxBfsRounds ?? FULL_AUDIT_MAX_BFS_ROUNDS;
	const useDelta = opts.useDeltaCache !== false;
	const lang = opts.lang === 'en' ? 'en' : 'ko';
	const fetchHtml = opts.fetchHtml || defaultFetchHtml(opts.forceRefresh === true);
	const emit = opts.onProgress;

	const sitemapLocs =
		opts.sitemapLocs ||
		(opts.fetchHtml
			? []
			: (
					await enumerateSitemapUrls(origin, opts.robotsText || '', {
						forceRefresh: opts.forceRefresh,
					}).catch(() => ({ locs: [] as string[] }))
				).locs);

	const seed = collectDiscoveredUrls({
		origin,
		mainUrl: opts.mainUrl,
		homepageHtml: opts.homepageHtml,
		robotsText: opts.robotsText,
		sitemapLocs,
		navItems: opts.navItems,
	});

	const cms = opts.cmsHint || (opts.homepageHtml ? detectCmsFromHtml(opts.homepageHtml) : '');
	if (/그누보드|GNUBOARD/i.test(cms) && opts.homepageHtml) {
		for (const path of extractGnuboardPublicRoutes(opts.homepageHtml, origin)) {
			const key = path.toLowerCase();
			if (!seed.sources.has(key)) {
				seed.sources.set(key, /board\.php/.test(path) ? 'gnuboard_board' : 'gnuboard_contents');
				seed.urls.push(path);
			}
		}
	}

	const prior =
		opts.cache !== undefined
			? opts.cache
			: useDelta
				? await loadDeltaCache(origin)
				: null;
	// forceRefresh always deep-parses every page (see the `!opts.forceRefresh` guard in
	// `analyzePath`), so it is reported as a `full` run even when a delta cache exists.
	const mode: FullAuditMode =
		!opts.forceRefresh && prior && Object.keys(prior.pages).length > 0 ? 'incremental' : 'full';

	const pushProgress = (
		phase: FullAuditProgressPhase,
		state: { found: number; parsed: number; index: number; url?: string; hits: number; misses: number },
	) => {
		const progress = formatFullAuditProgress({
			phase,
			mode,
			pagesFound: state.found,
			pagesParsed: state.parsed,
			currentIndex: state.index,
			currentUrl: state.url,
			cacheHits: state.hits,
			cacheMisses: state.misses,
			lang,
		});
		emit?.(progress);
		return progress;
	};

	pushProgress('discover', {
		found: seed.urls.length,
		parsed: 0,
		index: 0,
		hits: 0,
		misses: 0,
	});

	const queue = seed.urls.slice(0, maxPages);
	const queued = new Set(queue.map((u) => u.toLowerCase()));
	const htmlByPath = new Map<string, string>();
	if (opts.homepageHtml) {
		htmlByPath.set('/', opts.homepageHtml);
		try {
			const main = new URL(opts.mainUrl);
			htmlByPath.set((`${main.pathname}${main.search}` || '/').toLowerCase(), opts.homepageHtml);
			htmlByPath.set((main.pathname || '/').toLowerCase(), opts.homepageHtml);
		} catch {
			/* ignore */
		}
	}

	const navByHref = new Map<string, string>();
	for (const n of opts.navItems || []) {
		if (n?.url && n?.name) navByHref.set(n.url.toLowerCase(), n.name.trim());
	}

	let cacheHits = 0;
	let cacheMisses = 0;
	const snapshots: FullAuditPageSnapshot[] = [];
	let parsedCount = 0;

	const analyzePath = async (
		urlPath: string,
		index: number,
		allowExpand: boolean,
	): Promise<FullAuditPageSnapshot> => {
		const abs = new URL(urlPath, origin).toString();
		const source = seed.sources.get(urlPath.toLowerCase()) || 'html_link';
		const cached = prior?.pages[urlPath] || prior?.pages[urlPath.toLowerCase()];
		let html = htmlByPath.get(urlPath.toLowerCase()) || htmlByPath.get(urlPath) || '';
		if (!html) {
			const fetched = await fetchHtml(abs);
			html = fetched.ok ? fetched.text : '';
			if (html) htmlByPath.set(urlPath.toLowerCase(), html);
		}

		if (!html && cached) {
			cacheHits += 1;
			return cachePageToSnapshot(urlPath, origin, cached, source);
		}

		if (!html) {
			const navLabel =
				navByHref.get(urlPath.toLowerCase()) ||
				(opts.navItems || []).find((n) => {
					const href = String(n?.url || '').toLowerCase();
					const name = String(n?.name || '').trim();
					if (!href || !name || /https?:\/\/|\/theme\/|\.php/i.test(name)) return false;
					const wantBase = urlPath.toLowerCase().split('?')[0].split('/').filter(Boolean).pop();
					const navBase = href.split('?')[0].split('/').filter(Boolean).pop();
					return href.endsWith(urlPath.toLowerCase()) || Boolean(wantBase && navBase === wantBase);
				})?.name?.trim() ||
				'';
			cacheMisses += 1;
			parsedCount += 1;
			return {
				url: abs,
				urlPath,
				page_title: navLabel,
				h1: navLabel,
				h2: [],
				summary: '',
				schema_type: '',
				content_hash: computeContentHash(navLabel, urlPath),
				last_audited: Date.now(),
				source,
				cacheHit: false,
			};
		}

		const parsed = parsePinpointPage({
			html,
			urlPath,
			origin,
			siteName: opts.siteName,
			mainTitle: opts.mainTitle,
			mainDescription: opts.mainDescription,
			navLabel: navByHref.get(urlPath.toLowerCase()),
			industryType: opts.industryType,
		});

		// `forceRefresh` means "trust nothing but the live fetch" — even a content-hash
		// match must not resurrect a stale cached snapshot (e.g. missing_alt_images) on
		// a manual re-diagnosis. Non-forced incremental runs keep the hash-based reuse.
		if (useDelta && !opts.forceRefresh && cached && cached.content_hash === parsed.content_hash) {
			cacheHits += 1;
			return cachePageToSnapshot(urlPath, origin, cached, source);
		}

		cacheMisses += 1;
		parsedCount += 1;
		pushProgress('analyze', {
			found: queued.size,
			parsed: parsedCount,
			index: index + 1,
			url: urlPath,
			hits: cacheHits,
			misses: cacheMisses,
		});

		if (allowExpand) {
			for (const extra of extractPublicRoutePatterns(html, origin)) {
				const key = extra.toLowerCase();
				if (queued.has(key) || queued.size >= maxPages) continue;
				queued.add(key);
				queue.push(extra);
				seed.sources.set(key, 'bfs');
			}
			try {
				const $ = cheerio.load(html);
				for (const href of extractInternalLinks($, abs, 200)) {
					const path = normalizeAuditPagePath(href, origin);
					if (!path || !isPublicHtmlRoute(path)) continue;
					const key = path.toLowerCase();
					if (queued.has(key) || queued.size >= maxPages) continue;
					queued.add(key);
					queue.push(path);
					seed.sources.set(key, 'bfs');
				}
			} catch {
				/* keep regex extras */
			}
		}

		return { url: abs, source, cacheHit: false, ...parsed };
	};

	let cursor = 0;
	let hop = 0;
	while (cursor < queue.length) {
		if (Date.now() > deadlineAt) {
			console.warn(
				`[full-audit] time budget (${timeBudgetMs}ms) exceeded before hop ${hop} — stopping BFS early with ${snapshots.length}/${queue.length} pages parsed so far.`,
			);
			break;
		}
		const batch = queue.slice(cursor);
		const start = cursor;
		cursor = queue.length;
		const allowExpand = hop < maxBfsRounds;
		const rows = await mapPool(
			batch,
			concurrency,
			(urlPath, i) => analyzePath(urlPath, start + i, allowExpand),
			deadlineAt,
		);
		for (const row of rows) {
			if (row) snapshots.push(row);
		}
		hop += 1;
		if (!allowExpand) break;
	}

	const seenSnap = new Set<string>();
	const uniquePages: FullAuditPageSnapshot[] = [];
	for (const page of snapshots) {
		const key = page.urlPath.toLowerCase();
		if (seenSnap.has(key)) continue;
		seenSnap.add(key);
		uniquePages.push(page);
	}

	const nextCache: DeltaCacheDocument = {
		site_origin: origin,
		last_full_scan: mode === 'full' || !prior?.last_full_scan ? Date.now() : prior.last_full_scan,
		pages: { ...(prior?.pages || {}) },
	};
	for (const page of uniquePages) {
		nextCache.pages[page.urlPath] = snapshotToCachePage(page);
	}
	if (mode === 'full') nextCache.last_full_scan = Date.now();
	if (opts.persistCache !== false) {
		await saveDeltaCache(nextCache).catch((err) => {
			console.warn('[full-audit] cache persist skipped:', err instanceof Error ? err.message : err);
		});
	}

	let mainPath = '/';
	try {
		const u = new URL(opts.mainUrl);
		mainPath = `${u.pathname}${u.search}` || '/';
	} catch {
		/* keep / */
	}

	const missingUrls = queue.filter((urlPath) => !seenSnap.has(urlPath.toLowerCase()));
	const verification: FullAuditVerification = {
		pagesFound: queue.length,
		pagesParsed: uniquePages.length,
		missingUrls,
		log: formatVerificationLog(queue.length, uniquePages.length, missingUrls),
	};
	console.info(verification.log);

	const sourceCounts: Partial<Record<FullAuditSource, number>> = {};
	for (const page of uniquePages) {
		sourceCounts[page.source] = (sourceCounts[page.source] || 0) + 1;
	}

	const done = pushProgress('done', {
		found: queue.length,
		parsed: uniquePages.length,
		index: queue.length,
		hits: cacheHits,
		misses: cacheMisses,
	});

	return {
		siteOrigin: origin,
		mode,
		pagesFound: queue.length,
		pagesParsed: uniquePages.length,
		cacheHits,
		cacheMisses,
		progressMessage: done.message,
		verification,
		sources: sourceCounts,
		discoveredUrls: queue,
		pages: uniquePages,
		pageMetas: snapshotsToPageMetas(uniquePages, mainPath),
		cache: nextCache,
	};
}

export { clearMemoryDeltaCache };
export type { DeltaCacheDocument, DeltaCachePage };
