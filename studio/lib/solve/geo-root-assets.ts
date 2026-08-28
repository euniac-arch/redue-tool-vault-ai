/**
 * SEO & GEO full-package root assets: robots.txt, sitemap.xml, llms-full.txt, rss.php.
 * sitemap.xml is 1:1 from workspace-checked header (GNB/LNB) URLs — never FTP file scrape.
 */

import type { AuditPageMeta, SchemaNavItem } from '@/lib/solve/dynamic-php-schema';
import { extractOrgContactFromFooter } from '@/lib/solve/dynamic-php-schema';
import { isCitationVirtualPage } from '@/lib/solve/core/eeat-citation';
import { buildOfficialLlmsFullTxt, toLlmsPlainString } from '@/lib/solve/llms-content-engine';
import {
	buildSolveLlmsTxtMarkdown,
	isLlmsTxtDeployPage,
	menusFromLlmsDeployInput,
	resolveLlmsDeployAddress,
	resolveLlmsDeployHours,
	type LlmsTxtDeployInput,
} from '@/lib/solve/llms-txt-deploy';
import {
	buildAiFriendlyRobotsTxt,
	type BuildRobotsTxtInput,
} from '@/lib/solve/robots-txt-builder';
import { generateRssFeedCode } from '@/lib/solve/rss-php-engine';
import type { SolvePageMeta } from '@/lib/solve/types';

export { RSS_PHP_RELATIVE_PATH } from '@/lib/solve/rss-php-engine';

export {
	AI_ROBOTS_CRAWLERS,
	ROBOTS_CMS_RULES,
	buildAiFriendlyRobotsTxt,
	detectRobotsCmsId,
	normalizeRobotsCmsId,
} from '@/lib/solve/robots-txt-builder';

export const ROBOTS_TXT_RELATIVE_PATH = 'robots.txt';
export const SITEMAP_XML_RELATIVE_PATH = 'sitemap.xml';
export const LLMS_FULL_TXT_RELATIVE_PATH = 'llms-full.txt';

export type RootDeployKind = 'robots' | 'sitemap' | 'llms' | 'llms-full' | 'rss';

export type RootDeployRowSpec = {
	kind: RootDeployKind;
	urlPath: string;
	title: string;
	section: string;
	description: string;
	badges: string[];
};

export const ROOT_DEPLOY_ROW_SPECS: RootDeployRowSpec[] = [
	{
		kind: 'robots',
		urlPath: '/robots.txt',
		title: 'Robots.Txt',
		section: 'SEO / 크롤러 제어',
		description: 'AI 검색 봇(GPT/Perplexity/Claude) 허용 및 사이트맵 연결',
		badges: ['SEO / 크롤러 제어', '루트 파일 배포'],
	},
	{
		kind: 'sitemap',
		urlPath: '/sitemap.xml',
		title: 'Sitemap.Xml',
		section: 'SEO / 색인 가속',
		description: '선택된 유효 서브페이지 목록 기반 동적 XML 사이트맵',
		badges: ['SEO / 색인 가속', '루트 파일 배포'],
	},
	{
		kind: 'llms',
		urlPath: '/llms.txt',
		title: 'llms.txt',
		section: 'AI / GEO',
		description: 'AI 크롤러·GEO 인용용 루트 인덱스 (서버 루트에 단독 파일로 배포)',
		badges: ['AI / GEO 전용', '루트 파일 배포'],
	},
	{
		kind: 'llms-full',
		urlPath: '/llms-full.txt',
		title: 'Llms-Full.Txt',
		section: 'GEO / 심층 인용',
		description: 'AI 검색 엔진 심층 답변을 위한 병원/기업 상세 마크다운 텍스트',
		badges: ['GEO / 심층 인용', '루트 파일 배포'],
	},
	{
		kind: 'rss',
		urlPath: '/rss.php',
		title: 'Rss.Php',
		section: 'SEO / RSS 2.0',
		description: '그누보드 5 · 영카트 공개 게시글 RSS 2.0 피드 (최신 30건)',
		badges: ['SEO / RSS 2.0', '루트 파일 배포'],
	},
];

function normalizeDeployPath(urlPath: string | undefined): string {
	return String(urlPath || '')
		.trim()
		.split('#')[0]
		.split('?')[0]
		.replace(/\\/g, '/')
		.replace(/\/+$/, '')
		.toLowerCase();
}

export function isRootDeployPath(urlPath: string | undefined): boolean {
	const raw = normalizeDeployPath(urlPath);
	return /(^|\/)(robots\.txt|sitemap\.xml|llms\.txt|llms-full\.txt|rss\.php)$/.test(raw);
}

export function getRootDeployKind(
	page: Pick<SolvePageMeta, 'urlPath' | 'title'>,
): RootDeployKind | null {
	const raw = normalizeDeployPath(page.urlPath);
	if (/(^|\/)robots\.txt$/.test(raw) || /^robots\.txt$/i.test(String(page.title || '').trim())) {
		return 'robots';
	}
	if (/(^|\/)sitemap\.xml$/.test(raw) || /^sitemap\.xml$/i.test(String(page.title || '').trim())) {
		return 'sitemap';
	}
	if (/(^|\/)llms-full\.txt$/.test(raw) || /^llms-full\.txt$/i.test(String(page.title || '').trim())) {
		return 'llms-full';
	}
	if (/(^|\/)rss\.php$/.test(raw) || /^rss\.php$/i.test(String(page.title || '').trim())) {
		return 'rss';
	}
	if (isLlmsTxtDeployPage(page)) return 'llms';
	return null;
}

export function isRootDeployPage(page: Pick<SolvePageMeta, 'urlPath' | 'title'>): boolean {
	return getRootDeployKind(page) !== null;
}

export function getRootDeploySpec(
	page: Pick<SolvePageMeta, 'urlPath' | 'title'>,
): RootDeployRowSpec | null {
	const kind = getRootDeployKind(page);
	return kind ? ROOT_DEPLOY_ROW_SPECS.find((spec) => spec.kind === kind) || null : null;
}

export function createRootDeployMenuRow(kind: RootDeployKind): SolvePageMeta {
	const spec = ROOT_DEPLOY_ROW_SPECS.find((row) => row.kind === kind)!;
	return {
		urlPath: spec.urlPath,
		title: spec.title,
		description: spec.description,
		section: spec.section,
		menu1: spec.section,
		pageType: 'SpecialAnnouncement',
		selected: true,
	};
}

export function ensureRootDeployMenuRows(pages: SolvePageMeta[]): SolvePageMeta[] {
	const list = Array.isArray(pages) ? [...pages] : [];
	const regular: SolvePageMeta[] = [];
	const rootsByKind = new Map<RootDeployKind, SolvePageMeta>();

	for (const page of list) {
		const kind = getRootDeployKind(page);
		if (!kind) {
			regular.push(page);
			continue;
		}
		if (rootsByKind.has(kind)) continue;
		const spec = ROOT_DEPLOY_ROW_SPECS.find((row) => row.kind === kind)!;
		rootsByKind.set(kind, {
			...page,
			urlPath: spec.urlPath,
			title: spec.title,
			description: spec.description,
			section: spec.section,
			menu1: spec.section,
			pageType: page.pageType || 'SpecialAnnouncement',
			selected: page.selected !== false,
		});
	}

	const roots = ROOT_DEPLOY_ROW_SPECS.map(
		(spec) => rootsByKind.get(spec.kind) || createRootDeployMenuRow(spec.kind),
	);
	return [...regular, ...roots];
}

export function excludeRootDeployFromSchemaPages<T extends { urlPath?: string; title?: string }>(
	pages: T[],
): T[] {
	return pages.filter((page) => !isRootDeployPage(page));
}

export function resolveRootDeployFlags(
	pages: Array<Pick<SolvePageMeta, 'urlPath' | 'title' | 'selected'>> | undefined,
): {
	deployRobotsTxt: boolean;
	deploySitemapXml: boolean;
	deployLlmsTxt: boolean;
	deployLlmsFullTxt: boolean;
	deployRssPhp: boolean;
} {
	const selected = (pages || []).filter((page) => page.selected !== false);
	return {
		deployRobotsTxt: selected.some((page) => getRootDeployKind(page) === 'robots'),
		deploySitemapXml: selected.some((page) => getRootDeployKind(page) === 'sitemap'),
		deployLlmsTxt: selected.some((page) => getRootDeployKind(page) === 'llms'),
		deployLlmsFullTxt: selected.some((page) => getRootDeployKind(page) === 'llms-full'),
		deployRssPhp: selected.some((page) => getRootDeployKind(page) === 'rss'),
	};
}

export function resolvePackageOrigin(targetUrl?: string): string {
	try {
		return new URL(targetUrl || 'https://example.com').origin.replace(/^http:\/\//i, 'https://');
	} catch {
		return 'https://example.com';
	}
}

export function resolvePackageDomain(targetUrl?: string): string {
	return resolvePackageOrigin(targetUrl).replace(/^https?:\/\//i, '');
}

function xmlEscape(value: string): string {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function pageLabel(page: AuditPageMeta | SolvePageMeta): string {
	return String(page.title || page.section || page.menu1 || page.urlPath || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function absolutePageUrl(urlPath: string, origin: string): string {
	if (/^https?:\/\//i.test(urlPath)) return urlPath.replace(/^http:\/\//i, 'https://');
	const path = !urlPath || urlPath === '/' ? '/' : urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
	return `${origin}${path === '/' ? '/' : path}`;
}

function isHomePage(urlPath: string | undefined): boolean {
	const raw = String(urlPath || '').trim();
	if (!raw || raw === '/') return true;
	try {
		const url = new URL(raw, 'https://example.com');
		const path = url.pathname.replace(/\/+$/, '') || '/';
		if (url.search && url.search !== '?') return false;
		return path === '/' || /^\/index\.(php|html?)$/i.test(path);
	} catch {
		return /^\/?(index\.(php|html?))?$/i.test(raw);
	}
}

export type SitemapChangefreq = 'daily' | 'weekly' | 'monthly';

export type SitemapUrlWeight = {
	priority: '1.0' | '0.9' | '0.8' | '0.7' | '0.6' | '0.5';
	changefreq: SitemapChangefreq;
};

function sitemapHaystack(page: {
	urlPath?: string;
	title?: string;
	section?: string;
	menu1?: string;
	menu2?: string;
	h1?: string;
}): string {
	return [page.title, page.section, page.menu1, page.menu2, page.h1, page.urlPath]
		.filter((v) => typeof v === 'string' && v.trim() !== '')
		.join(' ');
}

/**
 * Header-menu semantic weights for sitemap.xml.
 * doctor / sub301–sub701 / clinic → 0.9 monthly
 * location → 0.8 monthly
 * about / tour / ceo_message → 0.6 monthly
 * board.php?bo_table= → 0.7 weekly
 */
export function resolveSitemapUrlWeight(page: {
	urlPath?: string;
	title?: string;
	section?: string;
	menu1?: string;
	menu2?: string;
	h1?: string;
}): SitemapUrlWeight {
	if (isHomePage(page.urlPath)) {
		return { priority: '1.0', changefreq: 'daily' };
	}
	const path = String(page.urlPath || '');
	const hay = sitemapHaystack(page);

	if (/board\.php(?:\?|\/)|[?&]bo_table=/i.test(path)) {
		return { priority: '0.7', changefreq: 'weekly' };
	}
	if (/(?:^|\/)sub[3-7]\d{2}(?:\b|\.php)/i.test(path) || /(?:^|\/)[3-7]\d{2}\.php(?:\?|$)/i.test(path)) {
		return { priority: '0.9', changefreq: 'monthly' };
	}
	if (/\bdoctor\b|\bstaff\b|의료진|전문의|대표\s*원장|의료진\s*소개/i.test(hay) || /\bclinic\b|진료과|진료과목|핵심\s*진료|클리닉/i.test(hay)) {
		return { priority: '0.9', changefreq: 'monthly' };
	}
	if (/location|오시는\s*길|찾아오시는\s*길|찾아오는\s*길|\b위치\b|direction|contact.?map/i.test(hay)) {
		return { priority: '0.8', changefreq: 'monthly' };
	}
	if (
		/ceo_message|ceo-message|인사말|원장\s*인사|병원소개|둘러보기|\btour\b|\babout\b|회사소개|클리닉\s*소개|병원\s*소개|소개페이지/i.test(
			hay,
		)
	) {
		return { priority: '0.6', changefreq: 'monthly' };
	}
	return { priority: '0.5', changefreq: 'monthly' };
}

export function selectedHtmlPages(
	pages: Array<AuditPageMeta | SolvePageMeta> | undefined,
): Array<AuditPageMeta | SolvePageMeta> {
	return excludeRootDeployFromSchemaPages(pages || []).filter(
		(page) => page.selected !== false && !isCitationVirtualPage(page),
	);
}

export type GeoRootAssetInput = LlmsTxtDeployInput & {
	cmsType?: string | null;
	robots?: BuildRobotsTxtInput;
};

function formatSitemapUrlEntry(loc: string, lastmod: string, weight: SitemapUrlWeight): string {
	return `  <url>
    <loc>${xmlEscape(loc)}</loc>
    <lastmod>${xmlEscape(lastmod)}</lastmod>
    <changefreq>${weight.changefreq}</changefreq>
    <priority>${weight.priority}</priority>
  </url>`;
}

export function buildSelectedPagesSitemapXml(opts: {
	targetUrl?: string;
	/** Workspace-checked (selected: true) header/GNB/LNB service URLs. */
	selectedPages?: Array<AuditPageMeta | SolvePageMeta>;
	pages?: Array<AuditPageMeta | SolvePageMeta>;
	lastmod?: string;
}): string {
	const origin = resolvePackageOrigin(opts.targetUrl);
	const lastmod = opts.lastmod || new Date().toISOString().slice(0, 10);
	const selected = selectedHtmlPages(opts.selectedPages ?? opts.pages);
	const seen = new Set<string>();
	const entries: string[] = [];

	const push = (page: AuditPageMeta | SolvePageMeta) => {
		const loc = isHomePage(page.urlPath) ? `${origin}/` : absolutePageUrl(page.urlPath || '/', origin);
		if (seen.has(loc)) return;
		seen.add(loc);
		const weight = resolveSitemapUrlWeight({
			...page,
			urlPath: loc === `${origin}/` ? '/' : page.urlPath,
		});
		entries.push(formatSitemapUrlEntry(loc, lastmod, weight));
	};

	const home = selected.find((page) => isHomePage(page.urlPath));
	push(home || { urlPath: '/', title: 'Home' });
	for (const page of selected) {
		if (isHomePage(page.urlPath)) continue;
		push(page);
	}

	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;
}

export function buildSolveLlmsFullMarkdown(
	input: LlmsTxtDeployInput & {
		openingHoursOpens?: string;
		openingHoursCloses?: string;
		navItems?: SchemaNavItem[];
	},
): string {
	const origin = resolvePackageOrigin(input.targetUrl);
	const contact = extractOrgContactFromFooter(input.footerText || '');
	return buildOfficialLlmsFullTxt({
		siteName:
			toLlmsPlainString(input.siteName || input.legalName) || resolvePackageDomain(input.targetUrl),
		origin,
		industry: input.industryType,
		representativeName: toLlmsPlainString(input.representativeName),
		telephone: toLlmsPlainString(input.telephone || contact.telephone),
		address: resolveLlmsDeployAddress(input),
		openingHours: resolveLlmsDeployHours(input),
		intro: toLlmsPlainString(input.mainDescription),
		menus: menusFromLlmsDeployInput(input),
		faqs: [],
	});
}

export type GeoRootAssetPack = {
	pageCount: number;
	robotsTxt: string;
	sitemapXml: string;
	llmsTxt: string;
	llmsFullTxt: string;
	rssPhp: string;
};

export function buildGeoRootAssetPack(input: GeoRootAssetInput): GeoRootAssetPack {
	const pages = selectedHtmlPages(input.pages);
	return {
		pageCount: pages.length,
		robotsTxt: buildAiFriendlyRobotsTxt({
			targetUrl: input.targetUrl,
			cmsType: input.cmsType,
			...(input.robots || {}),
		}),
		sitemapXml: buildSelectedPagesSitemapXml({
			targetUrl: input.targetUrl,
			selectedPages: pages,
		}),
		llmsTxt: buildSolveLlmsTxtMarkdown(input),
		llmsFullTxt: buildSolveLlmsFullMarkdown(input),
		rssPhp: generateRssFeedCode({
			siteName: input.siteName || input.legalName,
			siteUrl: input.targetUrl,
			description: input.mainDescription,
			telephone: input.telephone,
			address: resolveLlmsDeployAddress(input),
		}),
	};
}
