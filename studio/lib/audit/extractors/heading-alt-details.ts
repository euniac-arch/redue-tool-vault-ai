/**
 * On-page heading / image-alt pinpoint collectors for the detailed checklist.
 * Used by `parseHeadings` / `parseImages` so each defect stores path + tag text.
 */

import type { CheerioAPI } from 'cheerio';

export const IMAGE_ALT_ISSUE_CAP = 100;
export const IMAGE_SRC_CAP = 200;
export const HEADING_DETAIL_CAP = 80;
/** Truncate inline data:image src in report text (keep the full value for thumbs when short). */
export const DATA_IMAGE_DISPLAY_CAP = 48;
/** Skip thumbnail src when a data URI is too large for the 48×48 preview. */
export const DATA_IMAGE_THUMB_CAP = 8192;

export type PageDisplayLang = 'ko' | 'en';

/**
 * `all` — every <img> (legacy / unit tests).
 * `front` — homepage 공통+메인: chrome + content, skip hidden/utility.
 * `content` — 서브페이지 본문만: header/nav/footer/GNB chrome 제외.
 */
export type ImageCollectScope = 'all' | 'front' | 'content';

const CHROME_IMAGE_SELECTORS =
	'header, nav, footer, .gnb, #gnb, #hd, .header, #ft, .footer, #aside, aside, .lnb, #lnb';
const UTILITY_SRC_RE = /spacer|pixel|blank\.gif|transparent|tracking|1x1|clear\.gif/i;

export type ImageAltIssueKind = '누락' | '공백' | '불용어 사용';
export type MissingAltIssueType = 'missing' | 'empty' | 'stopword';
export type MissingImageIssueLabel = 'alt 누락' | '공백(alt="")' | '불용어(image/사진 등)';

export interface ImageAltIssue {
	src: string;
	alt: string;
	issue: ImageAltIssueKind;
	selector: string;
	/** Absolute URL when the page origin is known (thumbnail / open). */
	href?: string;
	/** Absolute (or short data:) URL used by the 48×48 thumbnail. */
	normalizedSrc?: string;
	suggestedAlt?: string;
	/** Page URL where this <img> was found (homepage or crawled subpage). */
	pageUrl?: string;
	/** UI path badge: `홈 (/)` / `Home (/)` or the real request path. */
	pageDisplay?: string;
	/** Machine issue type aligned with the missing_alt_images schema. */
	issueType?: MissingAltIssueType;
	/** Raw src as declared on the tag (not truncated). */
	imgSrc?: string;
	/** UI label bound onto details.missing_images. */
	issueLabel?: MissingImageIssueLabel;
}

/** CMS-agnostic missing-alt row persisted on the report / cache. */
export interface MissingAltImageRecord {
	page_url: string;
	page_display: string;
	img_src: string;
	normalized_src: string;
	issue_type: MissingAltIssueType;
	suggested_alt: string;
}

/** Report-facing missing-alt row (snake_case) — collector always fills the new fields. */
export interface MissingImageRow {
	page_url: string;
	page_display?: string;
	img_src: string;
	normalized_src?: string;
	current_alt: string;
	issue: MissingImageIssueLabel;
	issue_type?: MissingAltIssueType;
	suggested_alt: string;
}

export interface H1ElementDetail {
	text: string;
	selector: string;
	/** 1-based document order. */
	index?: number;
}

export interface HeadingSkipDetail {
	from: 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6' | string;
	to: 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6' | string;
	text: string;
	selector: string;
}

export interface HeadingOutlineNode {
	level: number;
	text: string;
	selector: string;
	/** True when this heading jumped more than one level from the previous. */
	skip?: boolean;
	fromLevel?: number;
}

const ALT_STOPWORDS = new Set([
	'image',
	'images',
	'img',
	'photo',
	'photos',
	'picture',
	'pic',
	'graphic',
	'untitled',
	'default',
	'null',
	'undefined',
	'spacer',
	'pixel',
	'dummy',
	'사진',
	'이미지',
	'그림',
	'사진입니다',
	'이미지입니다',
]);

const STOPWORD_PREFIX_RE = /^(image|img|photo|picture|pic|graphic|사진|이미지|그림)[\s_\-]*\d*$/i;
const GENERIC_FILE_STEM_RE =
	/^(img|image|photo|pic|picture|banner|icon|logo|thumb|thumbnail|visual|dummy|spacer|untitled|default)[\s_\-]*\d*$/i;

type DomNode = {
	type?: string;
	name?: string;
	parent?: DomNode | null;
	children?: DomNode[];
};

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function headingLevelLabel(level: number): string {
	return `H${level}`;
}

export function isDecorativeImage(
	role: string | undefined,
	ariaHidden: string | undefined,
): boolean {
	const r = (role || '').toLowerCase();
	return r === 'presentation' || r === 'none' || ariaHidden === 'true';
}

export function isStopwordAlt(raw: string): boolean {
	const alt = compact(raw);
	if (!alt) return false;
	const lower = alt.toLowerCase();
	if (ALT_STOPWORDS.has(lower) || ALT_STOPWORDS.has(alt)) return true;
	if (/^\d+$/.test(alt)) return true;
	if (alt.length <= 1) return true;
	return STOPWORD_PREFIX_RE.test(alt);
}

export function issueKindToType(kind: ImageAltIssueKind): MissingAltIssueType {
	if (kind === '공백') return 'empty';
	if (kind === '불용어 사용') return 'stopword';
	return 'missing';
}

export function issueKindToLabel(kind: ImageAltIssueKind): MissingImageIssueLabel {
	if (kind === '공백') return '공백(alt="")';
	if (kind === '불용어 사용') return '불용어(image/사진 등)';
	return 'alt 누락';
}

export function issueTypeToKind(type: string | undefined): ImageAltIssueKind {
	if (type === 'empty' || type === '공백' || type === '공백(alt="")') return '공백';
	if (type === 'stopword' || type === '불용어 사용' || type === '불용어(image/사진 등)') return '불용어 사용';
	return '누락';
}

export function toMissingImageRow(
	issue: ImageAltIssue,
	lang: PageDisplayLang = 'ko',
): MissingImageRow {
	const kind = issue.issue || issueTypeToKind(issue.issueType);
	const pageUrl = compact(issue.pageUrl);
	const imgSrc = compact(issue.imgSrc || issue.src);
	const normalized =
		compact(issue.normalizedSrc) || compact(issue.href) || normalizeImageSrc(imgSrc, { pageUrl });
	return {
		page_url: pageUrl,
		page_display: compact(issue.pageDisplay) || formatPageDisplay(pageUrl, lang),
		img_src: imgSrc,
		normalized_src: normalized,
		current_alt: issue.alt ?? '',
		issue: issue.issueLabel || issueKindToLabel(kind),
		issue_type: issue.issueType || issueKindToType(kind),
		suggested_alt: compact(issue.suggestedAlt) || suggestImageAltText({ src: imgSrc, lang }),
	};
}

export function toMissingAltImageRecord(
	issue: ImageAltIssue,
	lang: PageDisplayLang = 'ko',
): MissingAltImageRecord {
	const row = toMissingImageRow(issue, lang);
	return {
		page_url: row.page_url,
		page_display: row.page_display || formatPageDisplay(row.page_url, lang),
		img_src: row.img_src,
		normalized_src: row.normalized_src || '',
		issue_type: row.issue_type || 'missing',
		suggested_alt: row.suggested_alt,
	};
}

function firstSrcsetCandidate(raw: string | undefined): string {
	const first = compact(raw).split(',')[0]?.trim() || '';
	return first.split(/\s+/)[0] || '';
}

function rawImageSrc($el: { attr: (name: string) => string | undefined }): string {
	return compact(
		$el.attr('src') ||
			$el.attr('data-src') ||
			$el.attr('data-lazy-src') ||
			$el.attr('data-original') ||
			$el.attr('data-lazy') ||
			firstSrcsetCandidate($el.attr('srcset') || $el.attr('data-srcset')),
	);
}

function hasAltAttribute($: CheerioAPI, el: unknown): boolean {
	const $el = $(el as never);
	try {
		if ($el.is('[alt]')) return true;
	} catch {
		/* keep */
	}
	const node = $el.get(0) as { attribs?: Record<string, string> } | undefined;
	if (node?.attribs && Object.prototype.hasOwnProperty.call(node.attribs, 'alt')) return true;
	return $el.attr('alt') !== undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function pickString(row: Record<string, unknown>, ...keys: string[]): string {
	for (const key of keys) {
		const value = row[key];
		if (typeof value === 'string') return value;
	}
	return '';
}

/** Accept camelCase, snake_case, and details.missing_images rows from stored reports. */
export function normalizeImageAltIssue(row: unknown): ImageAltIssue | null {
	const rec = asRecord(row);
	if (!rec) return null;
	const imgSrc = pickString(rec, 'imgSrc', 'img_src', 'src');
	const pageUrl = pickString(rec, 'pageUrl', 'page_url');
	const alt = pickString(rec, 'alt', 'currentAlt', 'current_alt');
	const issueRaw = pickString(rec, 'issue', 'issueLabel', 'issue_label');
	const issueType = pickString(rec, 'issueType', 'issue_type') || issueRaw;
	if (!imgSrc && !pageUrl && !issueRaw && !issueType) return null;
	const kind = issueTypeToKind(issueType || issueRaw);
	const suggestedAlt =
		pickString(rec, 'suggestedAlt', 'suggested_alt') ||
		suggestImageAltText({ src: imgSrc, pageTitle: '' });
	const normalizedSrc =
		pickString(rec, 'normalizedSrc', 'normalized_src', 'href') ||
		normalizeImageSrc(imgSrc, { pageUrl });
	const pageDisplay =
		pickString(rec, 'pageDisplay', 'page_display') || formatPageDisplay(pageUrl);
	return {
		src: imgSrc || '(src 없음)',
		alt,
		issue: kind,
		issueLabel: issueKindToLabel(kind),
		issueType: issueKindToType(kind),
		selector: pickString(rec, 'selector'),
		href: pickString(rec, 'href') || (normalizedSrc.startsWith('data:') ? '' : normalizedSrc) || undefined,
		normalizedSrc: normalizedSrc || undefined,
		pageUrl: pageUrl || undefined,
		pageDisplay: pageDisplay || undefined,
		imgSrc: imgSrc || undefined,
		suggestedAlt,
	};
}

export function normalizeImageAltIssues(rows: unknown): ImageAltIssue[] {
	if (!Array.isArray(rows)) return [];
	const out: ImageAltIssue[] = [];
	const seen = new Set<string>();
	for (const row of rows) {
		const issue = normalizeImageAltIssue(row);
		if (!issue) continue;
		const key = `${issue.pageUrl || ''}::${issue.imgSrc || issue.src}::${issue.issue}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(issue);
	}
	return out;
}

export function classifyImageAlt(
	hasAltAttr: boolean,
	rawAlt: string | undefined,
	opts?: { ariaLabel?: string; role?: string; ariaHidden?: string },
): ImageAltIssueKind | null {
	if (isDecorativeImage(opts?.role, opts?.ariaHidden)) return null;
	const aria = compact(opts?.ariaLabel);
	const alt = compact(rawAlt);
	if (!hasAltAttr) {
		if (aria) return null;
		return '누락';
	}
	if (!alt) return '공백';
	if (isStopwordAlt(alt)) return '불용어 사용';
	return null;
}

function safeIdent(value: string): boolean {
	return /^[A-Za-z_][\w-]*$/.test(value);
}

function tagNameOf(el: unknown): string {
	return String((el as DomNode | undefined)?.name || '').toLowerCase();
}

function siblingIndex(el: DomNode): number {
	const parent = el.parent;
	const tag = el.name?.toLowerCase();
	if (!parent?.children || !tag) return 1;
	const same = parent.children.filter((child) => child.type === 'tag' && child.name?.toLowerCase() === tag);
	const idx = same.indexOf(el);
	return idx >= 0 ? idx + 1 : 1;
}

/** Best-effort CSS path (id → class → nth-of-type) for pinpoint evidence. */
export function cssPath($: CheerioAPI, el: unknown, maxDepth = 7): string {
	const parts: string[] = [];
	let current: DomNode | null = (el as DomNode) || null;
	let depth = 0;

	while (current && depth < maxDepth) {
		const tag = (current.name || '').toLowerCase();
		if (!tag || tag === 'root' || tag === 'document' || current.type === 'root') break;

		const id = compact($(current as never).attr('id'));
		if (id && safeIdent(id)) {
			parts.unshift(`#${id}`);
			break;
		}

		const className = (compact($(current as never).attr('class')) || '')
			.split(/\s+/)
			.find((token) => safeIdent(token));
		const sameCount = current.parent
			? (current.parent.children || []).filter(
					(child) => child.type === 'tag' && child.name?.toLowerCase() === tag,
				).length
			: 1;
		const nth = sameCount > 1 ? `:nth-of-type(${siblingIndex(current)})` : '';
		parts.unshift(className ? `${tag}.${className}${nth}` : `${tag}${nth}`);

		current = current.parent || null;
		depth += 1;
	}

	return parts.join(' > ') || tagNameOf(el) || 'unknown';
}

function decodeSrcStem(raw: string): string {
	let decoded = compact(raw).split('#')[0].split('?')[0];
	if (!decoded) return '';
	try {
		decoded = decodeURIComponent(decoded);
	} catch {
		/* keep raw */
	}
	const base = decoded.replace(/\\/g, '/').split('/').pop() || decoded;
	return base.replace(/\.[a-z0-9]{2,5}$/i, '');
}

function humanizeStem(src: string): string {
	const stem = decodeSrcStem(src)
		.replace(/[-_]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (!stem || GENERIC_FILE_STEM_RE.test(stem) || /^\d+$/.test(stem)) return '';
	if (stem.length <= 1) return '';
	return stem.slice(0, 48);
}

function resolveDocumentBase(pageUrl?: string, origin?: string): string {
	const page = compact(pageUrl);
	const originRaw = compact(origin);
	if (page && /^https?:\/\//i.test(page)) return page;
	if (page && page.startsWith('//')) {
		try {
			return new URL(`https:${page}`).href;
		} catch {
			/* keep */
		}
	}
	if (originRaw) {
		try {
			const originHref = new URL(originRaw).origin;
			if (page) return new URL(page, `${originHref}/`).href;
			return `${originHref}/`;
		} catch {
			/* keep */
		}
	}
	return page;
}

function pagePathParts(pageUrl: string): { pathname: string; search: string } {
	const raw = compact(pageUrl);
	if (!raw) return { pathname: '', search: '' };
	try {
		const needsBase = !/^https?:\/\//i.test(raw) && !raw.startsWith('//');
		const url = needsBase ? new URL(raw, 'https://display.local') : new URL(raw);
		const pathname = url.pathname.replace(/\/+$/, '') || '/';
		return { pathname, search: url.search };
	} catch {
		const [path, query] = raw.split('?');
		const pathname = (path || '/').replace(/\/+$/, '') || '/';
		return { pathname, search: query ? `?${query}` : '' };
	}
}

/** True for `/`, `/index.php`, `/index.html`, empty — not `/?p=123`. */
export function isHomePagePath(pageUrl: string): boolean {
	const { pathname, search } = pagePathParts(pageUrl);
	if (search) return false;
	if (!pathname || pathname === '/') return true;
	return /^\/index\.(php|html?)$/i.test(pathname);
}

/** UI path badge: `홈 (/)` / `Home (/)` or the real request path + query. */
export function formatPageDisplay(pageUrl: string, lang: PageDisplayLang = 'ko'): string {
	if (isHomePagePath(pageUrl)) {
		return lang === 'en' ? 'Home (/)' : '홈 (/)';
	}
	const { pathname, search } = pagePathParts(pageUrl);
	if (!pathname && !search) return lang === 'en' ? 'Home (/)' : '홈 (/)';
	return `${pathname}${search}`;
}

const VAGUE_PAGE_LABELS = new Set(['', '/', '홈 (/)', 'Home (/)', '—', '-']);

/** True when the badge would only show a root slash / home placeholder. */
export function isVaguePageDisplay(value: string | undefined): boolean {
	const raw = compact(value);
	if (VAGUE_PAGE_LABELS.has(raw)) return true;
	return isHomePagePath(raw);
}

/**
 * Menu/subpage path for the location badge.
 * Returns empty when we only know `/` or home — callers should hide `/` and `➔`.
 */
export function meaningfulPageDisplay(
	pageUrl?: string,
	pageDisplay?: string,
	lang: PageDisplayLang = 'ko',
): string {
	const explicit = compact(pageDisplay);
	if (explicit && !isVaguePageDisplay(explicit)) return explicit;
	const formatted = formatPageDisplay(pageUrl || '', lang);
	if (formatted && !isVaguePageDisplay(formatted)) return formatted;
	return '';
}

function pushUnique(out: string[], value: string) {
	const src = compact(value);
	if (!src || out.includes(src)) return;
	out.push(src);
}

/** Thumbnail candidates: https first (avoid mixed-content), then the original http URL. */
export function thumbnailSrcCandidates(
	src: string,
	opts?: { pageUrl?: string; origin?: string; href?: string },
): string[] {
	const out: string[] = [];
	const normalized = normalizeImageSrc(src, { pageUrl: opts?.pageUrl, origin: opts?.origin });
	const extras = [compact(opts?.href), compact(src), normalized];
	for (const raw of extras) {
		if (!raw || raw.startsWith('data:')) {
			if (raw.startsWith('data:image/') && raw.length <= DATA_IMAGE_THUMB_CAP) pushUnique(out, raw);
			continue;
		}
		if (raw.startsWith('http://')) {
			pushUnique(out, `https://${raw.slice('http://'.length)}`);
			pushUnique(out, raw);
			continue;
		}
		if (raw.startsWith('https://')) {
			pushUnique(out, raw);
			continue;
		}
		const resolved = normalizeImageSrc(raw, { pageUrl: opts?.pageUrl, origin: opts?.origin });
		if (resolved.startsWith('http://')) {
			pushUnique(out, `https://${resolved.slice('http://'.length)}`);
		}
		pushUnique(out, resolved);
	}
	return out;
}

/**
 * Absolute image URL for thumbnails.
 * Protocol-relative, root-relative, and page-relative srcs resolve against origin + page URL.
 * Short `data:image/...` URIs are kept; oversized data URIs return empty (UI fallback).
 */
export function normalizeImageSrc(
	src: string,
	opts?: { pageUrl?: string; origin?: string },
): string {
	const raw = compact(src);
	if (!raw) return '';
	if (raw.startsWith('data:')) {
		return raw.length <= DATA_IMAGE_THUMB_CAP ? raw : '';
	}
	if (/^https?:\/\//i.test(raw)) return raw;

	const base = resolveDocumentBase(opts?.pageUrl, opts?.origin);
	if (raw.startsWith('//')) {
		try {
			if (base && /^https?:\/\//i.test(base)) {
				return new URL(raw, base).href;
			}
			return new URL(`https:${raw}`).href;
		} catch {
			return '';
		}
	}
	if (!base) return '';
	try {
		return new URL(raw, base).href;
	} catch {
		return '';
	}
}

export function resolveImageHref(
	src: string,
	pageUrl?: string,
	origin?: string,
): string | undefined {
	const normalized = normalizeImageSrc(src, { pageUrl, origin });
	if (!normalized || normalized.startsWith('data:')) return undefined;
	return normalized;
}

function usableNearbyText(value: string): string {
	const text = compact(value).slice(0, 80);
	if (!text || isStopwordAlt(text)) return '';
	return text;
}

/** Priority 1 context: figcaption → parent aria-label → preceding h2–h4. */
function nearbyCaption($: CheerioAPI, el: unknown): string {
	const $el = $(el as never);
	const fig = usableNearbyText($el.closest('figure').find('figcaption').first().text());
	if (fig) return fig;

	let parent = $el.parent();
	for (let i = 0; i < 4 && parent.length; i += 1) {
		const aria = usableNearbyText(parent.attr('aria-label') || '');
		if (aria) return aria;
		parent = parent.parent();
	}

	const prev = usableNearbyText($el.prevAll('h2,h3,h4').first().text());
	if (prev) return prev;

	parent = $el.parent();
	for (let i = 0; i < 6 && parent.length; i += 1) {
		const own = usableNearbyText(parent.children('h2,h3,h4').first().text());
		if (own) return own;
		const sib = usableNearbyText(parent.prevAll('h2,h3,h4').first().text());
		if (sib) return sib;
		parent = parent.parent();
	}
	return '';
}

export function suggestImageAltText(opts: {
	src: string;
	titleAttr?: string;
	nearby?: string;
	pageTitle?: string;
	lang?: PageDisplayLang;
}): string {
	const lang = opts.lang === 'en' ? 'en' : 'ko';
	const nearby = usableNearbyText(opts.nearby || '');
	if (nearby) return nearby;
	const titleAttr = usableNearbyText(opts.titleAttr || '');
	if (titleAttr) return titleAttr;
	const stem = humanizeStem(opts.src);
	const pageTitle = compact(opts.pageTitle);
	if (pageTitle && stem) return `${pageTitle} ${stem}`.slice(0, 80);
	if (pageTitle) {
		return lang === 'en' ? `${pageTitle} guide image`.slice(0, 80) : `${pageTitle} 안내 이미지`.slice(0, 80);
	}
	if (stem) return stem;
	return lang === 'en' ? 'Page guide image' : '페이지 안내 이미지';
}

export function displayImageSrc(raw: string): string {
	const src = compact(raw);
	if (!src) return '(src 없음)';
	if (src.startsWith('data:')) {
		return src.length > DATA_IMAGE_DISPLAY_CAP ? `${src.slice(0, DATA_IMAGE_DISPLAY_CAP)}…` : src;
	}
	return src.length > 180 ? `${src.slice(0, 180)}…` : src;
}

function displaySrc(raw: string): string {
	return displayImageSrc(raw);
}

function isInsideChromeImage($: CheerioAPI, el: unknown): boolean {
	try {
		return $(el as never).closest(CHROME_IMAGE_SELECTORS).length > 0;
	} catch {
		return false;
	}
}

function isUtilityOrHiddenImage($: CheerioAPI, el: unknown): boolean {
	const $el = $(el as never);
	const src = $el.attr('src') || $el.attr('data-src') || '';
	if (UTILITY_SRC_RE.test(src)) return true;
	const width = compact($el.attr('width'));
	const height = compact($el.attr('height'));
	if ((width === '1' || width === '0') && (height === '1' || height === '0')) return true;
	const style = $el.attr('style') || '';
	if (/display\s*:\s*none/i.test(style) || /visibility\s*:\s*hidden/i.test(style)) return true;
	try {
		if ($el.closest('template, noscript, script').length > 0) return true;
	} catch {
		/* keep */
	}
	return false;
}

export function shouldAuditImageAlt(
	$: CheerioAPI,
	el: unknown,
	scope: ImageCollectScope = 'all',
): boolean {
	if (scope === 'all') return true;
	if (isUtilityOrHiddenImage($, el)) return false;
	if (scope === 'content' && isInsideChromeImage($, el)) return false;
	return true;
}

export function collectImageAltIssues(
	$: CheerioAPI,
	opts?: {
		pageUrl?: string;
		pageTitle?: string;
		origin?: string;
		lang?: PageDisplayLang;
		scope?: ImageCollectScope;
	},
): {
	issues: ImageAltIssue[];
	missing_images: MissingImageRow[];
	missing_alt_images: MissingAltImageRecord[];
	total: number;
	audited: number;
	imageSrcs: string[];
} {
	const issues: ImageAltIssue[] = [];
	const imageSrcs: string[] = [];
	const seenSrc = new Set<string>();
	let total = 0;
	let audited = 0;
	const scope = opts?.scope || 'all';
	const lang = opts?.lang === 'en' ? 'en' : 'ko';
	const pageUrl = compact(opts?.pageUrl);
	const pageDisplay = formatPageDisplay(pageUrl, lang);
	$('img').each((_, el) => {
		if (!shouldAuditImageAlt($, el, scope)) return;
		audited += 1;
		const $el = $(el);
		const src = rawImageSrc($el);
		const rawSrc = compact(src);
		if (rawSrc && !seenSrc.has(rawSrc) && imageSrcs.length < IMAGE_SRC_CAP) {
			seenSrc.add(rawSrc);
			imageSrcs.push(rawSrc);
		}
		const hasAltAttr = hasAltAttribute($, el);
		const issue = classifyImageAlt(hasAltAttr, $el.attr('alt'), {
			ariaLabel: $el.attr('aria-label'),
			role: $el.attr('role'),
			ariaHidden: $el.attr('aria-hidden'),
		});
		if (!issue) return;
		total += 1;
		if (issues.length >= IMAGE_ALT_ISSUE_CAP) return;
		const alt = hasAltAttr ? ($el.attr('alt') ?? '') : '';
		const suggestedAlt = suggestImageAltText({
			src,
			titleAttr: $el.attr('title'),
			nearby: nearbyCaption($, el),
			pageTitle: opts?.pageTitle,
			lang,
		});
		const normalizedSrc = normalizeImageSrc(src, { pageUrl, origin: opts?.origin });
		issues.push({
			src: displaySrc(src),
			alt,
			issue,
			issueLabel: issueKindToLabel(issue),
			issueType: issueKindToType(issue),
			selector: cssPath($, el),
			href: resolveImageHref(src, pageUrl, opts?.origin),
			normalizedSrc: normalizedSrc || undefined,
			pageUrl: pageUrl || undefined,
			pageDisplay,
			imgSrc: rawSrc || displaySrc(src),
			suggestedAlt,
		});
	});
	const missing_images = issues.map((issue) => toMissingImageRow(issue, lang));
	const missing_alt_images = issues.map((issue) => toMissingAltImageRecord(issue, lang));
	return { issues, missing_images, missing_alt_images, total, audited, imageSrcs };
}

export function collectH1Elements($: CheerioAPI): H1ElementDetail[] {
	const out: H1ElementDetail[] = [];
	$('h1').each((i, el) => {
		if (out.length >= HEADING_DETAIL_CAP) return;
		out.push({
			text: compact($(el).text()),
			selector: cssPath($, el),
			index: i + 1,
		});
	});
	return out;
}

export function collectHeadingOutline($: CheerioAPI): {
	outline: HeadingOutlineNode[];
	skips: HeadingSkipDetail[];
	skipExamples: string[];
	levels: number[];
} {
	const outline: HeadingOutlineNode[] = [];
	const skips: HeadingSkipDetail[] = [];
	const skipExamples: string[] = [];
	const levels: number[] = [];

	$('h1,h2,h3,h4,h5,h6').each((_, el) => {
		const tag = tagNameOf(el);
		const level = Number(tag.replace('h', ''));
		if (!Number.isFinite(level) || level < 1 || level > 6) return;
		const text = compact($(el).text());
		const selector = cssPath($, el);
		const prev = levels[levels.length - 1];
		const skipped = prev != null && level > prev + 1;
		if (skipped && prev != null) {
			if (skips.length < HEADING_DETAIL_CAP) {
				skips.push({
					from: headingLevelLabel(prev),
					to: headingLevelLabel(level),
					text,
					selector,
				});
			}
			if (skipExamples.length < 3) {
				skipExamples.push(`h${prev} → h${level}`);
			}
		}
		if (outline.length < HEADING_DETAIL_CAP) {
			outline.push({
				level,
				text,
				selector,
				skip: skipped || undefined,
				fromLevel: skipped && prev != null ? prev : undefined,
			});
		}
		levels.push(level);
	});

	return { outline, skips, skipExamples, levels };
}

export function missingHeadingLevels(fromLevel: number, toLevel: number): string {
	const missing: string[] = [];
	for (let level = fromLevel + 1; level < toLevel; level += 1) {
		missing.push(headingLevelLabel(level));
	}
	return missing.join(', ');
}
