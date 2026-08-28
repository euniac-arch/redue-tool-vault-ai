/**
 * Universal audit_payload hydration — GNB / Title / Desc / H1 never copy raw URLs.
 * Works for Gnuboard, YoungCart, WordPress, Rhymix, and standalone PHP via
 * DOM/nav labels first, then path-stem / query-param humanization.
 */

import { splitPageTitle } from '@/lib/audit/parser';
import { resolvePageDescription } from '@/lib/audit/extractors/page-description';
import { formatGnbHierarchyTitle } from '@/lib/audit/extractors/gnb-pages';
import type { SolvePageMeta } from '@/lib/solve/types';

export const RAW_URL_FIELD_RE =
	/https?:\/\/|www\.|\/theme\/|\/bbs\/|\/wp-content\/|\/wp-includes\/|\.php(?:\?|$)|[?&](bo_table|co_id|it_id|ca_id|page_id|p)=/i;

const UI_NOISE_RE =
	/로그인|로그아웃|회원가입|회원정보|비밀번호|검색하기|^검색$|전체보기|더보기|TOP|맨위로|Total\s*\d+|페이지\s*\d+건/gi;

const CMS_PATH_TOKENS = new Set([
	'theme',
	'basic',
	'html',
	'css',
	'js',
	'img',
	'images',
	'data',
	'plugin',
	'plugins',
	'wp-content',
	'wp-includes',
	'wp-admin',
	'bbs',
	'shop',
	'skin',
	'mobile',
	'contents',
	'page',
	'pages',
	'sub',
	'common',
	'include',
	'inc',
	'assets',
	'static',
	'dist',
	'src',
	'vendor',
	'tail',
	'head',
	'layout',
	'widget',
	'modules',
	'module',
	'index',
	'default',
	'home',
	'main',
	'www',
	'public',
	'uploads',
	'gnu',
	'g5',
	'xe',
	'rhymix',
]);

const STEM_LABELS: Record<string, string> = {
	about: '소개',
	'about-us': '소개',
	aboutus: '소개',
	intro: '소개',
	company: '회사소개',
	greeting: '인사말',
	hello: '인사말',
	history: '연혁',
	location: '오시는 길',
	contact: '문의',
	map: '오시는 길',
	direction: '오시는 길',
	directions: '오시는 길',
	staff: '의료진',
	doctor: '의료진',
	doctors: '의료진',
	team: '의료진',
	reserve: '예약',
	reservation: '예약',
	booking: '예약',
	notice: '공지사항',
	news: '소식',
	faq: 'FAQ',
	qna: 'Q&A',
	qa: 'Q&A',
	gallery: '갤러리',
	photo: '갤러리',
	board: '게시판',
	privacy: '개인정보처리방침',
	policy: '개인정보처리방침',
	terms: '이용약관',
	sitemap: '사이트맵',
	service: '서비스',
	services: '서비스',
	treatment: '진료안내',
	clinic: '진료안내',
	product: '상품',
	item: '상품',
	shop: '쇼핑몰',
	tour: '둘러보기',
	write: '글쓰기',
	content: '안내',
	info: '안내',
	guide: '이용안내',
	howto: '이용절차',
	review: '후기',
	event: '이벤트',
};

const BOARD_TABLE_LABELS: Record<string, string> = {
	qa: 'Q&A 게시판',
	qna: 'Q&A 게시판',
	inquiry: '문의 게시판',
	consult: '상담 게시판',
	notice: '공지사항',
	news: '소식',
	gallery: '갤러리',
	photo: '갤러리',
	reply: '후기',
	after: '후기',
	free: '자유게시판',
	community: '커뮤니티',
	faq: 'FAQ',
	event: '이벤트',
	review: '후기',
	webzine: '웹진',
};

export type HydrateNavItem = {
	name?: string;
	url?: string;
	menu1?: string;
	menu2?: string;
	parent?: string;
};

export type HydratePageCtx = {
	siteName: string;
	mainTitle?: string;
	mainDescription?: string;
	industryType?: string;
	cmsHint?: string;
	navItems?: HydrateNavItem[];
};

export function looksLikeRawUrlOrPath(value: string | undefined | null): boolean {
	const text = String(value || '').replace(/\s+/g, ' ').trim();
	if (!text) return true;
	if (RAW_URL_FIELD_RE.test(text)) return true;
	if (/^\/[A-Za-z0-9._~+\-/%?=&#]+$/.test(text) && /\//.test(text.slice(1))) return true;
	if (/^(index|board|content|write|list)\.(php|html?)$/i.test(text)) return true;
	if (/(?:^|\s)\/(?:theme|bbs|contents|wp-content)\//i.test(text)) return true;
	return false;
}

function pathKey(raw: string): string {
	return String(raw || '')
		.split('#')[0]
		.replace(/\\/g, '/')
		.replace(/^https?:\/\/[^/]+/i, '')
		.replace(/\/+/g, '/')
		.toLowerCase();
}

function pathStem(raw: string): string {
	const base = (pathKey(raw).split('?')[0] || '').split('/').filter(Boolean).pop() || '';
	return base.replace(/\.(php|html?|htm|phtml)$/i, '');
}

export function resolveNavLabelForPath(
	urlPath: string,
	navItems?: HydrateNavItem[],
): { name: string; menu1: string; menu2: string } | null {
	if (!navItems?.length) return null;
	const want = pathKey(urlPath);
	const wantStem = pathStem(urlPath);
	let best: { name: string; menu1: string; menu2: string } | null = null;
	for (const item of navItems) {
		const name = String(item.name || '').replace(/\s+/g, ' ').trim();
		if (!name || looksLikeRawUrlOrPath(name)) continue;
		const href = pathKey(item.url || '');
		if (!href) continue;
		const exact = href === want || href.endsWith(want) || want.endsWith(href);
		const stemHit = wantStem && pathStem(href) === wantStem;
		if (!exact && !stemHit) continue;
		const menu1 = String(item.menu1 || item.parent || '').trim();
		const menu2 = String(item.menu2 || '').trim();
		const hit = {
			name,
			menu1: menu1 && !looksLikeRawUrlOrPath(menu1) && !isCmsPathToken(menu1) ? menu1 : '',
			menu2: menu2 && !looksLikeRawUrlOrPath(menu2) && !isCmsPathToken(menu2) ? menu2 : '',
		};
		if (exact) return hit;
		best = hit;
	}
	return best;
}

export function isCmsPathToken(value: string | undefined | null): boolean {
	const token = String(value || '')
		.replace(/\.(php|html?|htm)$/i, '')
		.toLowerCase()
		.trim();
	return Boolean(token) && CMS_PATH_TOKENS.has(token);
}

function queryParam(urlPath: string, key: string): string {
	const q = urlPath.includes('?') ? urlPath.slice(urlPath.indexOf('?') + 1) : '';
	try {
		return new URLSearchParams(q).get(key)?.trim() || '';
	} catch {
		const match = q.match(new RegExp(`(?:^|&)${key}=([^&]+)`, 'i'));
		return match?.[1] ? decodeURIComponent(match[1]) : '';
	}
}

function fileStem(urlPath: string): string {
	const path = (urlPath || '').split('?')[0] || '';
	const base = path.split('/').filter(Boolean).pop() || '';
	return base.replace(/\.(php|html?|htm|phtml)$/i, '');
}

export function humanizeStem(stem: string): string {
	const raw = String(stem || '').trim();
	if (!raw || raw === 'index' || isCmsPathToken(raw)) return '';
	if (/^[a-z]?\d{1,6}$/i.test(raw) || /^\d+[a-z]?$/i.test(raw)) return '';
	const compact = raw.toLowerCase().replace(/[-_\s]+/g, '');
	const spaced = raw.toLowerCase().replace(/[-_]+/g, ' ').trim();
	if (STEM_LABELS[compact]) return STEM_LABELS[compact]!;
	if (STEM_LABELS[spaced]) return STEM_LABELS[spaced]!;
	const first = spaced.split(/\s+/)[0] || '';
	if (STEM_LABELS[first]) return STEM_LABELS[first]!;
	if (/[가-힣]{2,}/.test(raw) && !looksLikeRawUrlOrPath(raw)) return raw.replace(/[-_]+/g, ' ').trim();
	if (/^[a-z][a-z0-9]+(?:[-_\s][a-z0-9]+)+$/i.test(raw)) {
		return spaced
			.split(/\s+/)
			.filter((part) => !CMS_PATH_TOKENS.has(part))
			.map((part) => STEM_LABELS[part] || part)
			.join(' ')
			.replace(/\b\w/g, (c) => c.toUpperCase())
			.trim();
	}
	return '';
}

export function humanizePathLabel(urlPath: string): string {
	const path = String(urlPath || '').split('#')[0] || '';
	if (!path || path === '/') return '메인';

	const boTable = queryParam(path, 'bo_table');
	if (boTable) {
		const key = boTable.toLowerCase();
		if (BOARD_TABLE_LABELS[key]) return BOARD_TABLE_LABELS[key]!;
		if (/[가-힣]{2,}/.test(boTable)) return `${boTable} 게시판`;
		const named = humanizeStem(boTable);
		return named ? `${named} 게시판` : '게시판';
	}
	const coId = queryParam(path, 'co_id');
	if (coId) return humanizeStem(coId) || '안내';
	const pageId = queryParam(path, 'page_id') || queryParam(path, 'p');
	if (pageId && !/^\d+$/.test(pageId)) return humanizeStem(pageId) || '페이지';

	const stem = fileStem(path);
	const fromStem = humanizeStem(stem);
	if (fromStem) return fromStem;

	const segments = (path.split('?')[0] || '')
		.replace(/^\//, '')
		.split('/')
		.filter((seg) => seg && !isCmsPathToken(seg.replace(/\.(php|html?|htm)$/i, '')));
	for (let i = segments.length - 1; i >= 0; i--) {
		const label = humanizeStem(segments[i]!.replace(/\.(php|html?|htm)$/i, ''));
		if (label) return label;
	}
	return '';
}

export function stripSharedTitleSuffix(raw: string, siteName?: string): string {
	const text = String(raw || '').replace(/\s+/g, ' ').trim();
	if (!text) return '';
	const split = splitPageTitle(text, siteName);
	return (split || text).replace(/\s+/g, ' ').trim();
}

export function sanitizeDisplayField(
	value: string | undefined | null,
	fallback: string,
	siteName?: string,
): string {
	const stripped = stripSharedTitleSuffix(String(value || ''), siteName);
	if (!stripped || looksLikeRawUrlOrPath(stripped) || isCmsPathToken(stripped)) {
		return fallback;
	}
	return stripped;
}

function cleanDescNoise(raw: string): string {
	return String(raw || '')
		.replace(UI_NOISE_RE, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function fallbackOfficialDescription(siteName: string, title: string): string {
	const site = (siteName || '').trim() || '공식 사이트';
	const page = (title || '').trim() || '안내';
	const sentence =
		page && page !== site
			? `${site} ${page} 공식 안내 페이지입니다.`
			: `${site} 공식 안내 페이지입니다.`;
	return sentence.slice(0, 120);
}

export function sanitizePageDescription(
	raw: string | undefined,
	opts: { siteName: string; title: string; urlPath: string; gnb?: string; industryType?: string; mainDescription?: string },
): string {
	const cleaned = cleanDescNoise(raw || '');
	const title = looksLikeRawUrlOrPath(opts.title) ? '안내' : opts.title;
	if (cleaned && !looksLikeRawUrlOrPath(cleaned) && cleaned.length >= 20) {
		return cleaned.length > 150 ? `${cleaned.slice(0, 147).trim()}…` : cleaned;
	}
	const generated = resolvePageDescription({
		siteName: opts.siteName,
		pageTitle: title,
		url: opts.urlPath,
		gnb: opts.gnb && !looksLikeRawUrlOrPath(opts.gnb) ? opts.gnb : title,
		industryType: opts.industryType,
		existingMeta: '',
		mainDescription: opts.mainDescription,
	});
	if (generated && !looksLikeRawUrlOrPath(generated)) return generated;
	return fallbackOfficialDescription(opts.siteName, title);
}

export function sanitizeMenuLabel(value: string | undefined | null, urlPath: string, fallback = ''): string {
	const text = String(value || '').replace(/\s+/g, ' ').trim();
	if (!text || looksLikeRawUrlOrPath(text) || isCmsPathToken(text)) {
		return fallback || humanizePathLabel(urlPath);
	}
	if (/^(theme|basic|html|bbs|board|index)$/i.test(text)) return fallback || humanizePathLabel(urlPath);
	return text;
}

export function displayGnbLabel(page: Pick<SolvePageMeta, 'menu1' | 'menu2' | 'section' | 'title' | 'urlPath'>): string {
	const menu1 = sanitizeMenuLabel(page.menu1, page.urlPath || '', '');
	const menu2 = sanitizeMenuLabel(page.menu2, page.urlPath || '', '');
	const hierarchy = formatGnbHierarchyTitle(menu1, menu2);
	if (hierarchy && !looksLikeRawUrlOrPath(hierarchy)) return hierarchy;
	const section = sanitizeMenuLabel(page.section, page.urlPath || '', '');
	if (section && !looksLikeRawUrlOrPath(section)) return section;
	if (!page.urlPath || page.urlPath === '/') return '메인';
	const title = sanitizeDisplayField(page.title, '', '');
	if (title) return title;
	return humanizePathLabel(page.urlPath || '') || '페이지';
}

export function hydrateSolvePageMeta<T extends SolvePageMeta>(page: T, ctx: HydratePageCtx): T {
	const site = (ctx.siteName || '').trim() || '공식 사이트';
	const urlPath = page.urlPath || '/';
	const nav = resolveNavLabelForPath(urlPath, ctx.navItems);
	const pathLabel = humanizePathLabel(urlPath) || nav?.name || '페이지';
	const title =
		sanitizeDisplayField(page.title, '', site) ||
		sanitizeDisplayField(nav?.name, '', site) ||
		pathLabel;
	const h1 =
		sanitizeDisplayField(page.h1, '', site) ||
		sanitizeDisplayField(nav?.name, '', site) ||
		title;
	const menu1 =
		sanitizeMenuLabel(page.menu1, urlPath, '') ||
		sanitizeMenuLabel(nav?.menu1, urlPath, '') ||
		'';
	const menu2 =
		sanitizeMenuLabel(page.menu2, urlPath, '') ||
		sanitizeMenuLabel(nav?.menu2, urlPath, '') ||
		(menu1 && menu1 !== title ? title : '');
	const sectionRaw = sanitizeMenuLabel(page.section, urlPath, '');
	const hierarchy = formatGnbHierarchyTitle(menu1, menu2);
	const section =
		hierarchy && hierarchy.includes(' > ') && !looksLikeRawUrlOrPath(hierarchy)
			? hierarchy
			: sectionRaw && !looksLikeRawUrlOrPath(sectionRaw)
				? sectionRaw
				: menu1 || title;
	const gnb = hierarchy && !looksLikeRawUrlOrPath(hierarchy) ? hierarchy : section || title;
	const description = sanitizePageDescription(page.description, {
		siteName: site,
		title,
		urlPath,
		gnb,
		industryType: ctx.industryType,
		mainDescription: ctx.mainDescription,
	});

	return {
		...page,
		title,
		h1,
		description,
		menu1: menu1 || undefined,
		menu2: menu2 && menu2 !== menu1 ? menu2 : undefined,
		section,
	};
}

export function hydrateSolvePageMetas<T extends SolvePageMeta>(pages: T[], ctx: HydratePageCtx): T[] {
	return pages.map((page) => {
		if (page.virtual) return page;
		return hydrateSolvePageMeta(page, ctx);
	});
}
