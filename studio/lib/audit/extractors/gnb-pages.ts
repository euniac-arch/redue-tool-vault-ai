/**
 * Header-container full-scan menu collector.
 * Collects every operational <a> inside the top header — class names like
 * #gnb / #lnb / .depth2 / .select-nav do not gate discovery.
 */

import type { CheerioAPI } from 'cheerio';

export const GNB_PAGE_LIMIT = 120;

/** Outermost chrome that owns the site menu. Scanned first. */
export const HEADER_CONTAINER_SELECTORS = [
	'header',
	'#header',
	'.header',
	'#hd',
	'.hd',
	'#head',
	'.head_wrap',
] as const;

/** Nav islands used when a theme has no <header> wrapper. */
export const HEADER_NAV_SELECTORS = [
	'#lnb',
	'.lnb',
	'#gnb',
	'.gnb',
	'.nav',
	'nav',
	'.select-nav',
	'.depth1',
	'.gnb_1dul',
	'#hd_menu',
	'.hd_menu',
	'.top_menu',
	'.main_menu',
	'.nav-menu',
	'.navbar-nav',
	'.navbar',
] as const;

/** @deprecated Use HEADER_* selectors — kept for callers that still import this name. */
export const GNB_CONTAINER_SELECTORS = [...HEADER_CONTAINER_SELECTORS, ...HEADER_NAV_SELECTORS];

const SKIP_HREF_RE = /^(javascript:|#|mailto:|tel:|sms:|data:)/i;
const ACCOUNT_PATH_RE =
	/\/(login|logout|register|admin|adm|member_confirm|password_lost|member_leave|password)\.php(?:\?|$)/i;
const ACCOUNT_DIR_RE = /\/(login|logout|register|admin|adm)\b/i;
const SKIP_NAME_RE = /^(home|메인|로그인|logout|회원가입|글쓰기|비밀번호\s*찾기|회원정보\s*수정)$/i;

export type GnbPageLink = {
	name: string;
	url: string;
	menu1: string;
	menu2?: string;
	menu3?: string;
	parent?: string;
	depth: 1 | 2 | 3;
};

function cleanLabel(raw: string): string {
	return String(raw || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function sameHost(a: string, b: string): boolean {
	return a.replace(/^www\./i, '').toLowerCase() === b.replace(/^www\./i, '').toLowerCase();
}

export function formatGnbHierarchyTitle(menu1?: string, menu2?: string, menu3?: string): string {
	const parts = [menu1, menu2, menu3]
		.map((v) => cleanLabel(v || ''))
		.filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i);
	return parts.join(' > ');
}

/** Same-origin href → site-relative path + query. Drops hash / js / external / account pages. */
export function normalizeGnbHref(
	href: string,
	pageUrl: string,
	origin: string,
): { hrefPath: string; path: string; search: string } | null {
	const raw = String(href || '').trim();
	if (!raw || SKIP_HREF_RE.test(raw)) return null;
	try {
		const abs = new URL(raw, pageUrl);
		if (!sameHost(abs.hostname, new URL(origin).hostname)) return null;
		if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return null;
		const path = abs.pathname || '/';
		const search = abs.search || '';
		const hay = `${path}${search}`;
		if (ACCOUNT_PATH_RE.test(hay) || ACCOUNT_DIR_RE.test(hay)) return null;
		if (/\.(css|js|png|jpe?g|gif|svg|webp|ico|pdf|zip|woff2?)$/i.test(path)) return null;
		return { path, search, hrefPath: search ? `${path}${search}` : path };
	} catch {
		return null;
	}
}

function isHomepageHref(hrefPath: string): boolean {
	const [path, search] = hrefPath.split('?');
	if (search) return false;
	return path === '/' || path === '' || /^\/index\.(php|html?|htm)$/i.test(path || '');
}

function isAccountLabel(name: string): boolean {
	return SKIP_NAME_RE.test(name);
}

function pushUnique(out: GnbPageLink[], seen: Map<string, number>, item: GnbPageLink): void {
	if (!item.url || !item.name) return;
	if (isAccountLabel(item.name)) return;
	if (item.name.length > 60) return;
	if (isHomepageHref(item.url)) return;
	const key = item.url.toLowerCase();
	const prevIdx = seen.get(key);
	if (prevIdx != null) {
		const prev = out[prevIdx];
		if (prev && item.depth > prev.depth) out[prevIdx] = item;
		return;
	}
	seen.set(key, out.length);
	out.push(item);
}

function looksLikeHrefLabel(value: string): boolean {
	const text = cleanLabel(value);
	if (!text) return true;
	return /https?:\/\/|\/theme\/|\/bbs\/|\.php(?:\?|$)|[?&]bo_table=/i.test(text);
}

function ownNodeLabel($: CheerioAPI, el: Parameters<CheerioAPI>[0] | undefined): string {
	if (!el) return '';
	const $el = $(el);
	const titled = $el.attr('title') || $el.attr('aria-label') || '';
	const imgAlt = $el.find('img').first().attr('alt') || $el.find('img').first().attr('title') || '';
	const clone = $el.clone();
	clone.find('ul, ol, .depth2, .gnb_2dul, .submenu, .dropdown-menu, .sub').remove();
	const text = cleanLabel(clone.text());
	const picked = [text, cleanLabel(titled), cleanLabel(imgAlt)].find((v) => v && !looksLikeHrefLabel(v));
	return picked || '';
}

function firstLabelInLi($: CheerioAPI, li: Parameters<CheerioAPI>[0] | undefined): string {
	if (!li) return '';
	const $li = $(li);
	const topA = $li.children('a').first().length ? $li.children('a').first() : $li.find('> a').first();
	if (topA.length) return ownNodeLabel($, topA.get(0));
	const clone = $li.clone();
	clone.children('ul, ol, .depth2, .gnb_2dul, .submenu, .dropdown-menu, div').remove();
	return cleanLabel(clone.text());
}

function inferMenuHierarchy(
	$: CheerioAPI,
	el: Parameters<CheerioAPI>[0],
): Pick<GnbPageLink, 'name' | 'menu1' | 'menu2' | 'menu3' | 'parent' | 'depth'> {
	const name = ownNodeLabel($, el);
	const $a = $(el);
	const $li = $a.closest('li');
	const ancestorLis = $li.length ? $li.parents('li').toArray() : [];

	if (ancestorLis.length >= 2) {
		const top = ancestorLis[ancestorLis.length - 1];
		const mid = ancestorLis[ancestorLis.length - 2];
		const menu1 = firstLabelInLi($, top) || name;
		const menu2 = firstLabelInLi($, mid) || name;
		return { name, menu1, menu2, menu3: name, parent: menu2, depth: 3 };
	}
	if (ancestorLis.length === 1) {
		const menu1 = firstLabelInLi($, ancestorLis[0]) || name;
		return { name, menu1, menu2: name, parent: menu1, depth: 2 };
	}

	const $depth2 = $a.closest('.depth2, .gnb_2dul, .submenu, .dropdown-menu, .sub, .select-nav .depth2');
	if ($depth2.length) {
		const $block = $depth2.closest('li, .gnb_1dli, .menu-item, .depth1 > li, .select-nav');
		const menu1 =
			firstLabelInLi($, $block.get(0)) ||
			ownNodeLabel($, $block.children('a, .depth1').first().get(0)) ||
			ownNodeLabel($, $depth2.prevAll('a').first().get(0)) ||
			name;
		if (menu1 && menu1 !== name) {
			return { name, menu1, menu2: name, parent: menu1, depth: 2 };
		}
	}

	return { name, menu1: name, depth: 1 };
}

function collectAnchorsInRoot(
	$: CheerioAPI,
	root: ReturnType<CheerioAPI>,
	pageUrl: string,
	origin: string,
	out: GnbPageLink[],
	seen: Map<string, number>,
	limit: number,
): void {
	root.find('a[href]').each((_, el) => {
		if (out.length >= limit) return false;
		const href = $(el).attr('href');
		const norm = href ? normalizeGnbHref(href, pageUrl, origin) : null;
		if (!norm) return;
		const hier = inferMenuHierarchy($, el);
		if (!hier.name) return;
		pushUnique(out, seen, {
			...hier,
			url: norm.hrefPath,
		});
	});
}

function isInsideAny($: CheerioAPI, el: Parameters<CheerioAPI>[0], selectors: readonly string[]): boolean {
	return $(el).parents(selectors.join(',')).length > 0;
}

/**
 * Header-first roots: scan the chrome wrapper once so every nested
 * #gnb / .depth2 / .select-nav link is included without class-name gates.
 */
function collectHeaderRoots($: CheerioAPI): ReturnType<CheerioAPI>[] {
	const roots: ReturnType<CheerioAPI>[] = [];
	const used = new Set<unknown>();

	const push = (el: Parameters<CheerioAPI>[0], skipIfInsideHeader: boolean) => {
		if (used.has(el)) return;
		if (skipIfInsideHeader && isInsideAny($, el, HEADER_CONTAINER_SELECTORS)) return;
		used.add(el);
		roots.push($(el));
	};

	for (const sel of HEADER_CONTAINER_SELECTORS) {
		$(sel).each((_, el) => {
			if (isInsideAny($, el, HEADER_CONTAINER_SELECTORS)) return;
			push(el, false);
		});
	}
	const hasHeader = roots.length > 0;
	for (const sel of HEADER_NAV_SELECTORS) {
		$(sel).each((_, el) => push(el, hasHeader));
	}
	return roots;
}

/**
 * Extract every operational header / GNB / 2nd-depth submenu link.
 * Footer and main content are not scanned.
 */
export function extractGnbNavigationPages(
	$: CheerioAPI,
	pageUrl: string,
	opts?: { limit?: number },
): GnbPageLink[] {
	const limit = opts?.limit ?? GNB_PAGE_LIMIT;
	let origin = '';
	try {
		origin = new URL(pageUrl).origin;
	} catch {
		return [];
	}

	const out: GnbPageLink[] = [];
	const seen = new Map<string, number>();
	const roots = collectHeaderRoots($);
	for (const root of roots) {
		collectAnchorsInRoot($, root, pageUrl, origin, out, seen, limit);
		if (out.length >= limit) break;
	}

	return out.slice(0, limit);
}

export function gnbPagesToNavItems(pages: GnbPageLink[]): GnbPageLink[] {
	return pages.map((page) => ({ ...page }));
}

export function gnbPagesToCollectedUrls(pages: GnbPageLink[]): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const page of pages) {
		const key = page.url.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(page.url);
	}
	return out;
}

export function flattenNavItemUrls(
	navItems?: Array<{ name?: string; url?: string; children?: Array<{ name?: string; url?: string }> }>,
): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	const push = (url?: string) => {
		const raw = String(url || '').trim().split('#')[0];
		if (!raw) return;
		const key = raw.toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);
		out.push(raw);
	};
	for (const item of navItems || []) {
		push(item.url);
		for (const child of item.children || []) push(child.url);
	}
	return out;
}

/** Prefer header/GNB hrefs for the solve table; fall back only when nav is empty. */
export function resolveGnbCollectedPaths(opts: {
	navItems?: Array<{ name?: string; url?: string; children?: Array<{ name?: string; url?: string }> }>;
	fallbackPaths?: string[];
	homePath?: string;
}): string[] {
	const navUrls = flattenNavItemUrls(opts.navItems);
	const home = opts.homePath && opts.homePath !== '/' ? opts.homePath : '/';
	if (navUrls.length > 0) {
		const paths = navUrls.includes(home) || navUrls.includes('/') ? [...navUrls] : [home, ...navUrls];
		return [...new Set(paths)];
	}
	const fallback = [...(opts.fallbackPaths || [])];
	if (!fallback.some((p) => p === '/' || p === home)) fallback.unshift(home);
	return [...new Set(fallback)];
}
