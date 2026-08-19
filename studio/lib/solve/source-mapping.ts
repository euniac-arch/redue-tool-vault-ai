/**
 * Universal audit URL ↔ local source mapping, global head detection,
 * and missing SEO/GEO schema injection helpers.
 */

import type { DetectedCmsDisplay, LocalScannedFile } from '@/lib/solve/local-folder-scan';
import {
	addDeferToScriptTagsInSource,
	buildAltAutoFixerScriptTag,
	buildCanonicalLinkHtmlTag,
	buildJsDeferAutoFixerScriptTag,
	stripHardcodedCanonicalTags,
	stripRedueSchemaBlocks,
} from '@/lib/solve/dynamic-php-schema';

export type InjectionGroup = 'global' | 'page' | 'other';

export type InjectionAnchor = 'php-open-top' | 'head-close' | 'wp_head' | 'head-open' | 'none';

export type InjectionSafety = {
	hasHeadOpen: boolean;
	hasHeadClose: boolean;
	hasWpHead: boolean;
	hasHtmlTag: boolean;
	safe: boolean;
	/** Preferred insert strategy when safe. */
	anchor: InjectionAnchor;
	warning: string | null;
};

/** Crawled URL reference preserving path + query for backend template mapping. */
export type CollectedUrlRef = {
	/** Pathname only: `/bbs/board.php` */
	pathname: string;
	/** Raw search including `?`, or empty */
	search: string;
	/** Display / mapping key: `/bbs/board.php?bo_table=qa` */
	hrefPath: string;
	/** Flattened query params */
	query: Record<string, string>;
};

export type MappedSourceFile = {
	relativePath: string;
	group: InjectionGroup;
	/** Auto-selected for injection. */
	autoChecked: boolean;
	/** User may still toggle; this is the initial recommendation. */
	recommended: boolean;
	badge: string;
	/** Short UI badge: e.g. `[공통 Organization / Meta 주입]` */
	natureBadge: string;
	/** Injected schema types summary for list row. */
	schemaSummary: string[];
	/** Matched audit URL path (may include query). */
	mappedUrlPath?: string;
	/** Query context from crawled URL (e.g. bo_table=qa). */
	urlQuery?: Record<string, string>;
	/** Caution for layout-only files (e.g. gnuboard head.php). */
	caution?: string | null;
	safety?: InjectionSafety;
	/** How the local file was resolved (rule 1–3). */
	mappingRule?: 'exact' | 'clean-url' | 'backend-template';
	/** Universal header finder path-rank score (100/90/80/70 + content). */
	priorityScore?: number;
	/** True for the single top-ranked common header (dynamic PHP inject target). */
	isPrimaryHeader?: boolean;
};

export type SourceMappingResult = {
	files: MappedSourceFile[];
	/** Auto-extracted patch targets only (global + page). */
	mainTargets: MappedSourceFile[];
	globalTargets: MappedSourceFile[];
	pageTargets: MappedSourceFile[];
	otherFiles: MappedSourceFile[];
	globalHeaderPath: string | null;
	/** Up to 2 auto-detected common header files. */
	globalHeaderPaths: string[];
	mappedPageCount: number;
	excludedSystemCount: number;
	mainTargetCount: number;
	summaryLines: string[];
};

const GLOBAL_SCHEMA_DEFAULT = ['Organization', 'WebSite', 'SiteNavigationElement', 'OpenGraph', 'Meta'];
const PAGE_SCHEMA_DEFAULT = ['WebPage', 'BreadcrumbList'];

const HEAD_OPEN_RE = /<head[\s\S]*?>/i;

/** `<meta charset="…">` or `<meta http-equiv="Content-Type" … charset=…>` — First-Chunk anchor. */
const CHARSET_META_RE =
	/<meta\b[^>]*(?:\bcharset\s*=|http-equiv\s*=\s*["']content-type["'][^>]*charset)[^>]*>/i;

/**
 * Insert canonical/og pair immediately after charset meta (bot First-Chunk safe).
 * Falls back to after `<head>` when charset is missing.
 */
export function injectAfterCharsetOrHead(source: string, tags: string): string {
	const block = String(tags || '').trimEnd();
	if (!block) return source;
	if (CHARSET_META_RE.test(source)) {
		return source.replace(CHARSET_META_RE, (match) => `${match}\n${block}`);
	}
	if (HEAD_OPEN_RE.test(source)) {
		return source.replace(HEAD_OPEN_RE, (match) => `${match}\n${block}`);
	}
	return `${block}\n${source}`;
}
const HEAD_CLOSE_RE = /<\/head>/i;
const HTML_TAG_RE = /<html[\s\S]*?>/i;
const WP_HEAD_RE = /<\?php\s+wp_head\s*\(\s*\)\s*;\s*\?>/i;

/** Insert `block` immediately before the last `</head>` (skips `</head>` text inside PHP comments). */
function injectBeforeLastHeadClose(source: string, block: string): string {
	const re = /<\/head>/gi;
	let match: RegExpExecArray | null;
	let last: RegExpExecArray | null = null;
	while ((match = re.exec(source)) !== null) last = match;
	if (!last) return source;
	return source.slice(0, last.index) + block + source.slice(last.index);
}

/** Paths that must not be auto-selected unless explicitly URL-mapped as a front template. */
const SYSTEM_EXCLUSION_PATTERNS: RegExp[] = [
	/(^|\/)adm(\/|$)/i,
	/(^|\/)data(\/|$)/i,
	/(^|\/)wp-admin(\/|$)/i,
	/(^|\/)wp-includes(\/|$)/i,
	/(^|\/)include(\/|$)/i,
	/(^|\/)lib(\/|$)/i,
	/(^|\/)plugin(\/|$)/i,
	/(^|\/)plugins(\/|$)/i,
	/(^|\/)vendor(\/|$)/i,
	/(^|\/)bbs\/login\.php$/i,
	/(^|\/)bbs\/logout\.php$/i,
	/(^|\/)bbs\/register\.php$/i,
	/(^|\/)bbs\/write\.php$/i,
	/(^|\/)bbs\/password\.php$/i,
	/(^|\/)bbs\/member(_confirm)?\.php$/i,
	/(^|\/)bbs\/ajax\./i,
	/(^|\/)bbs\/move\.php$/i,
	/(^|\/)bbs\/delete\.php$/i,
	/(^|\/)bbs\/good\.php$/i,
	/(^|\/)shop\/ajax\./i,
	/(^|\/)shop\/orderform\.php$/i,
	/(^|\/)shop\/orderinquiry\.php$/i,
	/(^|\/)shop\/cartupdate\.php$/i,
	/(^|\/)wp-cron\.php$/i,
	/(^|\/)xmlrpc\.php$/i,
	/(^|\/)dbconfig\.php$/i,
	/(^|\/)common\.php$/i,
	/(^|\/)config\.php$/i,
	/(^|\/)wp-config\.php$/i,
];

/** Front-facing backend templates that SHOULD map when crawled (Rule 3). */
const BACKEND_TEMPLATE_ALLOWLIST: RegExp[] = [
	/(^|\/)bbs\/board\.php$/i,
	/(^|\/)bbs\/content\.php$/i,
	/(^|\/)bbs\/faq\.php$/i,
	/(^|\/)bbs\/qalist\.php$/i,
	/(^|\/)bbs\/qaview\.php$/i,
	/(^|\/)shop\/list\.php$/i,
	/(^|\/)shop\/item\.php$/i,
	/(^|\/)shop\/content\.php$/i,
];

const HEADER_NAME_HINT_RE =
	/(^|\/)(head\.sub\.php|head\.php|header\.php|header\.html|inc\/head\.php|include\/head\.php|layout\.html|layout\.(tsx|jsx|js|ts)|_document\.(tsx|jsx|js|ts)|app\.blade\.php)$/i;

function normalizePath(p: string): string {
	return p.replace(/\\/g, '/').replace(/^\/+/, '');
}

function basename(relativePath: string): string {
	const parts = normalizePath(relativePath).split('/');
	return parts[parts.length - 1] || '';
}

export function isSystemExcludedPath(relativePath: string): boolean {
	const p = normalizePath(relativePath);
	if (BACKEND_TEMPLATE_ALLOWLIST.some((re) => re.test(p))) return false;
	return SYSTEM_EXCLUSION_PATTERNS.some((re) => re.test(p));
}

export function isBackendTemplatePath(relativePath: string): boolean {
	return BACKEND_TEMPLATE_ALLOWLIST.some((re) => re.test(normalizePath(relativePath)));
}

/** Parse absolute/relative URL into pathname + query context. */
export function parseCollectedUrl(urlOrPath: string, baseOrigin?: string): CollectedUrlRef | null {
	const raw = (urlOrPath || '').trim();
	if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:')) {
		return null;
	}

	try {
		let u: URL;
		if (/^https?:\/\//i.test(raw)) {
			u = new URL(raw);
			if (baseOrigin) {
				const base = new URL(baseOrigin);
				if (u.origin !== base.origin) return null;
			}
		} else if (baseOrigin) {
			u = new URL(raw, baseOrigin);
		} else {
			const path = raw.startsWith('/') ? raw : `/${raw}`;
			const [pathPart, searchPart = ''] = path.split('?');
			const hashless = (pathPart || '/').split('#')[0] || '/';
			const search = searchPart ? `?${searchPart.split('#')[0]}` : '';
			const query: Record<string, string> = {};
			if (search) {
				new URLSearchParams(search).forEach((v, k) => {
					query[k] = v;
				});
			}
			return {
				pathname: hashless || '/',
				search,
				hrefPath: search ? `${hashless}${search}` : hashless,
				query,
			};
		}

		const pathname = u.pathname || '/';
		const search = u.search || '';
		const query: Record<string, string> = {};
		u.searchParams.forEach((v, k) => {
			query[k] = v;
		});
		return {
			pathname,
			search,
			hrefPath: search ? `${pathname}${search}` : pathname,
			query,
		};
	} catch {
		return null;
	}
}

/** Normalize an absolute or relative URL into a site-relative path (`/foo/bar.php`). */
export function urlToPathname(urlOrPath: string): string | null {
	const ref = parseCollectedUrl(urlOrPath);
	return ref?.pathname || null;
}

/**
 * Collect drive URLs from audit payload / report-shaped objects.
 * Preserves query strings for backend-template mapping (Rule 3).
 */
export function extractAuditUrlPaths(input: {
	url?: string;
	collectedUrls?: string[];
	urls?: string[];
	findings?: Array<{ evidence?: string; detail?: string }>;
	metrics?: { canonical?: string; ogUrl?: string };
	baseOrigin?: string;
}): string[] {
	return extractAuditCollectedUrls(input).map((r) => r.hrefPath);
}

export function extractAuditCollectedUrls(input: {
	url?: string;
	collectedUrls?: string[];
	urls?: string[];
	findings?: Array<{ evidence?: string; detail?: string }>;
	metrics?: { canonical?: string; ogUrl?: string };
	baseOrigin?: string;
}): CollectedUrlRef[] {
	const bucket = new Map<string, CollectedUrlRef>();
	const base = input.baseOrigin || input.url;

	const push = (value?: string | null) => {
		if (!value) return;
		const ref = parseCollectedUrl(value, base);
		if (!ref) return;
		// Keep first occurrence; prefer entry that retains query when colliding on pathname-only
		const existing = bucket.get(ref.hrefPath);
		if (!existing) bucket.set(ref.hrefPath, ref);
	};

	push(input.url);
	push(input.metrics?.canonical);
	push(input.metrics?.ogUrl);
	for (const u of input.collectedUrls || []) push(u);
	for (const u of input.urls || []) push(u);

	for (const f of input.findings || []) {
		const text = `${f.evidence || ''} ${f.detail || ''}`;
		const matches = text.match(
			/https?:\/\/[^\s"'<>]+|\/[a-zA-Z0-9_./-]+(?:\.(?:php|html|htm))?(?:\?[^\s"'<>]*)?/g,
		);
		if (!matches) continue;
		for (const m of matches) push(m);
	}

	return [...bucket.values()];
}

/**
 * Candidate local path variants for a URL pathname (Rules 1–2).
 * Rule 1: `/sub/page.php` → `sub/page.php`
 * Rule 2: `/page` → `page.php`, `page.html`, `page/index.php`, `page/index.html`
 */
export function pathnameToLocalCandidates(pathname: string): string[] {
	const path = urlToPathname(pathname);
	if (!path) return [];

	let cleaned = path.replace(/\/+/g, '/');
	if (cleaned.endsWith('/') || cleaned === '/') {
		return ['index.php', 'index.html', 'main.html', 'index.htm', 'main.php'];
	}

	cleaned = cleaned.replace(/^\//, '');
	const out = new Set<string>([cleaned]);

	if (!/\.(php|html|htm)$/i.test(cleaned)) {
		out.add(`${cleaned}.php`);
		out.add(`${cleaned}.html`);
		out.add(`${cleaned}.htm`);
		out.add(`${cleaned}/index.php`);
		out.add(`${cleaned}/index.html`);
		out.add(`${cleaned}/index.htm`);
	}

	return [...out];
}

function pathRankEndsWith(paths: string[], fileName: string): string | null {
	const needle = fileName.toLowerCase();
	const hits = paths.filter((p) => basename(p).toLowerCase() === needle);
	if (hits.length === 0) return null;
	// Prefer site-root (non-theme) matches — ghost theme/ trees must not win by path alone.
	hits.sort((a, b) => {
		const aTheme = /theme\//i.test(a) ? 1 : 0;
		const bTheme = /theme\//i.test(b) ? 1 : 0;
		if (aTheme !== bTheme) return aTheme - bTheme;
		return a.split('/').length - b.split('/').length || a.length - b.length;
	});
	return hits[0];
}

function firstMatch(paths: string[], patterns: RegExp[]): string | null {
	for (const re of patterns) {
		const hit = paths.find((p) => re.test(p));
		if (hit) return hit;
	}
	return null;
}

export type GlobalHeaderTarget = {
	path: string;
	badge: string;
	caution?: string | null;
	/** Content-scan + path ranking score (higher = more likely real common header). */
	score?: number;
	/** Path-priority tier points (100 / 90 / 80 / 70). */
	pathRank?: number;
	/** Highest-ranked auto-detected common header. */
	isPrimary?: boolean;
};

/** UI badge prefix for the single top-ranked universal header. */
export const PRIMARY_HEADER_BADGE_PREFIX = '[📌 자동 감지된 최우선 공통 헤더';

/** Default badge (no theme-usage reason). Prefer `formatPrimaryHeaderBadge`. */
export const PRIMARY_HEADER_BADGE = `${PRIMARY_HEADER_BADGE_PREFIX}]`;

/** Build primary-header badge with optional theme-usage reason. */
export function formatPrimaryHeaderBadge(reason?: string | null): string {
	const detail = (reason || '').trim();
	if (!detail) return PRIMARY_HEADER_BADGE;
	return `${PRIMARY_HEADER_BADGE_PREFIX} (${detail})]`;
}

const G5_THEME_PATH_RE =
	/G5_THEME_PATH\s*\.\s*['"]\/([^'"]+)['"]|G5_THEME_PATH\s*\.\s*['"]([^'"]*head[^'"]*)['"]/gi;
const THEME_NAME_FROM_INCLUDE_RE =
	/theme\/([a-zA-Z0-9_-]+)\/(?:head\.sub\.php|head\.php|header\.php)/i;
const CF_THEME_ASSIGN_RE =
	/\$config\s*\[\s*['"]cf_theme['"]\s*\]\s*=\s*['"]([^'"]*)['"]/i;

/** Active Theme Checker result for Gnuboard / Youngcart. */
export type GnuboardThemeUsage = {
	/** True when the live site actually dispatches to theme/ headers. */
	active: boolean;
	/** Configured / resolved theme folder name, if any. */
	themeName: string | null;
	/** Short reason for UI badge / logs. */
	reason: string;
	/** Evidence used for the decision. */
	evidence: {
		hasG5ThemePathInRootHead: boolean;
		cfTheme: string | null;
		rootHeadPath: string | null;
		configPath: string | null;
	};
};

function findRootRelativeFile(relativePaths: string[], fileName: string): string | null {
	const needle = fileName.replace(/\\/g, '/').toLowerCase();
	const paths = relativePaths.map(normalizePath);
	const exact = paths.find((p) => p.toLowerCase() === needle);
	if (exact) return exact;
	// Shallowest non-theme match only — never treat theme/{name}/head.sub.php as site root.
	const hits = paths.filter((p) => {
		const lower = p.toLowerCase();
		if (/(^|\/)theme\//i.test(p)) return false;
		return lower.endsWith('/' + needle) || basename(p).toLowerCase() === needle;
	});
	if (hits.length === 0) return null;
	hits.sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length);
	return hits[0];
}

function contentByPath(contents: Record<string, string>, relativePath: string | null): string | null {
	if (!relativePath) return null;
	const norm = normalizePath(relativePath);
	return contents[norm] ?? contents[relativePath] ?? null;
}

/** Parse `$config['cf_theme'] = 'name'` from config.php (empty string → null). */
export function parseCfThemeFromConfig(source: string): string | null {
	const m = source.match(CF_THEME_ASSIGN_RE);
	if (!m) return null;
	const name = (m[1] || '').trim();
	return name.length > 0 ? name : null;
}

/**
 * Active Theme Checker (Strict Priority Rule):
 * ① Parse root /config.php → `$config['cf_theme']`
 * ② Case A: empty / missing → theme unused (root head wins)
 * ③ Case B: non-empty theme name → theme/{name}/head.sub.php wins
 *
 * Ghost `theme/` folders and leftover G5_THEME_PATH stubs alone never activate
 * a theme when cf_theme is empty.
 */
export function analyzeGnuboardThemeUsage(opts: {
	relativePaths: string[];
	fileContents?: Record<string, string>;
}): GnuboardThemeUsage {
	const paths = opts.relativePaths.map(normalizePath);
	const contents = opts.fileContents || {};

	const rootHeadPath =
		findRootRelativeFile(paths, 'head.sub.php') || findRootRelativeFile(paths, 'head.php');
	const configPath = findRootRelativeFile(paths, 'config.php');
	const rootHeadSource = contentByPath(contents, rootHeadPath);
	const configSource = contentByPath(contents, configPath);

	const hasG5ThemePathInRootHead = Boolean(rootHeadSource && /G5_THEME_PATH/i.test(rootHeadSource));
	const cfTheme = configSource ? parseCfThemeFromConfig(configSource) : null;

	// Strict: only `$config['cf_theme']` with a non-empty value activates themes.
	const active = Boolean(cfTheme);
	const themeName = cfTheme;

	const evidence = {
		hasG5ThemePathInRootHead,
		cfTheme,
		rootHeadPath,
		configPath,
	};

	if (active && themeName) {
		return {
			active: true,
			themeName,
			reason: `테마 사용: theme/${themeName}/head.sub.php 감지`,
			evidence,
		};
	}

	const rootLabel = rootHeadPath ? `/${normalizePath(rootHeadPath)}` : '/head.sub.php';
	return {
		active: false,
		themeName: null,
		reason: `테마 미사용 사이트: 루트 ${rootLabel} 감지`,
		evidence,
	};
}

/**
 * CMS별 최우선 공통 헤더 타겟 (filename heuristics).
 */
export function pickGlobalHeaderTarget(
	relativePaths: string[],
	cms: DetectedCmsDisplay | string,
): GlobalHeaderTarget | null {
	const paths = relativePaths.map(normalizePath);
	const cmsKey = String(cms);

	if (cmsKey === 'Gnuboard' || /영카트|youngcart|gnuboard/i.test(cmsKey)) {
		// Prefer root head.sub.php by default; Active Theme Checker promotes theme/ when live.
		const headSub =
			firstMatch(paths, [
				/^head\.sub\.php$/i,
				/(^|\/)head\.sub\.php$/i,
				/theme\/[^/]+\/head\.sub\.php$/i,
			]) || pathRankEndsWith(paths, 'head.sub.php');
		if (headSub) {
			return {
				path: headSub,
				badge: '자동 선택됨 / 그누보드·영카트 핵심 헤더(head.sub.php) 감지됨',
			};
		}
		const headPhp = pathRankEndsWith(paths, 'head.php');
		if (headPhp) {
			return {
				path: headPhp,
				badge: '자동 선택됨 / head.php (레이아웃 — head.sub.php 미검출)',
				caution:
					'그누보드 head.php는 레이아웃 include 파일입니다. 실제 <head>는 head.sub.php에 있습니다. 주입 전 </head> 존재 여부를 확인하세요.',
			};
		}
		const indexPhp = pathRankEndsWith(paths, 'index.php');
		if (indexPhp) {
			return { path: indexPhp, badge: '자동 선택됨 / index.php 폴백' };
		}
		return null;
	}

	if (cmsKey === 'WordPress') {
		const header =
			firstMatch(paths, [
				/wp-content\/themes\/[^/]+\/header\.php$/i,
				/(^|\/)header\.php$/i,
			]) || pathRankEndsWith(paths, 'header.php');
		if (header) {
			return {
				path: header,
				badge: '자동 선택됨 / 워드프레스 header.php (wp_head 직전 또는 </head> 직전)',
			};
		}
		return null;
	}

	if (cmsKey === 'Cafe24') {
		const layout =
			firstMatch(paths, [/layout\/basic\/layout\.html$/i, /layout\.html$/i]) ||
			pathRankEndsWith(paths, 'layout.html');
		if (layout) {
			return { path: layout, badge: '자동 선택됨 / Cafe24 layout.html' };
		}
	}

	if (cmsKey === 'Next.js') {
		const layout = firstMatch(paths, [/\/app\/layout\.(tsx|jsx|js|ts)$/i, /\/pages\/_document\./i]);
		if (layout) {
			return { path: layout, badge: '자동 선택됨 / Next.js 루트 레이아웃' };
		}
	}

	if (cmsKey === 'Laravel') {
		const blade = firstMatch(paths, [/layouts\/.+\.blade\.php$/i, /app\.blade\.php$/i]);
		if (blade) {
			return { path: blade, badge: '자동 선택됨 / Laravel Blade 레이아웃' };
		}
	}

	const custom =
		firstMatch(paths, [
			/(^|\/)head\.php$/i,
			/(^|\/)header\.html$/i,
			/(^|\/)header\.php$/i,
			/(^|\/)index\.html$/i,
			/(^|\/)main\.html$/i,
			/(^|\/)index\.php$/i,
		]) || null;
	if (custom) {
		return {
			path: custom,
			badge: '자동 선택됨 / 일반 HTML·PHP <head> 스캔 대상',
		};
	}
	return null;
}

/**
 * Path-priority ranking (Universal Deep Target Header Finder §③):
 * 100 — /theme/.../head.sub.php | header.php
 *  90 — /head.sub.php | /header.php
 *  80 — /inc/head.php | /common/header.php
 *  70 — /index.html | /main.html
 */
export function rankHeaderPathPriority(relativePath: string): number {
	const p = normalizePath(relativePath);
	// 1순위 (100): theme / WP theme headers
	if (/theme\/[^/]+\/(head\.sub\.php|header\.php)$/i.test(p)) return 100;
	if (/wp-content\/themes\/[^/]+\/header\.php$/i.test(p)) return 100;
	// 3순위 (80): inc/common includes — check before bare header.php
	if (/(^|\/)(inc|include|common)\/(head|header)\.(php|html|htm)$/i.test(p)) return 80;
	// 2순위 (90): root-level head.sub.php / header.php
	if (/(^|\/)(head\.sub\.php|header\.php)$/i.test(p) && !/theme\//i.test(p) && !/wp-content\//i.test(p)) {
		return 90;
	}
	// Cafe24 layout (between 2nd and 3rd)
	if (/layout\/[^/]+\/layout\.html$/i.test(p)) return 85;
	// 4순위 (70): static entry HTML
	if (/(^|\/)(index|main)\.(html|htm)$/i.test(p)) return 70;
	if (/(^|\/)head\.php$/i.test(p)) return 60;
	if (/(^|\/)index\.php$/i.test(p)) return 55;
	return 0;
}

/**
 * Follow G5_THEME_PATH / theme includes from a root head file to the real theme header.
 * Promotes theme/{name}/head.sub.php (or head.php / header.php) as top candidates.
 */
export function traceThemeHeaderPaths(
	source: string,
	relativePaths: string[],
): string[] {
	const paths = relativePaths.map(normalizePath);
	const lowerMap = new Map(paths.map((p) => [p.toLowerCase(), p]));
	const promoted: string[] = [];

	const pushIfExists = (candidate: string) => {
		const hit = lowerMap.get(normalizePath(candidate).toLowerCase());
		if (hit && !promoted.includes(hit)) promoted.push(hit);
	};

	const hasThemeConst = /G5_THEME_PATH/i.test(source);
	if (hasThemeConst) {
		let m: RegExpExecArray | null;
		const re = new RegExp(G5_THEME_PATH_RE.source, 'gi');
		while ((m = re.exec(source)) !== null) {
			const frag = (m[1] || m[2] || '').replace(/^\/+/, '');
			if (!frag) continue;
			if (/head/i.test(frag)) {
				// Resolve against known theme dirs
				for (const p of paths) {
					if (p.toLowerCase().endsWith('/' + frag.toLowerCase()) || p.toLowerCase() === frag.toLowerCase()) {
						pushIfExists(p);
					}
				}
				pushIfExists(frag);
			}
		}

		// Extract theme name from sibling path list when only G5_THEME_PATH is referenced
		const themeNames = new Set<string>();
		for (const p of paths) {
			const tm = p.match(/^theme\/([^/]+)\//i);
			if (tm) themeNames.add(tm[1]);
		}
		const includeTheme = source.match(THEME_NAME_FROM_INCLUDE_RE);
		if (includeTheme) themeNames.add(includeTheme[1]);

		for (const name of themeNames) {
			pushIfExists(`theme/${name}/head.sub.php`);
			pushIfExists(`theme/${name}/header.php`);
			pushIfExists(`theme/${name}/head.php`);
		}
	}

	// Direct theme path string literals in includes
	const litRe = /['"](theme\/[^'"]+\/(?:head\.sub\.php|head\.php|header\.php))['"]/gi;
	let lit: RegExpExecArray | null;
	while ((lit = litRe.exec(source)) !== null) {
		pushIfExists(lit[1]);
	}

	return promoted;
}

/** Score a file as a universal global head candidate by content + path rank. */
export function scoreGlobalHeadCandidate(relativePath: string, source: string): number {
	const safety = checkInjectionSafety(source);
	// ① Primary filter: real </head> (or wp_head) must exist — include-only stubs score 0
	if (!safety.hasHeadClose && !safety.hasWpHead) return 0;
	// Exclude include-only wrappers that mention head but lack a real closing tag body
	if (!safety.hasHeadOpen && !safety.hasWpHead && !safety.hasHtmlTag) return 0;

	const pathRank = rankHeaderPathPriority(relativePath);
	let score = pathRank;

	if (safety.hasHtmlTag) score += 15;
	if (safety.hasHeadOpen) score += 10;
	if (safety.hasHeadClose) score += 20;
	if (safety.hasWpHead) score += 15;

	const p = normalizePath(relativePath);
	if (/head\.sub\.php$/i.test(p)) score += 10;
	else if (HEADER_NAME_HINT_RE.test(p)) score += 6;

	if (/theme\//i.test(p) || /wp-content\/themes\//i.test(p) || /layout\//i.test(p)) score += 8;
	if (isSystemExcludedPath(p) && !HEADER_NAME_HINT_RE.test(p) && pathRank < 80) score -= 50;

	// Soft boost when source itself is only a theme dispatcher (will be demoted if no </head>)
	if (/G5_THEME_PATH/i.test(source) && !safety.hasHeadClose) score = 0;

	return score;
}

/** Paths worth reading for universal `<html>`/`<head>` detection. */
export function pickGlobalHeadScanCandidates(relativePaths: string[], limit = 48): string[] {
	const paths = relativePaths.map(normalizePath);
	const scored = paths.map((p) => {
		let s = rankHeaderPathPriority(p);
		if (s === 0) {
			if (/head\.sub\.php$/i.test(p)) s = 95;
			else if (HEADER_NAME_HINT_RE.test(p)) s = 75;
			else if (/(^|\/)(inc|include|common|skin|theme|layout)\//i.test(p) && /\.(php|html|htm)$/i.test(p)) {
				s = 40;
			} else if (/(^|\/)index\.(php|html|htm)$/i.test(p)) s = 30;
			else if (/\.(php|html|htm)$/i.test(p) && !isSystemExcludedPath(p)) s = 5;
		}
		// Always read root head.sub.php / head.php so Active Theme Checker (§①) can run
		if (/^head\.sub\.php$/i.test(p) || /^head\.php$/i.test(p)) s = Math.max(s, 120);
		else if (/(^|\/)head\.sub\.php$/i.test(p) || /(^|\/)head\.php$/i.test(p)) s = Math.max(s, 90);
		// Always read root config.php for $config['cf_theme'] (§①)
		if (/^config\.php$/i.test(p)) s = Math.max(s, 110);
		return { p, s };
	});
	return scored
		.filter((x) => x.s > 0)
		.sort((a, b) => b.s - a.s || a.p.length - b.p.length)
		.slice(0, limit)
		.map((x) => x.p);
}

/** Case B: `$config['cf_theme']` set → designated theme head.sub.php */
const THEME_ACTIVE_PRIMARY_SCORE = 200;
/** Case B: root /head.sub.php secondary */
const THEME_ACTIVE_ROOT_SCORE = 150;
/** Case A: cf_theme empty → root /head.sub.php primary */
const THEME_INACTIVE_ROOT_SCORE = 200;
/** Case A: all theme/ files demoted */
const THEME_INACTIVE_THEME_SCORE = 50;

function isGnuboardCms(cms: DetectedCmsDisplay | string): boolean {
	const cmsKey = String(cms);
	return cmsKey === 'Gnuboard' || /영카트|youngcart|gnuboard/i.test(cmsKey);
}

function isThemeTreePath(relativePath: string): boolean {
	return /(^|\/)theme\//i.test(normalizePath(relativePath));
}

function isRootHeadPath(relativePath: string): boolean {
	const p = normalizePath(relativePath);
	return /^head\.sub\.php$/i.test(p) || /^head\.php$/i.test(p);
}

function isNamedThemeHeadPath(relativePath: string, themeName: string): boolean {
	return new RegExp(
		`^theme/${themeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(head\\.sub\\.php|header\\.php)$`,
		'i',
	).test(normalizePath(relativePath));
}

/**
 * Universal Deep Target Header Finder:
 * ① </head> content filter → ② config.php `$config['cf_theme']` Theme Config Check
 * → ③ Strict Priority Scoring (Case A unused vs Case B named theme).
 * Top file receives formatPrimaryHeaderBadge(reason) and isPrimary=true.
 */
export function detectGlobalHeadTargets(opts: {
	relativePaths: string[];
	cms: DetectedCmsDisplay | string;
	/** relativePath → source text (only candidates need be provided). */
	fileContents?: Record<string, string>;
	maxTargets?: number;
}): GlobalHeaderTarget[] {
	const maxTargets = opts.maxTargets ?? 2;
	const paths = opts.relativePaths.map(normalizePath);
	const contents = opts.fileContents || {};
	const byPath = new Map<string, GlobalHeaderTarget>();
	const gnuboard = isGnuboardCms(opts.cms);
	const themeUsage = gnuboard
		? analyzeGnuboardThemeUsage({ relativePaths: paths, fileContents: contents })
		: null;

	const upsert = (target: GlobalHeaderTarget) => {
		const existing = byPath.get(target.path);
		if (existing && (existing.score || 0) >= (target.score || 0)) {
			byPath.set(target.path, {
				...existing,
				...target,
				score: existing.score,
				badge: existing.badge,
				caution: target.caution ?? existing.caution,
			});
			return;
		}
		byPath.set(target.path, target);
	};

	// Case B: explicitly promote theme/{cf_theme}/head.sub.php (config-driven, not G5 stub alone)
	if (themeUsage?.active && themeUsage.themeName) {
		const namedCandidates = [
			`theme/${themeUsage.themeName}/head.sub.php`,
			`theme/${themeUsage.themeName}/header.php`,
			`theme/${themeUsage.themeName}/head.php`,
		];
		for (const candidate of namedCandidates) {
			const hit = paths.find((p) => p.toLowerCase() === candidate.toLowerCase());
			if (!hit) continue;
			const themeSource = contents[hit] ?? contents[normalizePath(hit)];
			const safety = themeSource ? checkInjectionSafety(themeSource) : null;
			if (themeSource && safety && !safety.hasHeadClose && !safety.hasWpHead) continue;
			const pathRank = rankHeaderPathPriority(hit);
			const contentScore = themeSource ? scoreGlobalHeadCandidate(hit, themeSource) : 0;
			upsert({
				path: hit,
				badge: '테마 설정 승격 / config.php cf_theme → theme 헤더',
				score: THEME_ACTIVE_PRIMARY_SCORE,
				pathRank: pathRank || contentScore || 100,
			});
			break; // prefer head.sub.php first in the list
		}
	}

	// Theme path tracking via G5_THEME_PATH — only when Case B (cf_theme set)
	if (themeUsage?.active) {
		for (const [, source] of Object.entries(contents)) {
			const promoted = traceThemeHeaderPaths(source, paths);
			for (const themePath of promoted) {
				if (
					themeUsage.themeName &&
					!new RegExp(`^theme/${themeUsage.themeName}/`, 'i').test(themePath)
				) {
					continue;
				}
				const themeSource = contents[themePath] ?? contents[normalizePath(themePath)];
				const pathRank = rankHeaderPathPriority(themePath);
				const contentScore = themeSource
					? scoreGlobalHeadCandidate(themePath, themeSource)
					: pathRank >= 100
						? 100
						: 0;
				if (
					themeSource &&
					!checkInjectionSafety(themeSource).hasHeadClose &&
					!checkInjectionSafety(themeSource).hasWpHead
				) {
					continue;
				}
				if (contentScore <= 0 && !themeSource) {
					upsert({
						path: themePath,
						badge: '테마 경로 추적 승격 / G5_THEME_PATH → theme 헤더',
						score: THEME_ACTIVE_PRIMARY_SCORE,
						pathRank,
					});
					continue;
				}
				if (contentScore > 0) {
					upsert({
						path: themePath,
						badge: '테마 경로 추적 승격 / 실제 <head> 테마 헤더',
						score: THEME_ACTIVE_PRIMARY_SCORE,
						pathRank,
					});
				}
			}
		}
	}

	const cmsHit = pickGlobalHeaderTarget(paths, opts.cms);
	if (cmsHit) {
		const hitPath = normalizePath(cmsHit.path);
		// Case A: ghost theme/ must not become CMS default
		if (themeUsage && !themeUsage.active && isThemeTreePath(hitPath)) {
			// skip — root head will be scored below
		} else {
			const content = contents[hitPath] ?? contents[cmsHit.path];
			const safety = content ? checkInjectionSafety(content) : null;
			if (content && safety && !safety.hasHeadClose && !safety.hasWpHead) {
				// include-only stub — Case B theme promotions handle the real header
			} else {
				let score = content
					? scoreGlobalHeadCandidate(hitPath, content)
					: rankHeaderPathPriority(hitPath) || 50;
				if (themeUsage && !themeUsage.active && isRootHeadPath(hitPath) && score > 0) {
					score = THEME_INACTIVE_ROOT_SCORE;
				}
				if (
					themeUsage?.active &&
					themeUsage.themeName &&
					isNamedThemeHeadPath(hitPath, themeUsage.themeName) &&
					score > 0
				) {
					score = THEME_ACTIVE_PRIMARY_SCORE;
				} else if (themeUsage?.active && isRootHeadPath(hitPath) && score > 0) {
					score = THEME_ACTIVE_ROOT_SCORE;
				} else if (themeUsage && !themeUsage.active && isThemeTreePath(hitPath) && score > 0) {
					score = THEME_INACTIVE_THEME_SCORE;
				}
				if (score > 0) {
					upsert({
						...cmsHit,
						path: hitPath,
						score,
						pathRank: rankHeaderPathPriority(hitPath),
					});
				}
			}
		}
	}

	// ① Content scan — only files that actually contain </head> or wp_head()
	for (const [path, source] of Object.entries(contents)) {
		const norm = normalizePath(path);
		if (norm === 'config.php' || /\/config\.php$/i.test(norm)) continue;
		const safety = checkInjectionSafety(source);
		if (!safety.hasHeadClose && !safety.hasWpHead) continue;

		let score = scoreGlobalHeadCandidate(norm, source);
		if (score < 50) continue;

		// Strict Priority Scoring from config.php cf_theme
		if (themeUsage && !themeUsage.active) {
			// Case A: root 200 / theme/* 50
			if (isThemeTreePath(norm)) {
				score = THEME_INACTIVE_THEME_SCORE;
			} else if (isRootHeadPath(norm)) {
				score = THEME_INACTIVE_ROOT_SCORE;
			}
		} else if (themeUsage?.active) {
			// Case B: theme/{cf_theme}/head.sub.php 200 / root head.sub.php 150
			if (themeUsage.themeName && isNamedThemeHeadPath(norm, themeUsage.themeName)) {
				score = THEME_ACTIVE_PRIMARY_SCORE;
			} else if (isRootHeadPath(norm)) {
				score = THEME_ACTIVE_ROOT_SCORE;
			} else if (isThemeTreePath(norm)) {
				// Other theme folders = demoted even when one theme is live
				score = THEME_INACTIVE_THEME_SCORE;
			}
		}

		upsert({
			path: norm,
			badge:
				rankHeaderPathPriority(norm) >= 100
					? '자동 탐지됨 / 테마 공통 헤더 (</head> 검증)'
					: score >= 90
						? '자동 탐지됨 / 공통 헤더 (</head> 콘텐츠 스캔)'
						: '자동 탐지됨 / 헤더 후보 (</head> 감지)',
			score,
			pathRank: rankHeaderPathPriority(norm),
			caution: null,
		});
	}

	// Case A: keep theme/ as score-50 secondaries (do not delete — demote only)
	if (themeUsage && !themeUsage.active) {
		for (const [key, target] of [...byPath.entries()]) {
			if (isThemeTreePath(key)) {
				byPath.set(key, { ...target, score: THEME_INACTIVE_THEME_SCORE });
			}
		}
	}

	const ranked = [...byPath.values()].sort(
		(a, b) => (b.score || 0) - (a.score || 0) || (b.pathRank || 0) - (a.pathRank || 0),
	);

	const primaryBadge = formatPrimaryHeaderBadge(themeUsage?.reason ?? null);

	if (ranked.length === 0) {
		// Fallback: name-only secondaries (still prefer real path ranks)
		const fallbacks: GlobalHeaderTarget[] = [];
		const secondary = firstMatch(
			paths,
			themeUsage && !themeUsage.active
				? [
						/^head\.sub\.php$/i,
						/^head\.php$/i,
						/(^|\/)inc\/head\.php$/i,
						/(^|\/)include\/head\.php$/i,
						/(^|\/)common\/header\.php$/i,
						/(^|\/)common\/head\.php$/i,
						/(^|\/)header\.html$/i,
						/(^|\/)index\.html$/i,
						/(^|\/)main\.html$/i,
					]
				: themeUsage?.active && themeUsage.themeName
					? [
							new RegExp(
								`^theme/${themeUsage.themeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/head\\.sub\\.php$`,
								'i',
							),
							/^head\.sub\.php$/i,
							/(^|\/)inc\/head\.php$/i,
							/(^|\/)include\/head\.php$/i,
							/(^|\/)common\/header\.php$/i,
							/(^|\/)common\/head\.php$/i,
							/(^|\/)header\.html$/i,
							/(^|\/)index\.html$/i,
							/(^|\/)main\.html$/i,
						]
					: [
							/theme\/[^/]+\/head\.sub\.php$/i,
							/^head\.sub\.php$/i,
							/(^|\/)inc\/head\.php$/i,
							/(^|\/)include\/head\.php$/i,
							/(^|\/)common\/header\.php$/i,
							/(^|\/)common\/head\.php$/i,
							/(^|\/)header\.html$/i,
							/(^|\/)index\.html$/i,
							/(^|\/)main\.html$/i,
						],
		);
		if (secondary) {
			const secondaryPath = normalizePath(secondary);
			let score = rankHeaderPathPriority(secondaryPath) || 40;
			if (themeUsage && !themeUsage.active && isRootHeadPath(secondaryPath)) {
				score = THEME_INACTIVE_ROOT_SCORE;
			} else if (
				themeUsage?.active &&
				themeUsage.themeName &&
				isNamedThemeHeadPath(secondaryPath, themeUsage.themeName)
			) {
				score = THEME_ACTIVE_PRIMARY_SCORE;
			} else if (themeUsage?.active && isRootHeadPath(secondaryPath)) {
				score = THEME_ACTIVE_ROOT_SCORE;
			} else if (themeUsage && !themeUsage.active && isThemeTreePath(secondaryPath)) {
				score = THEME_INACTIVE_THEME_SCORE;
			}
			fallbacks.push({
				path: secondaryPath,
				badge: '자동 선택됨 / 공통 include 헤더 후보',
				score,
				pathRank: rankHeaderPathPriority(secondaryPath),
			});
		}
		if (fallbacks.length > 0) {
			fallbacks[0].isPrimary = true;
			fallbacks[0].badge = primaryBadge;
		}
		return fallbacks.slice(0, maxTargets);
	}

	const top = ranked.slice(0, maxTargets).map((t, i) =>
		i === 0
			? { ...t, isPrimary: true, badge: primaryBadge }
			: { ...t, isPrimary: false },
	);
	return top;
}

export function checkInjectionSafety(source: string): InjectionSafety {
	const hasHeadOpen = HEAD_OPEN_RE.test(source);
	const hasHeadClose = HEAD_CLOSE_RE.test(source);
	const hasWpHead = WP_HEAD_RE.test(source);
	const hasHtmlTag = HTML_TAG_RE.test(source);

	if (hasHeadClose) {
		return {
			hasHeadOpen,
			hasHeadClose,
			hasWpHead,
			hasHtmlTag,
			safe: true,
			anchor: 'head-close',
			warning: null,
		};
	}
	if (hasWpHead) {
		return {
			hasHeadOpen,
			hasHeadClose,
			hasWpHead,
			hasHtmlTag,
			safe: true,
			anchor: 'wp_head',
			warning: '</head> 없음 — wp_head() 호출 직전에 주입합니다.',
		};
	}
	if (hasHeadOpen) {
		return {
			hasHeadOpen,
			hasHeadClose,
			hasWpHead,
			hasHtmlTag,
			safe: true,
			anchor: 'head-open',
			warning: '</head> 없음 — <head> 직후에 주입합니다.',
		};
	}
	return {
		hasHeadOpen,
		hasHeadClose,
		hasWpHead,
		hasHtmlTag,
		safe: false,
		anchor: 'none',
		warning:
			'<head> / </head> 태그를 찾지 못했습니다. 레이아웃 전용 파일이거나 시스템 파일일 수 있습니다.',
	};
}

/** Strip prior REDUE inject blocks so re-patch stays idempotent (1회 통합 주입). */
export function stripPriorRedueInject(source: string): string {
	return stripRedueSchemaBlocks(source);
}

const PHP_OPEN_RE = /<\?php\b/i;

/** Remove outer `<?php` / `?>` so a snippet can nest inside an existing PHP open tag. */
export function unwrapPhpSnippet(snippet: string): string {
	let s = String(snippet || '').trim();
	if (/^<\?php\b/i.test(s)) {
		s = s.replace(/^<\?php\s*/i, '');
	}
	if (/\?>\s*$/.test(s)) {
		s = s.replace(/\?>\s*$/, '');
	}
	return s.trimEnd() + '\n';
}

/** True when a top-priority PHP block is the v26 calc-only canonical engine (`$exact_canonical_url`). */
const EXACT_CANONICAL_ASSIGN_RE = /\$exact_canonical_url\s*=/;

/**
 * v22 Top-Priority: insert engine body immediately after the first `<?php`.
 * Strips prior REDUE blocks + stale canonical/og:url tags (v26 has no runtime ob_start()
 * cleaner anymore, so this static pass is what keeps canonical/og:url from duplicating),
 * then statically writes `defer` onto every `<script src>` in the file. Never deletes any
 * other existing HTML, includes, or meta tags.
 */
export function injectAfterFirstPhpOpen(
	source: string,
	snippet: string,
): { ok: boolean; result: string; anchor: InjectionAnchor; warning: string | null } {
	const cleaned = stripHardcodedCanonicalTags(stripPriorRedueInject(source));
	const phpOpen = PHP_OPEN_RE.exec(cleaned);
	if (!phpOpen) {
		return {
			ok: false,
			result: source,
			anchor: 'none',
			warning: '첫 <?php 태그를 찾지 못했습니다.',
		};
	}

	let topBlock = unwrapPhpSnippet(snippet);
	let headCall: string | null = null;
	// Hybrid controller must not echo JSON-LD before <!doctype> — keep call before </head>
	const controllerCallRe = /\n?[ \t]*redue_dynamic_schema_controller\s*\(\s*\)\s*;[ \t]*/g;
	if (controllerCallRe.test(topBlock)) {
		controllerCallRe.lastIndex = 0;
		topBlock = topBlock.replace(controllerCallRe, '\n');
		headCall = '<?php redue_dynamic_schema_controller(); ?>\n';
	}
	// v32 Type A calc-only engine: it never echoes anything itself, so the actual
	// <link rel="canonical">/og:url tags must be inserted separately, right after charset
	// (Bot Optimized Top Position — before large CSS that pushes tags past First Chunk).
	const isDirectCanonicalCalcOnly =
		!headCall &&
		(EXACT_CANONICAL_ASSIGN_RE.test(topBlock) || /\$final_canonical_url\s*=/.test(topBlock)) &&
		!/<link\b/i.test(topBlock);

	const insertAt = phpOpen.index + phpOpen[0].length;
	let result =
		cleaned.slice(0, insertAt) + '\n' + topBlock.trimEnd() + '\n' + cleaned.slice(insertAt);

	if (headCall) {
		if (/<\/head>/i.test(result)) {
			result = injectBeforeLastHeadClose(result, headCall);
		} else if (WP_HEAD_RE.test(result)) {
			result = result.replace(WP_HEAD_RE, (match) => `${headCall}${match}`);
		}
	} else if (isDirectCanonicalCalcOnly && (CHARSET_META_RE.test(result) || HEAD_OPEN_RE.test(result))) {
		result = injectAfterCharsetOrHead(result, buildCanonicalLinkHtmlTag());
	}

	// v26: no ob_start() whole-document defer scanner anymore — rewrite <script src> statically.
	result = addDeferToScriptTagsInSource(result);

	return { ok: true, result, anchor: 'php-open-top', warning: null };
}

/**
 * Prefer v22 top-priority inject after the first `<?php` (top of file, before any HTML output).
 * Falls back to `</head>` / wp_head() / `<head>` for non-PHP templates.
 * v26: strips stale canonical/og:url tags at build time (no runtime ob_start() cleaner exists
 * anymore) and statically writes `defer` onto every `<script src>` in the final result.
 */
export function injectBeforeClosingHead(
	source: string,
	snippet: string,
): { ok: boolean; result: string; anchor: InjectionAnchor; warning: string | null } {
	const cleaned = stripPriorRedueInject(source);
	if (PHP_OPEN_RE.test(cleaned)) {
		return injectAfterFirstPhpOpen(cleaned, snippet);
	}

	const safety = checkInjectionSafety(stripHardcodedCanonicalTags(cleaned));
	const safeSource = stripHardcodedCanonicalTags(cleaned);
	const block = snippet.trimEnd() + '\n';

	if (safety.anchor === 'head-close') {
		const result = addDeferToScriptTagsInSource(safeSource.replace(HEAD_CLOSE_RE, `${block}</head>`));
		return { ok: true, result, anchor: 'head-close', warning: null };
	}
	if (safety.anchor === 'wp_head') {
		const result = addDeferToScriptTagsInSource(
			safeSource.replace(WP_HEAD_RE, (match) => `${block}${match}`),
		);
		return { ok: true, result, anchor: 'wp_head', warning: safety.warning };
	}
	if (safety.anchor === 'head-open') {
		const result = addDeferToScriptTagsInSource(
			safeSource.replace(HEAD_OPEN_RE, (match) => `${match}\n${block}`),
		);
		return { ok: true, result, anchor: 'head-open', warning: safety.warning };
	}
	return {
		ok: false,
		result: source,
		anchor: 'none',
		warning: safety.warning,
	};
}

function findLocalFileForUrlRef(
	ref: CollectedUrlRef,
	relativePaths: string[],
): { relativePath: string; mappedUrlPath: string; mappingRule: MappedSourceFile['mappingRule'] } | null {
	const candidates = pathnameToLocalCandidates(ref.pathname);
	const normalized = relativePaths.map(normalizePath);
	const lowerMap = new Map(normalized.map((p) => [p.toLowerCase(), p]));

	const tryCandidates = (
		list: string[],
		rule: MappedSourceFile['mappingRule'],
	): { relativePath: string; mappedUrlPath: string; mappingRule: MappedSourceFile['mappingRule'] } | null => {
		for (const cand of list) {
			const hit = lowerMap.get(cand.toLowerCase());
			if (hit) return { relativePath: hit, mappedUrlPath: ref.hrefPath, mappingRule: rule };
		}
		for (const cand of list) {
			const suffix = cand.toLowerCase();
			const hit = normalized.find(
				(p) => p.toLowerCase().endsWith('/' + suffix) || p.toLowerCase() === suffix,
			);
			if (hit) return { relativePath: hit, mappedUrlPath: ref.hrefPath, mappingRule: rule };
		}
		return null;
	};

	// Rule 1: exact extension path
	const hasExt = /\.(php|html|htm)$/i.test(ref.pathname);
	if (hasExt) {
		const exact = tryCandidates(
			[ref.pathname.replace(/^\//, '')],
			Object.keys(ref.query).length > 0 ? 'backend-template' : 'exact',
		);
		if (exact) return exact;
	}

	// Rule 2: clean URL variants
	const clean = tryCandidates(candidates, hasExt ? 'exact' : 'clean-url');
	if (clean) {
		if (Object.keys(ref.query).length > 0 || isBackendTemplatePath(clean.relativePath)) {
			return { ...clean, mappingRule: 'backend-template' };
		}
		return clean;
	}

	return null;
}

/** Map audit issue codes → schema type labels for list UI. */
export function schemaTypesFromIssueCodes(codes: string[] | undefined): {
	global: string[];
	page: string[];
} {
	const global = new Set<string>(GLOBAL_SCHEMA_DEFAULT);
	const page = new Set<string>(PAGE_SCHEMA_DEFAULT);
	for (const raw of codes || []) {
		const code = raw.toUpperCase();
		if (code.includes('ORGANIZATION') || code === 'SCHEMA_MISSING') global.add('Organization');
		if (code.includes('WEBSITE') || code.includes('NAV')) {
			global.add('WebSite');
			global.add('SiteNavigationElement');
		}
		if (code.includes('FAQ') || code.includes('HOWTO')) page.add('FAQPage');
		if (code.includes('ARTICLE') || code.includes('NEWS')) page.add('Article');
		if (code.includes('PRODUCT') || code.includes('OFFER')) page.add('Product');
		if (code.includes('BREADCRUMB')) page.add('BreadcrumbList');
		if (code.includes('PERSON') || code.includes('EEAT')) page.add('Person');
		if (code.includes('CONTACT')) page.add('ContactPage');
		if (code.includes('ABOUT')) page.add('AboutPage');
		if (code.includes('OG') || code.includes('META') || code.includes('CANONICAL')) {
			global.add('OpenGraph');
			global.add('Meta');
		}
	}
	return { global: [...global], page: [...page] };
}

function formatGlobalNatureBadge(schemas: string[]): string {
	const hasOrg = schemas.includes('Organization');
	const hasMeta = schemas.includes('OpenGraph') || schemas.includes('Meta');
	const hasWeb = schemas.includes('WebSite');
	const parts: string[] = [];
	if (hasOrg) parts.push('Organization');
	if (hasWeb) parts.push('WebSite');
	if (hasMeta) parts.push('Meta');
	if (parts.length === 0) parts.push(...schemas.slice(0, 2));
	return `[공통 ${parts.join(' / ')} 주입]`;
}

function formatPageNatureBadge(schemas: string[]): string {
	const preferred = ['AboutPage', 'ContactPage', 'FAQPage', 'Article', 'Product', 'WebPage'];
	const picked = preferred.filter((s) => schemas.includes(s));
	const label = (picked.length > 0 ? picked : schemas).slice(0, 2).join(' / ');
	return `[${label || 'Page'} Schema 주입]`;
}

/**
 * Build 3-group mapping: global header / crawled URL pages / other sources.
 */
export function buildSourceMapping(opts: {
	sourceFiles: LocalScannedFile[] | { relativePath: string }[];
	cms: DetectedCmsDisplay | string;
	auditUrlPaths: string[];
	/** Optional richer URL refs (preferred over auditUrlPaths). */
	collectedUrls?: CollectedUrlRef[];
	/** Optional audit issue codes to enrich schema summary chips. */
	issueCodes?: string[];
	/** Optional file contents for universal <html>/<head> global detection. */
	fileContents?: Record<string, string>;
}): SourceMappingResult {
	const paths = opts.sourceFiles.map((f) => normalizePath(f.relativePath));
	const globalTargetsDetected = detectGlobalHeadTargets({
		relativePaths: paths,
		cms: opts.cms,
		fileContents: opts.fileContents,
		maxTargets: 2,
	});
	const globalPathSet = new Set(globalTargetsDetected.map((g) => g.path));
	const schemas = schemaTypesFromIssueCodes(opts.issueCodes);

	const urlRefs: CollectedUrlRef[] =
		opts.collectedUrls && opts.collectedUrls.length > 0
			? opts.collectedUrls
			: opts.auditUrlPaths.map((p) => parseCollectedUrl(p)).filter((r): r is CollectedUrlRef => Boolean(r));

	type PageHit = {
		urlPath: string;
		query: Record<string, string>;
		mappingRule: MappedSourceFile['mappingRule'];
	};
	const pageMapped = new Map<string, PageHit>();

	for (const ref of urlRefs) {
		const hit = findLocalFileForUrlRef(ref, paths);
		if (!hit) continue;
		if (globalPathSet.has(hit.relativePath)) continue;
		// Allow backend templates even if they look "system"; block true system paths
		if (isSystemExcludedPath(hit.relativePath) && !isBackendTemplatePath(hit.relativePath)) continue;
		const prev = pageMapped.get(hit.relativePath);
		// Prefer the URL that keeps query context when merging duplicates
		if (prev && Object.keys(prev.query).length > 0 && Object.keys(ref.query).length === 0) continue;
		pageMapped.set(hit.relativePath, {
			urlPath: hit.mappedUrlPath,
			query: ref.query,
			mappingRule: hit.mappingRule,
		});
	}

	const files: MappedSourceFile[] = [];
	let excludedSystemCount = 0;
	const primaryHeader = globalTargetsDetected.find((g) => g.isPrimary) || globalTargetsDetected[0];
	const primaryIsPhp = primaryHeader ? /\.(php|phtml)$/i.test(primaryHeader.path) : false;
	// Dynamic PHP controller = 1회 통합 주입 → page files stay listed but not auto-checked for schema
	const dynamicPhpUnified = primaryIsPhp;

	for (const p of paths) {
		const system = isSystemExcludedPath(p);
		if (system) excludedSystemCount += 1;

		const globalMeta = globalTargetsDetected.find((g) => g.path === p);
		if (globalMeta) {
			const schemaSummary = dynamicPhpUnified
				? ['DynamicPHP', 'Organization', 'WebSite', '@graph']
				: [...schemas.global];
			const isPrimary = Boolean(globalMeta.isPrimary);
			files.push({
				relativePath: p,
				group: 'global',
				autoChecked: isPrimary || !dynamicPhpUnified,
				recommended: true,
				badge: globalMeta.badge,
				natureBadge: isPrimary
					? '[동적 PHP 스키마 컨트롤러 1회 주입]'
					: formatGlobalNatureBadge(schemaSummary),
				schemaSummary,
				caution: globalMeta.caution || null,
				priorityScore: globalMeta.score,
				isPrimaryHeader: isPrimary,
			});
			continue;
		}

		const mapped = pageMapped.get(p);
		if (mapped) {
			const sourceText = opts.fileContents?.[p] || opts.fileContents?.[normalizePath(p)];
			const schemaSummary = inferPageSchemaSummary(
				p,
				mapped.urlPath,
				mapped.query,
				schemas.page,
				sourceText,
			);
			files.push({
				relativePath: p,
				group: 'page',
				autoChecked: !dynamicPhpUnified,
				recommended: !dynamicPhpUnified,
				badge: dynamicPhpUnified
					? '공통 헤더 동적 PHP에 매핑됨 · 개별 주입 불필요 (수동 선택 가능)'
					: '자동 선택됨 / 크롤 URL 1:1 매핑 · 개별 Schema 주입',
				natureBadge: formatPageNatureBadge(schemaSummary),
				schemaSummary,
				mappedUrlPath: mapped.urlPath,
				urlQuery: mapped.query,
				mappingRule: mapped.mappingRule,
			});
			continue;
		}

		const isLayoutHeadPhp =
			/(^|\/)head\.php$/i.test(p) &&
			(String(opts.cms) === 'Gnuboard' || /gnuboard|youngcart|영카트/i.test(String(opts.cms)));

		files.push({
			relativePath: p,
			group: 'other',
			autoChecked: false,
			recommended: false,
			badge: system
				? '시스템/백엔드 — 기본 체크 해제'
				: isLayoutHeadPhp
					? '레이아웃 파일 — 일반 주입 주의 (head.sub.php 우선)'
					: '기본 체크 해제 / 필요시 수동 선택',
			natureBadge: system ? '[시스템]' : '[기타]',
			schemaSummary: [],
			caution: isLayoutHeadPhp
				? '그누보드 head.php는 레이아웃 include입니다. 핵심 헤더는 head.sub.php를 사용하세요.'
				: null,
		});
	}

	const globalTargets = [
		...files.filter((f) => f.group === 'global' && f.isPrimaryHeader),
		...files.filter((f) => f.group === 'global' && !f.isPrimaryHeader),
	];
	const pageTargets = files.filter((f) => f.group === 'page');
	const otherFiles = files.filter((f) => f.group === 'other');
	const mainTargets = [...globalTargets, ...pageTargets];
	const globalHeaderPaths = globalTargets.map((f) => f.relativePath);

	const primaryPath =
		globalTargets.find((f) => f.isPrimaryHeader)?.relativePath ||
		primaryHeader?.path ||
		globalHeaderPaths[0] ||
		null;
	const summaryLines = [
		primaryPath
			? `${primaryHeader?.badge || PRIMARY_HEADER_BADGE}: ${primaryPath}${primaryHeader?.score != null ? ` (score ${primaryHeader.score})` : ''}`
			: '공통 헤더 타겟: 미검출 (수동 선택 필요)',
		globalHeaderPaths.length > 1
			? `공통 헤더 후보: ${globalHeaderPaths.join(', ')}`
			: null,
		dynamicPhpUnified
			? '동적 PHP 스키마 컨트롤러 — 최우선 공통 헤더 1개에 전체 메인/서브페이지 통합 주입'
			: `크롤 URL 매핑 서브페이지: ${pageTargets.length}개 자동 선택`,
		`실제 웹 메뉴 매핑 파일: ${pageTargets.length}개 · 기타 스캔 소스 ${otherFiles.length}개 (접힘)`,
		excludedSystemCount > 0 ? `시스템 경로 표시: ${excludedSystemCount}개` : null,
	].filter(Boolean) as string[];

	return {
		files,
		mainTargets,
		globalTargets,
		pageTargets,
		otherFiles,
		globalHeaderPath: primaryPath,
		globalHeaderPaths,
		mappedPageCount: pageTargets.length,
		excludedSystemCount,
		mainTargetCount: mainTargets.length,
		summaryLines,
	};
}

export function inferPageSchemaSummary(
	relativePath: string,
	urlPath: string,
	query: Record<string, string> | undefined,
	base: string[],
	/** Optional local source text for AI-style context labeling. */
	sourceText?: string,
): string[] {
	const queryText = Object.entries(query || {})
		.map(([k, v]) => `${k}=${v}`)
		.join(' ');
	const snippet = (sourceText || '').slice(0, 4000).toLowerCase();
	const hay = `${relativePath} ${urlPath} ${queryText} ${snippet}`.toLowerCase();
	const out = new Set(base);

	// Contact first (문의 forms) — before FAQ so 문의폼 ≠ FAQPage
	if (
		/contact|inquiry|inquire|문의|상담|견적|예약|write_form|mailform|name=\"(name|email|tel|phone)\"|type=\"email\"/.test(
			hay,
		)
	) {
		out.add('ContactPage');
		out.delete('FAQPage');
	}
	// Dedicated FAQ landing only — never from board.php?bo_table=qa/faq/qna
	if (
		!/board\.php/i.test(hay) &&
		(/(?:^|[\s/])faq(?:\.php|[\s/]|$)/.test(hay) || /자주.?묻는|자주하는.?질문/.test(hay))
	) {
		out.add('FAQPage');
	}
	if (/news|blog|article|보도|뉴스|notice|bo_table=news|bo_table=blog/.test(hay)) {
		out.add('Article');
	}
	if (/product|item|goods|shop|상품|bo_table=item/.test(hay)) {
		out.add('Product');
	}
	if (/about|company|intro|회사|소개|history|인사말|개요|연혁/.test(hay)) {
		out.add('AboutPage');
	}
	// Board list templates always CollectionPage — FAQPage / Article ban on board.php?bo_table=*
	if (
		(isBackendTemplatePath(relativePath) && /board\.php/i.test(relativePath)) ||
		/board\.php/i.test(urlPath)
	) {
		out.delete('FAQPage');
		out.delete('Article');
		out.delete('MedicalWebPage');
		out.add('CollectionPage');
	}

	return [...out];
}

function jsonLdScript(data: Record<string, unknown>): string {
	return `<script type="application/ld+json">\n${JSON.stringify(data)}\n</script>`;
}

/** Default REDUE JSON-LD / meta injection block for preview (global-oriented). */
export function buildDefaultInjectSnippet(opts: {
	cmsType: string;
	targetUrl?: string;
	siteName?: string;
}): string {
	return buildInjectSnippetForMappedFile(
		{
			relativePath: 'header',
			group: 'global',
			schemaSummary: GLOBAL_SCHEMA_DEFAULT,
		},
		opts,
	);
}

/** Per-target typed injection: global vs page schema roles. */
export function buildInjectSnippetForMappedFile(
	file: Pick<MappedSourceFile, 'group' | 'schemaSummary' | 'mappedUrlPath' | 'relativePath'>,
	opts: {
		cmsType: string;
		targetUrl?: string;
		siteName?: string;
	},
): string {
	const site = opts.siteName || 'Site';
	const origin = (() => {
		try {
			return opts.targetUrl ? new URL(opts.targetUrl).origin : 'https://example.com';
		} catch {
			return 'https://example.com';
		}
	})();
	const pageUrl = file.mappedUrlPath
		? `${origin}${file.mappedUrlPath.startsWith('/') ? '' : '/'}${file.mappedUrlPath}`
		: opts.targetUrl || origin;

	const blocks: string[] = [`<!-- REDUE SEO/GEO Auto-Inject (${opts.cmsType} · ${file.group}) -->`];

	if (file.group === 'global') {
		if (file.schemaSummary.includes('Organization') || file.schemaSummary.length === 0) {
			blocks.push(
				jsonLdScript({
					'@context': 'https://schema.org',
					'@type': 'Organization',
					name: site,
					url: origin,
				}),
			);
		}
		if (file.schemaSummary.includes('WebSite')) {
			blocks.push(
				jsonLdScript({
					'@context': 'https://schema.org',
					'@type': 'WebSite',
					name: site,
					url: origin,
					potentialAction: {
						'@type': 'SearchAction',
						target: `${origin}/?s={search_term_string}`,
						'query-input': 'required name=search_term_string',
					},
				}),
			);
		}
		if (file.schemaSummary.includes('SiteNavigationElement')) {
			blocks.push(
				jsonLdScript({
					'@context': 'https://schema.org',
					'@type': 'ItemList',
					itemListElement: [
						{
							'@type': 'SiteNavigationElement',
							name: site,
							url: origin,
						},
					],
				}),
			);
		}
		if (file.schemaSummary.includes('OpenGraph') || file.schemaSummary.includes('Meta')) {
			blocks.push(`<meta property="og:url" content="${escapeAttr(origin)}" />`);
			blocks.push(`<meta property="og:type" content="website" />`);
			blocks.push(`<meta property="og:site_name" content="${escapeAttr(site)}" />`);
		}
		/* v15 Universal Auto-Fix — static HTML fallback: Article (+ ISO dates) + FAQPage on global header */
		const isoNow = new Date().toISOString();
		const isoPublished = `${new Date().getUTCFullYear()}-01-01T00:00:00+09:00`;
		blocks.push(
			jsonLdScript({
				'@context': 'https://schema.org',
				'@type': 'Article',
				headline: site,
				description: `${site} 공식 안내 및 서비스 소개`,
				url: origin,
				datePublished: isoPublished,
				dateModified: isoNow,
				author: { '@type': 'Organization', name: site },
				publisher: { '@type': 'Organization', name: site, url: origin },
			}),
		);
		blocks.push(
			jsonLdScript({
				'@context': 'https://schema.org',
				'@type': 'FAQPage',
				mainEntity: [
					{
						'@type': 'Question',
						name: `${site} 관련 안내 및 상담은 어떻게 신청하나요?`,
						acceptedAnswer: {
							'@type': 'Answer',
							text: `${site} 공식 웹사이트(${origin})의 안내 메뉴와 문의 창구를 통해 상세한 전문 안내를 받으실 수 있습니다.`,
						},
					},
					{
						'@type': 'Question',
						name: `${site} 서비스 이용 문의처는 어디인가요?`,
						acceptedAnswer: {
							'@type': 'Answer',
							text: `웹사이트 상단 고객센터 및 온라인 게시판을 통해 언제든지 문의 남겨주시면 빠르게 답변해 드립니다.`,
						},
					},
				],
			}),
		);
	} else {
		const types = file.schemaSummary.filter((t) =>
			[
				'AboutPage',
				'ContactPage',
				'CollectionPage',
				'FAQPage',
				'Article',
				'Product',
				'WebPage',
			].includes(t),
		);
		const primary = types[0] || 'WebPage';

		if (primary === 'FAQPage') {
			blocks.push(
				jsonLdScript({
					'@context': 'https://schema.org',
					'@type': 'FAQPage',
					mainEntity: [
						{
							'@type': 'Question',
							name: '{{ 질문 }}',
							acceptedAnswer: { '@type': 'Answer', text: '{{ 답변 }}' },
						},
					],
				}),
			);
		} else if (primary === 'CollectionPage') {
			blocks.push(
				jsonLdScript({
					'@context': 'https://schema.org',
					'@type': 'CollectionPage',
					name: site,
					url: pageUrl,
					isPartOf: { '@type': 'WebSite', url: origin },
				}),
			);
		} else if (primary === 'ContactPage' || primary === 'AboutPage') {
			blocks.push(
				jsonLdScript({
					'@context': 'https://schema.org',
					'@type': primary,
					name: site,
					url: pageUrl,
					isPartOf: { '@type': 'WebSite', url: origin },
				}),
			);
		} else if (primary === 'Article') {
			const isoNow = new Date().toISOString();
			const isoPublished = `${new Date().getUTCFullYear()}-01-01T00:00:00+09:00`;
			blocks.push(
				jsonLdScript({
					'@context': 'https://schema.org',
					'@type': 'Article',
					headline: '{{ 제목 }}',
					url: pageUrl,
					datePublished: isoPublished,
					dateModified: isoNow,
					author: { '@type': 'Organization', name: site },
				}),
			);
		} else if (primary === 'Product') {
			blocks.push(
				jsonLdScript({
					'@context': 'https://schema.org',
					'@type': 'Product',
					name: '{{ 상품명 }}',
					url: pageUrl,
				}),
			);
		} else {
			blocks.push(
				jsonLdScript({
					'@context': 'https://schema.org',
					'@type': 'WebPage',
					name: site,
					url: pageUrl,
				}),
			);
		}

		if (file.schemaSummary.includes('BreadcrumbList')) {
			blocks.push(
				jsonLdScript({
					'@context': 'https://schema.org',
					'@type': 'BreadcrumbList',
					itemListElement: [
						{ '@type': 'ListItem', position: 1, name: 'Home', item: origin },
						{ '@type': 'ListItem', position: 2, name: basename(file.relativePath), item: pageUrl },
					],
				}),
			);
		}

		blocks.push(`<link rel="canonical" href="${escapeAttr(pageUrl)}" />`);
	}

	/* v14 JS Alt Auto-Fixer + v15 JS Defer Auto-Fixer — common header / page inject bottom */
	blocks.push(buildAltAutoFixerScriptTag(site));
	blocks.push(buildJsDeferAutoFixerScriptTag());
	blocks.push('<!-- /REDUE SEO/GEO Auto-Inject -->');
	return blocks.join('\n');
}

function escapeAttr(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
