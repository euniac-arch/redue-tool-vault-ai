/**
 * Deep logo resolution — find a real brand mark even when header/meta tags omit it.
 *
 * 1. JSON-LD Organization / LocalBusiness / MedicalBusiness `logo` | `image`
 * 2. Header / nav / logo-chrome `<img>`
 * 3. Inline SVG in header / home-link (data:image/svg+xml;base64)
 * 4. Web App Manifest icons (192 / 512)
 * 5. Common logo-path probing on the origin
 * 6. Clearbit Logo API
 * Final: Apple Touch Icon → og:image → Google Favicon V2 (128px)
 */

import * as cheerio from 'cheerio';
import type { CheerioAPI, Element } from 'cheerio';
import { normalizeSchemaType, parseJsonLdDocument } from '@/lib/audit/parser';

export type { ReportLogoSource } from '@/lib/audit/logo-url';
export { resolveReportLogoUrl } from '@/lib/audit/logo-url';

const SCHEMA_LOGO_TYPES = new Set([
	'Organization',
	'LocalBusiness',
	'MedicalBusiness',
	'MedicalClinic',
	'Hospital',
	'Dentist',
	'Physician',
	'VeterinaryCare',
	'Pharmacy',
	'Corporation',
	'NewsMediaOrganization',
	'NGO',
	'GovernmentOrganization',
	'ProfessionalService',
	'Store',
	'Restaurant',
	'BeautySalon',
	'HealthClub',
	'ExerciseGym',
	'EducationalOrganization',
	'RealEstateAgent',
	'Manufacturer',
	'AccountingService',
	'HomeAndConstructionBusiness',
	'LegalService',
	'Attorney',
]);

const PRIMARY_SCHEMA_TYPES = new Set(['Organization', 'LocalBusiness', 'MedicalBusiness']);

const JUNK_SRC_RE = /pixel|spacer|1x1|tracking|analytics|facebook\.com\/tr|google-analytics/i;
const LOGO_HINT_RE = /logo|로고/i;
const SKIP_URL_RE = /^(?:data:|blob:|javascript:|about:)/i;
const SVG_MAX_CHARS = 80_000;

export interface ExtractSiteLogoOptions {
	rawHtml?: string;
	schemaNodes?: Record<string, unknown>[];
	ogImage?: string | null;
}

/** Resolve a crawled or relative logo path to an absolute http(s) URL. */
export function toAbsoluteLogoUrl(raw: string | undefined | null, pageUrl: string): string | null {
	const value = (raw || '').trim();
	if (!value || SKIP_URL_RE.test(value)) return null;

	try {
		if (/^https?:\/\//i.test(value)) {
			const abs = new URL(value);
			if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return null;
			return abs.href;
		}
		if (value.startsWith('//')) {
			const proto = new URL(pageUrl).protocol || 'https:';
			return new URL(`${proto}${value}`).href;
		}
		return new URL(value, pageUrl).href;
	} catch {
		return null;
	}
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
	if (value == null) return [];
	return Array.isArray(value) ? value : [value];
}

function typeList(node: Record<string, unknown>): string[] {
	return asArray(node['@type'])
		.filter((t): t is string => typeof t === 'string')
		.map(normalizeSchemaType)
		.filter(Boolean);
}

function isSchemaLogoType(node: Record<string, unknown>): boolean {
	return typeList(node).some((t) => SCHEMA_LOGO_TYPES.has(t));
}

function isPrimarySchemaType(node: Record<string, unknown>): boolean {
	return typeList(node).some((t) => PRIMARY_SCHEMA_TYPES.has(t));
}

function imageUrlFromValue(value: unknown): string | null {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed && !SKIP_URL_RE.test(trimmed) ? trimmed : null;
	}
	if (Array.isArray(value)) {
		for (const item of value) {
			const url = imageUrlFromValue(item);
			if (url) return url;
		}
		return null;
	}
	if (value && typeof value === 'object') {
		const obj = value as Record<string, unknown>;
		for (const key of ['url', 'contentUrl', 'src', '@id'] as const) {
			const url = imageUrlFromValue(obj[key]);
			if (url) return url;
		}
	}
	return null;
}

function flattenJsonLd(value: unknown, out: Record<string, unknown>[]): void {
	if (value == null) return;
	if (Array.isArray(value)) {
		value.forEach((item) => flattenJsonLd(item, out));
		return;
	}
	if (typeof value !== 'object') return;
	const obj = value as Record<string, unknown>;
	const graph = obj['@graph'];
	if (graph != null) {
		flattenJsonLd(graph, out);
		if (typeList(obj).length === 0) return;
	}
	out.push(obj);
}

export function readLogoSchemaNodes($: CheerioAPI, rawHtml?: string): Record<string, unknown>[] {
	const nodes: Record<string, unknown>[] = [];
	const bodies: string[] = [];

	$('script').each((_, el) => {
		const type = (($(el).attr('type') || '') + '').toLowerCase();
		if (!type.includes('ld+json')) return;
		const body = ($(el).contents().text() || $(el).html() || '').trim();
		if (body) bodies.push(body);
	});

	if (bodies.length === 0 && rawHtml) {
		const re = /<script\b(?=[^>]*?\btype\s*=\s*["']?application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/gi;
		let match: RegExpExecArray | null;
		while ((match = re.exec(rawHtml)) != null) {
			const body = (match[1] || '').trim();
			if (body) bodies.push(body);
		}
	}

	for (const raw of bodies) {
		const parsed = parseJsonLdDocument(raw);
		if (parsed != null) flattenJsonLd(parsed, nodes);
	}
	return nodes;
}

function pickSchemaImage(nodes: Record<string, unknown>[], preferPrimary: boolean): string | null {
	const pool = preferPrimary ? nodes.filter(isPrimarySchemaType) : nodes.filter(isSchemaLogoType);
	for (const node of pool) {
		const logo = imageUrlFromValue(node.logo);
		if (logo) return logo;
	}
	for (const node of pool) {
		const image = imageUrlFromValue(node.image);
		if (image) return image;
	}
	return null;
}

export function extractSchemaLogoUrl(
	nodes: Record<string, unknown>[],
	pageUrl: string,
): string | null {
	const raw = pickSchemaImage(nodes, true) || pickSchemaImage(nodes, false);
	return raw ? toAbsoluteLogoUrl(raw, pageUrl) : null;
}

function attrHasLogoHint(...values: Array<string | undefined>): boolean {
	return values.some((value) => Boolean(value && LOGO_HINT_RE.test(value)));
}

function pickLargestSrcset(srcset: string | undefined): string | null {
	if (!srcset?.trim()) return null;
	let bestUrl = '';
	let bestScore = -1;
	for (const part of srcset.split(',')) {
		const tokens = part.trim().split(/\s+/);
		const url = tokens[0];
		if (!url) continue;
		const desc = tokens[1] || '1x';
		const w = desc.endsWith('w') ? Number(desc.slice(0, -1)) : 0;
		const x = desc.endsWith('x') ? Number(desc.slice(0, -1)) : 0;
		const score = w || x * 100 || 1;
		if (score > bestScore) {
			bestScore = score;
			bestUrl = url;
		}
	}
	return bestUrl || null;
}

function rawImgSrc($: CheerioAPI, el: Element): string {
	const $el = $(el);
	return (
		$el.attr('src')?.trim() ||
		$el.attr('data-src')?.trim() ||
		$el.attr('data-lazy-src')?.trim() ||
		$el.attr('data-original')?.trim() ||
		pickLargestSrcset($el.attr('srcset') || $el.attr('data-srcset')) ||
		''
	);
}

function isJunkImage($: CheerioAPI, el: Element, src: string): boolean {
	if (!src || JUNK_SRC_RE.test(src)) return true;
	const $el = $(el);
	const width = Number($el.attr('width'));
	const height = Number($el.attr('height'));
	if (width === 1 && height === 1) return true;
	return false;
}

function firstValidImgUrl($: CheerioAPI, els: Element[], pageUrl: string): string | null {
	for (const el of els) {
		const src = rawImgSrc($, el);
		if (isJunkImage($, el, src)) continue;
		const abs = toAbsoluteLogoUrl(src, pageUrl);
		if (abs) return abs;
	}
	return null;
}

function collectScopedImgs($: CheerioAPI, scopes: string[]): Element[] {
	const seen = new Set<Element>();
	const out: Element[] = [];
	for (const sel of scopes) {
		$(sel).each((_, el) => {
			if (seen.has(el)) return;
			seen.add(el);
			out.push(el);
		});
	}
	return out;
}

export function extractHeaderLogoUrl($: CheerioAPI, pageUrl: string): string | null {
	const preciseSelectors = [
		'header img[alt*="logo" i]',
		'header img[alt*="로고"]',
		'header img[class*="logo" i]',
		'header img[id*="logo" i]',
		'nav img[alt*="logo" i]',
		'nav img[alt*="로고"]',
		'nav img[class*="logo" i]',
		'a.logo img',
		'a[class*="logo" i] img',
		'a[id*="logo" i] img',
	];
	const precise = firstValidImgUrl($, collectScopedImgs($, preciseSelectors), pageUrl);
	if (precise) return precise;

	const chromeImgs = collectScopedImgs($, [
		'header img',
		'nav img',
		'[class*="logo" i] img',
		'[id*="logo" i] img',
		'div[class*="logo" i] img',
		'div[id*="logo" i] img',
	]);
	const hinted = chromeImgs.filter((el) => {
		const $el = $(el);
		const parent = $el.parent();
		return attrHasLogoHint(
			$el.attr('alt'),
			$el.attr('class'),
			$el.attr('id'),
			$el.attr('src'),
			$el.attr('aria-label'),
			parent.attr('class'),
			parent.attr('id'),
			parent.attr('aria-label'),
		);
	});
	return firstValidImgUrl($, hinted.length ? hinted : chromeImgs.slice(0, 3), pageUrl);
}

function parseIconArea(sizes: string | undefined): number {
	const raw = (sizes || '').trim().toLowerCase();
	if (!raw) return 0;
	if (raw === 'any') return 512 * 512;
	let max = 0;
	for (const match of raw.matchAll(/(\d+)\s*x\s*(\d+)/gi)) {
		max = Math.max(max, Number(match[1]) * Number(match[2]));
	}
	return max;
}

function relTokens(rel: string | undefined): string[] {
	return (rel || '')
		.toLowerCase()
		.split(/\s+/)
		.map((token) => token.trim())
		.filter(Boolean);
}

export function extractIconLogoUrl($: CheerioAPI, pageUrl: string): string | null {
	type IconCandidate = { href: string; area: number; apple: boolean; any: boolean; exact180: boolean };

	const candidates: IconCandidate[] = [];
	$('link[rel]').each((_, el) => {
		const rels = relTokens($(el).attr('rel'));
		const apple = rels.some((r) => r === 'apple-touch-icon' || r === 'apple-touch-icon-precomposed');
		const icon = rels.some((r) => r === 'icon' || r === 'shortcut icon');
		if (!apple && !icon) return;
		const href = $(el).attr('href')?.trim();
		if (!href) return;
		const sizes = $(el).attr('sizes');
		const area = parseIconArea(sizes);
		candidates.push({
			href,
			area,
			apple,
			any: (sizes || '').trim().toLowerCase() === 'any',
			exact180: /180\s*x\s*180/i.test(sizes || ''),
		});
	});

	const appleExact = candidates.find((c) => c.apple && c.exact180);
	if (appleExact) return toAbsoluteLogoUrl(appleExact.href, pageUrl);

	const apples = candidates.filter((c) => c.apple).sort((a, b) => b.area - a.area);
	if (apples[0]) return toAbsoluteLogoUrl(apples[0].href, pageUrl);

	const anyIcon = candidates.find((c) => c.any);
	if (anyIcon) return toAbsoluteLogoUrl(anyIcon.href, pageUrl);

	const icons = candidates.filter((c) => !c.apple).sort((a, b) => b.area - a.area);
	if (icons[0]) return toAbsoluteLogoUrl(icons[0].href, pageUrl);

	return null;
}

export function extractOgImageUrl(
	$: CheerioAPI,
	pageUrl: string,
	fallback?: string | null,
): string | null {
	const raw =
		$('meta[property="og:image"]').attr('content')?.trim() ||
		$('meta[property="og:image:secure_url"]').attr('content')?.trim() ||
		$('meta[name="og:image"]').attr('content')?.trim() ||
		$('meta[name="twitter:image"]').attr('content')?.trim() ||
		(fallback || '').trim();
	return raw ? toAbsoluteLogoUrl(raw, pageUrl) : null;
}

function isHomeHref(href: string | undefined, pageUrl: string): boolean {
	const raw = (href || '').trim();
	if (!raw || raw === '#') return false;
	if (raw === '/' || raw === './' || raw === 'index.html' || raw === 'index.php') return true;
	try {
		const abs = new URL(raw, pageUrl || 'https://example.com/');
		const path = (abs.pathname || '/').replace(/\/+$/, '') || '/';
		return path === '/' || /\/index\.(html?|php)$/i.test(path);
	} catch {
		return false;
	}
}

function stripSvgScripts(svg: string): string {
	return svg
		.replace(/<script\b[\s\S]*?<\/script>/gi, '')
		.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

function toSvgDataUri(raw: string): string | null {
	let svg = stripSvgScripts((raw || '').trim());
	if (svg.length < 32 || svg.length > SVG_MAX_CHARS) return null;
	if (!/<svg[\s>]/i.test(svg)) return null;
	if (!/\sxmlns\s*=/.test(svg)) {
		svg = svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
	}
	return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

function svgHasLogoHint($: CheerioAPI, el: Element): boolean {
	const $el = $(el);
	const parent = $el.parent();
	const grand = parent.parent();
	return attrHasLogoHint(
		$el.attr('class'),
		$el.attr('id'),
		$el.attr('aria-label'),
		$el.attr('role'),
		parent.attr('class'),
		parent.attr('id'),
		parent.attr('aria-label'),
		grand.attr('class'),
		grand.attr('id'),
	);
}

export function extractInlineSvgLogoFromDom($: CheerioAPI, pageUrl = ''): string | null {
	const hinted: Element[] = [];
	const home: Element[] = [];
	const chrome: Element[] = [];

	$('header svg, nav svg, a.logo svg, [class*="logo" i] svg, [id*="logo" i] svg').each((_, el) => {
		if (svgHasLogoHint($, el)) hinted.push(el);
		else chrome.push(el);
	});

	$('header a svg, nav a svg, a svg').each((_, el) => {
		const href = $(el).closest('a').attr('href');
		if (isHomeHref(href, pageUrl)) home.push(el);
	});

	for (const el of [...hinted, ...home, ...chrome]) {
		const uri = toSvgDataUri($.html(el) || '');
		if (uri) return uri;
	}
	return null;
}

/** Step 3 — inline SVG in header / home-link → data:image/svg+xml;base64. */
export function extractInlineSvgLogo(html: string, pageUrl = ''): string | null {
	return extractInlineSvgLogoFromDom(cheerio.load(html || ''), pageUrl);
}

/** Step 1 — JSON-LD Organization / LocalBusiness / MedicalBusiness logo. */
export function extractSchemaLogo(html: string, baseUrl: string): string | null {
	const $ = cheerio.load(html || '');
	return extractSchemaLogoUrl(readLogoSchemaNodes($, html), baseUrl);
}

/** Step 2 — header/nav img[alt|class|id*="logo"]. */
export function extractDomImgLogo(html: string, baseUrl: string): string | null {
	return extractHeaderLogoUrl(cheerio.load(html || ''), baseUrl);
}


export function pickManifestIconUrl(manifest: unknown, baseUrl: string): string | null {
	if (!manifest || typeof manifest !== 'object') return null;
	const icons = (manifest as { icons?: unknown }).icons;
	if (!Array.isArray(icons) || icons.length === 0) return null;

	const scored = icons
		.map((icon) => {
			if (!icon || typeof icon !== 'object') return null;
			const src = String((icon as { src?: unknown }).src || '').trim();
			if (!src) return null;
			const sizes = String((icon as { sizes?: unknown }).sizes || '');
			let area = 0;
			if (sizes.toLowerCase() === 'any') area = 512 * 512;
			for (const match of sizes.matchAll(/(\d+)\s*x\s*(\d+)/gi)) {
				area = Math.max(area, Number(match[1]) * Number(match[2]));
			}
			const prefer =
				area === 512 * 512 ? 3 : area === 192 * 192 ? 2 : area >= 180 * 180 ? 1 : 0;
			return { src, area, prefer };
		})
		.filter((row): row is { src: string; area: number; prefer: number } => row != null)
		.sort((a, b) => b.prefer - a.prefer || b.area - a.area);

	for (const row of scored) {
		const abs = toAbsoluteLogoUrl(row.src, baseUrl);
		if (abs) return abs;
	}
	return null;
}

export function extractSiteLogoUrl(
	$: CheerioAPI,
	pageUrl: string,
	options?: ExtractSiteLogoOptions,
): string | undefined {
	const nodes = options?.schemaNodes?.length ? options.schemaNodes : readLogoSchemaNodes($, options?.rawHtml);

	const schema = extractSchemaLogoUrl(nodes, pageUrl);
	if (schema) return schema;

	const header = extractHeaderLogoUrl($, pageUrl);
	if (header) return header;

	const svg = extractInlineSvgLogoFromDom($, pageUrl);
	if (svg) return svg;

	const icon = extractIconLogoUrl($, pageUrl);
	if (icon) return icon;

	const og = extractOgImageUrl($, pageUrl, options?.ogImage);
	return og || undefined;
}
