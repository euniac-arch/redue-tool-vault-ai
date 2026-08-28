/**
 * CMS-agnostic DOM collectors for render-blocking scripts and missing image alt.
 * Walks each page's HTML (Gnuboard / WordPress / Rhymix / static) without CMS hooks.
 */

import type { CheerioAPI } from 'cheerio';
import {
	collectImageAltIssues,
	formatPageDisplay,
	normalizeImageAltIssues,
	toMissingImageRow,
	type ImageAltIssue,
	type MissingAltIssueType,
	type MissingImageRow,
	type PageDisplayLang,
} from '@/lib/audit/extractors/heading-alt-details';

export const RENDER_BLOCKING_PER_PAGE_CAP = 30;
export const RENDER_BLOCKING_GLOBAL_CAP = 80;
export const MISSING_ALT_GLOBAL_CAP = 150;
export const RENDER_BLOCKING_RECOMMENDED_MAX = 5;

export type RenderBlockingRecommendationKind = 'add_defer' | 'move_to_body_end';

export interface RenderBlockingScript {
	pageUrl: string;
	scriptSrc: string;
	fullTag: string;
	isHead: boolean;
	recommendation: string;
	recommendationKind: RenderBlockingRecommendationKind;
}

export interface MissingAltImage {
	pageUrl: string;
	pageDisplay: string;
	imgSrc: string;
	normalizedSrc: string;
	currentAlt: string;
	issueType: MissingAltIssueType;
	suggestedAlt: string;
	issue?: MissingImageRow['issue'];
}

export type PageResourceLang = 'ko' | 'en';

type DomNode = {
	type?: string;
	name?: string;
	attribs?: Record<string, string>;
	parent?: DomNode | null;
	children?: DomNode[];
};

const BODY_CONTENT_ROOT_IDS = new Set([
	'contents',
	'container',
	'content',
	'sub_content',
	'bo_list',
	'bo_v',
	'main',
	'primary',
]);

const BODY_CONTENT_TAGS = new Set([
	'p',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'img',
	'article',
	'main',
	'section',
	'ul',
	'ol',
	'table',
	'form',
	'figure',
]);

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function pagePathOf(pageUrl: string): string {
	const raw = compact(pageUrl);
	if (!raw) return '';
	try {
		const url = new URL(raw);
		return `${url.pathname}${url.search}` || raw;
	} catch {
		return raw;
	}
}

export function renderBlockingRecommendation(
	isHead: boolean,
	lang: PageResourceLang = 'ko',
): { kind: RenderBlockingRecommendationKind; text: string } {
	if (isHead) {
		return {
			kind: 'add_defer',
			text: lang === 'en' ? 'Add the defer attribute' : 'defer 속성 추가 권장',
		};
	}
	return {
		kind: 'move_to_body_end',
		text: lang === 'en' ? 'Move just before </body>' : '하단 </body> 직전으로 이동',
	};
}

function attrMap(el: unknown): Record<string, string> {
	const node = el as DomNode;
	if (node?.attribs && typeof node.attribs === 'object') return node.attribs;
	return {};
}

function hasBooleanAttr(attrs: Record<string, string>, name: string): boolean {
	if (!Object.prototype.hasOwnProperty.call(attrs, name)) return false;
	const value = String(attrs[name] ?? '').trim().toLowerCase();
	return value === '' || value === name || value === 'true' || value === 'async' || value === 'defer';
}

export function isSyncExternalScript(attrs: Record<string, string>): boolean {
	const src = compact(attrs.src);
	if (!src) return false;
	if (hasBooleanAttr(attrs, 'async') || hasBooleanAttr(attrs, 'defer')) return false;
	const type = compact(attrs.type).toLowerCase();
	if (type === 'module') return false;
	if (type && type !== 'text/javascript' && type !== 'application/javascript' && type !== 'text/ecmascript') {
		return false;
	}
	return true;
}

export function serializeScriptTag(attrs: Record<string, string>): string {
	const parts = Object.entries(attrs).map(([key, value]) => {
		if (value == null || value === '') return key;
		const escaped = String(value).replace(/"/g, '&quot;');
		return `${key}="${escaped}"`;
	});
	return parts.length ? `<script ${parts.join(' ')}></script>` : '<script></script>';
}

function isInsideHead(el: DomNode | null): boolean {
	let current = el;
	while (current) {
		if ((current.name || '').toLowerCase() === 'head') return true;
		current = current.parent || null;
	}
	return false;
}

function isBodyContentRoot(node: DomNode): boolean {
	const name = (node.name || '').toLowerCase();
	if (name === 'main' || name === 'article') return true;
	const id = compact(node.attribs?.id).toLowerCase();
	if (id && BODY_CONTENT_ROOT_IDS.has(id)) return true;
	const role = compact(node.attribs?.role).toLowerCase();
	return role === 'main';
}

function walkEarlyBodyScripts(body: DomNode | undefined, visit: (el: DomNode) => void): void {
	if (!body) return;
	let pastStart = false;
	let contentNodes = 0;

	const walk = (node: DomNode | undefined) => {
		if (!node || pastStart) return;
		const name = (node.name || '').toLowerCase();
		const type = (node.type || '').toLowerCase();
		if (name === 'script' || type === 'script') {
			visit(node);
			return;
		}
		if (type && type !== 'tag' && type !== 'root') {
			(node.children || []).forEach(walk);
			return;
		}
		if (name === 'style' || name === 'link' || name === 'meta' || name === 'noscript' || name === 'template') {
			return;
		}
		if (isBodyContentRoot(node)) {
			pastStart = true;
			return;
		}
		if (BODY_CONTENT_TAGS.has(name)) {
			contentNodes += 1;
			if (contentNodes >= 4) {
				pastStart = true;
				return;
			}
		}
		(node.children || []).forEach(walk);
	};

	(body.children || []).forEach(walk);
}

export function collectRenderBlockingScripts(
	$: CheerioAPI,
	opts?: { pageUrl?: string; lang?: PageResourceLang },
): RenderBlockingScript[] {
	const pageUrl = compact(opts?.pageUrl);
	const lang = opts?.lang === 'en' ? 'en' : 'ko';
	const seen = new Set<string>();
	const items: RenderBlockingScript[] = [];

	const push = (el: unknown, isHead: boolean) => {
		if (items.length >= RENDER_BLOCKING_PER_PAGE_CAP) return;
		const attrs = attrMap(el);
		if (!isSyncExternalScript(attrs)) return;
		const scriptSrc = compact(attrs.src);
		const fullTag = serializeScriptTag(attrs);
		const key = `${scriptSrc}::${fullTag}::${isHead ? 'h' : 'b'}`;
		if (seen.has(key)) return;
		seen.add(key);
		const rec = renderBlockingRecommendation(isHead, lang);
		items.push({
			pageUrl,
			scriptSrc,
			fullTag,
			isHead,
			recommendation: rec.text,
			recommendationKind: rec.kind,
		});
	};

	$('head script[src]').each((_, el) => push(el, true));

	const body = $('body').get(0) as DomNode | undefined;
	if (body) {
		walkEarlyBodyScripts(body, (node) => push(node, false));
	} else {
		$('script[src]').each((_, el) => {
			if (!isInsideHead(el as DomNode)) push(el, false);
		});
	}

	return items;
}

export function kindToIssueType(kind: ImageAltIssue['issue']): MissingAltIssueType {
	if (kind === '공백') return 'empty';
	if (kind === '불용어 사용') return 'stopword';
	return 'missing';
}

export function toMissingAltImage(issue: ImageAltIssue, lang: PageDisplayLang = 'ko'): MissingAltImage {
	const row = toMissingImageRow(issue, lang);
	return {
		pageUrl: row.page_url,
		pageDisplay: row.page_display || formatPageDisplay(row.page_url, lang),
		imgSrc: row.img_src,
		normalizedSrc: row.normalized_src || '',
		currentAlt: row.current_alt,
		issueType: issue.issueType || row.issue_type || kindToIssueType(issue.issue),
		suggestedAlt: row.suggested_alt,
		issue: row.issue,
	};
}

export function collectMissingAltImages(
	$: CheerioAPI,
	opts?: { pageUrl?: string; pageTitle?: string },
): { images: MissingAltImage[]; issues: ImageAltIssue[]; missing_images: MissingImageRow[]; total: number } {
	const collected = collectImageAltIssues($, opts);
	return {
		images: collected.issues.map((issue) => toMissingAltImage(issue)),
		issues: collected.issues,
		missing_images: collected.missing_images,
		total: collected.missing_images.length,
	};
}

function dedupeScripts(items: RenderBlockingScript[]): RenderBlockingScript[] {
	const seen = new Set<string>();
	const out: RenderBlockingScript[] = [];
	for (const item of items) {
		const key = `${item.pageUrl}::${item.scriptSrc}::${item.fullTag}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(item);
		if (out.length >= RENDER_BLOCKING_GLOBAL_CAP) break;
	}
	return out;
}

function dedupeAltIssues(items: ImageAltIssue[]): ImageAltIssue[] {
	const seen = new Set<string>();
	const out: ImageAltIssue[] = [];
	for (const item of items) {
		const key = `${item.pageUrl || ''}::${item.imgSrc || item.src}::${item.issue}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(item);
		if (out.length >= MISSING_ALT_GLOBAL_CAP) break;
	}
	return out;
}

const FRONT_MENU_SOURCES = new Set(['seed', 'gnb', 'sitemap']);
const DEEP_CRAWL_SOURCES = new Set([
	'bfs',
	'html_link',
	'cms_pattern',
	'gnuboard_board',
	'gnuboard_contents',
	'robots',
]);

export type CrawledResourcePage = {
	urlPath?: string;
	imagesTotal?: number;
	missingAlt?: number;
	imageAltIssues?: ImageAltIssue[];
	missing_images?: MissingImageRow[];
	missing_alt_list?: MissingImageRow[];
	missing_alt_images?: unknown[];
	imageSrcs?: string[];
	source?: string;
	renderBlockingScriptItems?: RenderBlockingScript[];
};

function pageAltIssues(page: CrawledResourcePage): ImageAltIssue[] {
	if (page.imageAltIssues?.length) return normalizeImageAltIssues(page.imageAltIssues);
	if (page.missing_images?.length) return normalizeImageAltIssues(page.missing_images);
	if (page.missing_alt_list?.length) return normalizeImageAltIssues(page.missing_alt_list);
	if (page.missing_alt_images?.length) return normalizeImageAltIssues(page.missing_alt_images);
	return [];
}

function normalizeFrontPath(raw: string | undefined): string {
	const path = pagePathOf(raw || '');
	if (!path) return '';
	const trimmed = path.replace(/\/+$/, '') || '/';
	return trimmed.toLowerCase();
}

function isBoardPostPath(path: string): boolean {
	return /[?&]wr_id=/i.test(path);
}

function isHomePath(path: string, homePath: string): boolean {
	const n = normalizeFrontPath(path);
	const home = normalizeFrontPath(homePath);
	return !n || n === '/' || n === home || /^\/index\.(php|html?)$/i.test(n);
}

/**
 * Homepage + GNB/실제 프론트 메뉴 + 사이트맵 공개 페이지만 허용.
 * BFS / 본문 임의 링크 / 게시글(wr_id) 은 Alt 커버리지에서 제외.
 */
export function isFrontExposedMenuPage(
	page: CrawledResourcePage,
	opts?: { homepageUrl?: string; frontPagePaths?: Iterable<string> },
): boolean {
	const path = page.urlPath || '';
	if (isBoardPostPath(path)) return false;
	if (isHomePath(path, opts?.homepageUrl || '/')) return false;
	const front = new Set(
		[...(opts?.frontPagePaths || [])].map(normalizeFrontPath).filter(Boolean),
	);
	const key = normalizeFrontPath(path);
	if (front.has(key)) return true;
	const source = compact(page.source).toLowerCase();
	if (source && FRONT_MENU_SOURCES.has(source)) return true;
	if (source && DEEP_CRAWL_SOURCES.has(source)) return false;
	return front.size === 0;
}

export function mergeSiteResourceTrackers(opts: {
	homepageUrl: string;
	homepageScripts: RenderBlockingScript[];
	homepageAltIssues: ImageAltIssue[];
	homepageImagesTotal: number;
	homepageMissingAlt: number;
	homepageImageSrcs?: string[];
	pageMetas?: CrawledResourcePage[] | null;
	frontPagePaths?: Iterable<string> | null;
}): {
	renderBlockingScriptItems: RenderBlockingScript[];
	imageAltIssues: ImageAltIssue[];
	missingAltImages: MissingAltImage[];
	missing_images: MissingImageRow[];
	imagesTotal: number;
	imagesMissingAlt: number;
	coveragePct: number;
	uniqueScriptSrcCount: number;
} {
	const scripts = [...(opts.homepageScripts || [])];
	const altIssues = [...(opts.homepageAltIssues || [])];
	const uniqueSrcs = new Set<string>();
	const uniqueMissingSrcs = new Set<string>();
	const rememberSrc = (raw: string | undefined) => {
		const src = compact(raw).split('#')[0].split('?')[0];
		if (!src || src.startsWith('data:')) return '';
		uniqueSrcs.add(src);
		return src;
	};

	for (const src of opts.homepageImageSrcs || []) rememberSrc(src);
	for (const issue of opts.homepageAltIssues || []) {
		const src = rememberSrc(issue.imgSrc || issue.src);
		if (src) uniqueMissingSrcs.add(src);
	}

	const frontFilter = {
		homepageUrl: opts.homepageUrl,
		frontPagePaths: opts.frontPagePaths || undefined,
	};

	for (const page of opts.pageMetas || []) {
		if (!isFrontExposedMenuPage(page, frontFilter)) continue;
		if (page.renderBlockingScriptItems?.length) {
			scripts.push(...page.renderBlockingScriptItems);
		}
		const pageIssues = pageAltIssues(page);
		if (pageIssues.length) {
			altIssues.push(...pageIssues);
			for (const issue of pageIssues) {
				const src = rememberSrc(issue.imgSrc || issue.src);
				if (src) uniqueMissingSrcs.add(src);
			}
		}
		if (page.imageSrcs?.length) {
			for (const src of page.imageSrcs) rememberSrc(src);
		}
	}

	const renderBlockingScriptItems = dedupeScripts(scripts);
	const imageAltIssues = dedupeAltIssues(altIssues);
	const missing_images = imageAltIssues.map((issue) => toMissingImageRow(issue));
	const uniqueScriptSrcCount = new Set(
		renderBlockingScriptItems.map((row) => row.scriptSrc).filter(Boolean),
	).size;

	const imagesTotal =
		uniqueSrcs.size > 0
			? uniqueSrcs.size
			: Math.max(0, opts.homepageImagesTotal || 0) +
				(opts.pageMetas || [])
					.filter((page) => isFrontExposedMenuPage(page, frontFilter))
					.reduce((sum, page) => sum + (page.imagesTotal || 0), 0);
	const imagesMissingAlt = missing_images.length;
	const uniqueMissing = uniqueMissingSrcs.size || imagesMissingAlt;
	const coveragePct =
		imagesTotal === 0 ? 100 : Math.round(((imagesTotal - Math.min(uniqueMissing, imagesTotal)) / imagesTotal) * 100);

	return {
		renderBlockingScriptItems,
		imageAltIssues,
		missingAltImages: imageAltIssues.map((issue) => toMissingAltImage(issue)),
		missing_images,
		imagesTotal,
		imagesMissingAlt,
		coveragePct,
		uniqueScriptSrcCount,
	};
}

/** Compact page-relative URL for badges (`홈 (/)` / `Home (/)` or pathname + query). */
export function displayPageUrl(pageUrl: string, lang: PageResourceLang = 'ko'): string {
	return formatPageDisplay(pageUrl, lang);
}

export function resolveOpenableUrl(href: string | undefined, fallback: string, pageUrl?: string): string | undefined {
	const raw = compact(href || fallback);
	if (!raw || raw.startsWith('data:')) return undefined;
	if (/^https?:\/\//i.test(raw)) return raw;
	if (!pageUrl) return undefined;
	try {
		return new URL(raw, pageUrl).href;
	} catch {
		return undefined;
	}
}

export function scriptElementAttrs(el: unknown): Record<string, string> {
	return attrMap(el);
}
