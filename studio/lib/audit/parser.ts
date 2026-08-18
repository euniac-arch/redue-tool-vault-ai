import type { CheerioAPI } from 'cheerio';
import { extractPureUrl } from '@/lib/audit/canonical-url';

export interface ParsedMeta {
	/** Full document `<title>` (for SEO length checks). */
	title: string;
	titleLength: number;
	/**
	 * Page-specific title with shared site/brand suffix stripped
	 * (e.g. "연구소 소개 | 한국중입자 암치료연구소" → "연구소 소개").
	 */
	pageTitle: string;
	metaDescription: string;
	metaDescriptionLength: number;
	canonical: string | null;
	ogTitle: string | null;
	ogDescription: string | null;
	ogImage: string | null;
	htmlLang: string | null;
}

export interface ParsedHeadings {
	h1Count: number;
	/** Content-scoped H1 / .sub_title texts (chrome/GNB excluded). */
	h1Texts: string[];
	/** Content-scoped H2 texts (chrome/GNB excluded). */
	h2Texts: string[];
	levels: number[];
	hasSkip: boolean;
	skipExamples: string[];
	hasH1ToH3: boolean;
}

export interface NavLinkItem {
	name: string;
	url: string;
}

/** Main content containers preferred over full-document / GNB chrome. */
const MAIN_CONTENT_SELECTORS = [
	'#sub_contents',
	'#container',
	'#contents',
	'#content',
	'#wrapper',
	'main',
	'[role="main"]',
	'.sub_contents',
	'.sub-content',
	'.content',
	'#bo_v',
	'#bo_list',
	'.board_list',
];

/** Shared chrome that must not contribute page H1 / sub_title. */
const CHROME_SELECTORS = 'header, nav, footer, .gnb, #gnb, #hd, .header, #ft, .footer, #aside, aside, .lnb, #lnb';

const TITLE_SPLIT_RE = /\s*[|｜\-–—·•:>»／/]\s*/;

export interface SchemaNodeSummary {
	type: string;
	missingRequired: string[];
	presentKeys: string[];
}

export interface ParsedSchema {
	rawBlockCount: number;
	validBlockCount: number;
	parseErrors: number;
	types: string[];
	nodes: SchemaNodeSummary[];
	/** Truncated raw JSON-LD blocks for technical evidence in B2B reports. */
	snippets: string[];
	organizationMissing: string[];
	articleMissing: string[];
	personMissing: string[];
	hasOrganization: boolean;
	hasArticle: boolean;
	hasNewsArticle: boolean;
	hasAboutPage: boolean;
	hasMedicalWebPage: boolean;
	hasPerson: boolean;
	hasWebSite: boolean;
	hasWebPage: boolean;
	hasBreadcrumb: boolean;
	hasFaqOrHowTo: boolean;
	hasBusinessOrApp: boolean;
	/** Best-effort NAP from Organization / LocalBusiness / Person nodes. */
	nap: ParsedNap;
}

export interface ParsedImages {
	total: number;
	missingAlt: number;
	coveragePct: number;
}

export interface PageParseResult {
	meta: ParsedMeta;
	headings: ParsedHeadings;
	schema: ParsedSchema;
	images: ParsedImages;
	bodyTextLength: number;
	renderBlockingScripts: number;
	/** Same-origin internal link hrefs (path + query) discovered on the page. */
	internalLinks: string[];
}

const ORG_REQUIRED = ['name', 'url', 'logo', 'sameAs'] as const;
const LOCAL_NAP_REQUIRED = ['telephone', 'address'] as const;
const ARTICLE_REQUIRED = ['headline', 'image', 'datePublished', 'author', 'publisher'] as const;
const PERSON_REQUIRED = ['name'] as const;
/** LocalBusiness subtypes + professional entities that satisfy the Organization NAP check. */
const ORG_LIKE_TYPES = new Set([
	'Organization',
	'NewsMediaOrganization',
	'Corporation',
	'NGO',
	'GovernmentOrganization',
	'SportsOrganization',
	'LocalBusiness',
	'MedicalClinic',
	'MedicalBusiness',
	'Hospital',
	'Dentist',
	'Physician',
	'VeterinaryCare',
	'Pharmacy',
	'LegalService',
	'Attorney',
	'Store',
	'Restaurant',
	'BeautySalon',
	'HealthClub',
	'ExerciseGym',
	'EducationalOrganization',
	'RealEstateAgent',
	'ProfessionalService',
	'Manufacturer',
	'AccountingService',
	'HomeAndConstructionBusiness',
]);

const LOCAL_NAP_TYPES = new Set([
	'LocalBusiness',
	'MedicalClinic',
	'MedicalBusiness',
	'Hospital',
	'Dentist',
	'Physician',
	'VeterinaryCare',
	'Pharmacy',
	'LegalService',
	'Attorney',
	'Store',
	'Restaurant',
	'BeautySalon',
	'HealthClub',
	'ExerciseGym',
	'RealEstateAgent',
	'ProfessionalService',
	'AccountingService',
	'HomeAndConstructionBusiness',
]);
/** Soft E-E-A-T identifiers — at least one strengthens author graph. */
const PERSON_IDENTIFIERS = ['url', 'sameAs', 'jobTitle', 'worksFor', 'image', 'description'] as const;

function asArray<T>(value: T | T[] | undefined | null): T[] {
	if (value == null) return [];
	return Array.isArray(value) ? value : [value];
}

/** Strip schema.org URL / CURIE prefixes so FAQPage === https://schema.org/FAQPage. */
export function normalizeSchemaType(type: string): string {
	const t = (type || '').trim();
	if (!t) return '';
	const schemaOrg = t.match(/^(?:https?:\/\/)?(?:www\.)?schema\.org\/(.+)$/i);
	if (schemaOrg?.[1]) return schemaOrg[1]!.trim();
	const slash = t.lastIndexOf('/');
	if (slash >= 0 && slash < t.length - 1 && /:/.test(t.slice(0, slash))) {
		return t.slice(slash + 1).trim();
	}
	return t;
}

function typeList(node: Record<string, unknown>): string[] {
	return asArray(node['@type'])
		.filter((t): t is string => typeof t === 'string')
		.map(normalizeSchemaType)
		.filter(Boolean);
}

function hasType(node: Record<string, unknown>, type: string): boolean {
	const want = normalizeSchemaType(type);
	return typeList(node).some((t) => t === want);
}

export function isOrganizationLikeType(type: string): boolean {
	return ORG_LIKE_TYPES.has(normalizeSchemaType(type));
}

function hasOrgLikeType(node: Record<string, unknown>): boolean {
	return typeList(node).some(isOrganizationLikeType);
}

/**
 * Match `<script type="application/ld+json…">` regardless of attribute order,
 * quoting, or trailing charset parameters (e.g. `application/ld+json;charset=utf-8`).
 */
const LD_JSON_SCRIPT_RE =
	/<script\b(?=[^>]*?\btype\s*=\s*["']?application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/gi;

/** Remove BOM / HTML-comment / CDATA wrappers CMS tools often emit around JSON-LD. */
export function sanitizeJsonLdRaw(raw: string): string {
	let s = (raw || '').replace(/^\uFEFF/, '').trim();
	if (!s) return '';

	// Whole-payload HTML comment: <!--{...}-->
	if (s.startsWith('<!--')) {
		s = s.replace(/^<!--\s*/, '').replace(/\s*-->$/, '').trim();
	}

	// CDATA / JS-style CDATA wrappers
	s = s
		.replace(/^\/\/\s*<!\[CDATA\[\s*/i, '')
		.replace(/\s*\/\/\s*\]\]>\s*$/i, '')
		.replace(/^<!\[CDATA\[\s*/i, '')
		.replace(/\s*\]\]>\s*$/i, '')
		.trim();

	// Entity-encoded JSON occasionally survives in the raw HTML buffer
	if (/&(?:quot|#34|amp|#39|lt|gt);/i.test(s)) {
		s = s
			.replace(/&quot;/gi, '"')
			.replace(/&#34;/g, '"')
			.replace(/&amp;/gi, '&')
			.replace(/&#39;/g, "'")
			.replace(/&lt;/gi, '<')
			.replace(/&gt;/gi, '>');
	}

	return s.trim();
}

/**
 * Repair CMS-emitted JSON-LD (trailing commas, block/line comments) so
 * `JSON.parse` can recover blocks that would otherwise count as parse errors.
 */
export function repairJsonLdText(raw: string): string {
	let s = sanitizeJsonLdRaw(raw);
	if (!s) return '';
	s = s.replace(/\/\*[\s\S]*?\*\//g, '');
	s = s.replace(/^\s*\/\/[^\n]*/gm, '');
	s = s.replace(/,\s*([}\]])/g, '$1');
	return s.trim();
}

export function parseJsonLdDocument(raw: string): unknown | null {
	const cleaned = sanitizeJsonLdRaw(raw);
	if (!cleaned) return null;
	try {
		return JSON.parse(cleaned);
	} catch {
		const repaired = repairJsonLdText(cleaned);
		if (!repaired) return null;
		try {
			return JSON.parse(repaired);
		} catch {
			return null;
		}
	}
}

/**
 * Extract every `application/ld+json` script body from the full HTML buffer.
 * Prefer this over Cheerio attribute selectors — they miss charset suffixes and
 * some CMS attribute orderings.
 */
export function extractJsonLdScriptBodies(html: string): string[] {
	if (!html) return [];
	const out: string[] = [];
	const re = new RegExp(LD_JSON_SCRIPT_RE.source, LD_JSON_SCRIPT_RE.flags);
	let match: RegExpExecArray | null;
	while ((match = re.exec(html)) != null) {
		const body = sanitizeJsonLdRaw(match[1] || '');
		if (body) out.push(body);
	}
	return out;
}

function isPresent(value: unknown): boolean {
	if (value == null) return false;
	if (typeof value === 'string') return value.trim().length > 0;
	if (Array.isArray(value)) return value.length > 0;
	if (typeof value === 'object') return Object.keys(value as object).length > 0;
	return true;
}

function missingKeys(node: Record<string, unknown>, keys: readonly string[]): string[] {
	return keys.filter((key) => !isPresent(node[key]));
}

/**
 * Flatten JSON-LD payloads into node objects, expanding `@graph` arrays
 * (and nested graphs) so @type presence checks see FAQPage / NewsArticle / etc.
 */
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
		// Keep the wrapper only when it itself declares an @type.
		if (typeList(obj).length === 0) return;
	}
	out.push(obj);
}

function collectJsonLdBodies($: CheerioAPI, rawHtml?: string): string[] {
	const fromHtml = extractJsonLdScriptBodies(rawHtml ?? '');
	if (fromHtml.length > 0) return fromHtml;

	// Cheerio fallback — soft type match covers charset suffixes the exact selector misses.
	const fromDom: string[] = [];
	$('script').each((_, el) => {
		const type = (($(el).attr('type') || '') + '').toLowerCase();
		if (!type.includes('ld+json')) return;
		const body = sanitizeJsonLdRaw($(el).contents().text() || $(el).html() || '');
		if (body) fromDom.push(body);
	});
	return fromDom;
}

function summarizeNode(node: Record<string, unknown>): SchemaNodeSummary[] {
	const types = typeList(node);
	if (types.length === 0) return [];

	return types.map((type) => {
		let required: readonly string[] = [];
		if (isOrganizationLikeType(type)) {
			required = LOCAL_NAP_TYPES.has(type) ? [...ORG_REQUIRED, ...LOCAL_NAP_REQUIRED] : ORG_REQUIRED;
		} else if (type === 'Article' || type === 'NewsArticle' || type === 'BlogPosting') required = ARTICLE_REQUIRED;
		else if (type === 'Person') required = PERSON_REQUIRED;

		const missingRequired = missingKeys(node, required);
		if (type === 'Person') {
			const hasIdentifier = PERSON_IDENTIFIERS.some((key) => isPresent(node[key]));
			if (!hasIdentifier) missingRequired.push('profileIdentifier(url|sameAs|jobTitle…)');
		}

		return {
			type,
			missingRequired,
			presentKeys: Object.keys(node).filter((k) => !k.startsWith('@') && isPresent(node[k])),
		};
	});
}

/**
 * Split a document title into the page-specific segment by removing the shared
 * site/brand name (e.g. "한국중입자 암치료연구소").
 */
export function splitPageTitle(fullTitle: string, siteName?: string): string {
	const title = (fullTitle || '').replace(/\s+/g, ' ').trim();
	if (!title) return '';

	const parts = title.split(TITLE_SPLIT_RE).map((p) => p.trim()).filter(Boolean);
	const site = (siteName || '').replace(/\s+/g, ' ').trim();
	const siteNorm = site.replace(/\s+/g, '').toLowerCase();

	const isSitePart = (part: string): boolean => {
		if (!siteNorm) return false;
		const n = part.replace(/\s+/g, '').toLowerCase();
		if (!n) return true;
		if (n === siteNorm) return true;
		if (siteNorm.length >= 4 && (n.includes(siteNorm) || siteNorm.includes(n))) return true;
		return false;
	};

	if (parts.length >= 2) {
		const nonSite = parts.filter((p) => !isSitePart(p));
		if (nonSite.length > 0) {
			// Prefer the first non-site segment (common "페이지 | 사이트" pattern).
			return nonSite[0]!.slice(0, 80);
		}
	}

	if (site && parts.length === 1) {
		const escaped = site.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const stripped = title
			.replace(new RegExp(escaped, 'gi'), '')
			.replace(TITLE_SPLIT_RE, ' ')
			.replace(/\s+/g, ' ')
			.trim();
		if (stripped.length >= 2) return stripped.slice(0, 80);
	}

	return (parts[0] || title).slice(0, 80);
}

function normalizeHeadingText(raw: string): string {
	return raw.replace(/\s+/g, ' ').trim().slice(0, 80);
}

function isInsideChrome($: CheerioAPI, el: unknown): boolean {
	try {
		return $(el as never).closest(CHROME_SELECTORS).length > 0;
	} catch {
		return false;
	}
}

/**
 * Prefer H1 / .sub_title inside main content containers; never collect GNB chrome.
 */
export function extractContentScopedHeadings($: CheerioAPI): string[] {
	const out: string[] = [];
	const push = (text: string) => {
		const t = normalizeHeadingText(text);
		if (!t) return;
		if (out.some((x) => x === t)) return;
		out.push(t);
	};

	for (const sel of MAIN_CONTENT_SELECTORS) {
		const root = $(sel).first();
		if (!root.length) continue;
		root.find('h1').addBack('h1').each((_, el) => {
			if (isInsideChrome($, el)) return;
			push($(el).text());
		});
		if (out.length > 0) return out;
		root.find('.sub_title, .sub-title, .page_title, .page-title, #bo_v_title, .bo_v_tit').each((_, el) => {
			if (isInsideChrome($, el)) return;
			push($(el).text());
		});
		if (out.length > 0) return out;
	}

	// Fallback: document H1 / .sub_title excluding header/nav/.gnb
	$('h1').each((_, el) => {
		if (isInsideChrome($, el)) return;
		push($(el).text());
	});
	if (out.length > 0) return out;

	$('.sub_title, .sub-title, .page_title, .page-title, #bo_v_title, .bo_v_tit').each((_, el) => {
		if (isInsideChrome($, el)) return;
		push($(el).text());
	});

	return out;
}

/** Content-scoped H2 texts, excluding header/nav/GNB chrome. */
export function extractContentScopedH2($: CheerioAPI, max = 8): string[] {
	const out: string[] = [];
	const push = (text: string) => {
		const t = normalizeHeadingText(text);
		if (!t) return;
		if (out.some((x) => x === t)) return;
		out.push(t);
	};

	for (const sel of MAIN_CONTENT_SELECTORS) {
		const root = $(sel).first();
		if (!root.length) continue;
		root.find('h2').addBack('h2').each((_, el) => {
			if (out.length >= max) return false;
			if (isInsideChrome($, el)) return;
			push($(el).text());
		});
		if (out.length > 0) return out.slice(0, max);
	}

	$('h2').each((_, el) => {
		if (out.length >= max) return false;
		if (isInsideChrome($, el)) return;
		push($(el).text());
	});

	return out.slice(0, max);
}

export interface HydrationSignals {
	title?: string;
	description?: string;
	canonical?: string;
	ogTitle?: string;
	ogDescription?: string;
	ogImage?: string;
	schemaNodes: Record<string, unknown>[];
}

export interface ParsedNap {
	name: string | null;
	telephone: string | null;
	address: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function pickString(...values: unknown[]): string {
	for (const value of values) {
		if (typeof value === 'string' && value.trim()) return value.replace(/\s+/g, ' ').trim();
	}
	return '';
}

function walkHydration(value: unknown, out: HydrationSignals, depth = 0): void {
	if (value == null || depth > 8) return;
	if (Array.isArray(value)) {
		value.forEach((item) => walkHydration(item, out, depth + 1));
		return;
	}
	const obj = asRecord(value);
	if (!obj) return;

	if (obj['@type'] || obj['@context']) {
		out.schemaNodes.push(obj);
	}

	out.title = out.title || pickString(obj.title, obj.pageTitle, obj.headline);
	out.description = out.description || pickString(obj.description, obj.metaDescription, obj.excerpt);
	out.canonical = out.canonical || pickString(obj.canonical, obj.canonicalUrl);
	const seo = asRecord(obj.seo) || asRecord(obj.metadata) || asRecord(obj.meta);
	if (seo) {
		out.title = out.title || pickString(seo.title);
		out.description = out.description || pickString(seo.description);
		out.canonical = out.canonical || pickString(seo.canonical, seo.canonicalUrl);
		out.ogTitle = out.ogTitle || pickString(seo.ogTitle, asRecord(seo.openGraph)?.title);
		out.ogDescription = out.ogDescription || pickString(seo.ogDescription, asRecord(seo.openGraph)?.description);
		out.ogImage = out.ogImage || pickString(seo.ogImage, asRecord(seo.openGraph)?.image);
	}

	for (const child of Object.values(obj)) {
		if (child && typeof child === 'object') walkHydration(child, out, depth + 1);
	}
}

const NEXT_DATA_RE = /<script\b[^>]*\bid\s*=\s*["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i;
const NUXT_DATA_RE = /<script\b[^>]*\bid\s*=\s*["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i;
const NUXT_STATE_RE = /window\.__NUXT__\s*=\s*(\{[\s\S]*?\});/;
const INITIAL_STATE_RE = /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/;

function parseEmbeddedJson(raw: string): unknown | null {
	return parseJsonLdDocument(raw);
}

/** Pull meta + JSON-LD-shaped nodes out of CSR hydration payloads. */
export function extractHydrationSignals(html: string): HydrationSignals {
	const out: HydrationSignals = { schemaNodes: [] };
	if (!html) return out;

	const blobs = [
		html.match(NEXT_DATA_RE)?.[1],
		html.match(NUXT_DATA_RE)?.[1],
		html.match(NUXT_STATE_RE)?.[1],
		html.match(INITIAL_STATE_RE)?.[1],
	];
	for (const blob of blobs) {
		if (!blob) continue;
		const parsed = parseEmbeddedJson(blob);
		if (parsed) walkHydration(parsed, out);
	}
	return out;
}

function addressText(value: unknown): string {
	if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
	const obj = asRecord(value);
	if (!obj) return '';
	return [obj.streetAddress, obj.addressLocality, obj.addressRegion, obj.postalCode, obj.addressCountry]
		.filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
		.join(' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function extractSchemaNap(nodes: readonly Record<string, unknown>[]): ParsedNap {
	let name: string | null = null;
	let telephone: string | null = null;
	let address: string | null = null;
	for (const node of nodes) {
		if (!hasOrgLikeType(node) && !hasType(node, 'Person')) continue;
		if (!name) name = pickString(node.name) || null;
		if (!telephone) telephone = pickString(node.telephone, node.phone) || null;
		if (!address) address = addressText(node.address) || null;
	}
	return { name, telephone, address };
}

export function parseMicrodata($: CheerioAPI): Record<string, unknown>[] {
	const nodes: Record<string, unknown>[] = [];
	$('[itemscope][itemtype]').each((_, el) => {
		const type = normalizeSchemaType(($(el).attr('itemtype') || '').trim());
		if (!type) return;
		const node: Record<string, unknown> = { '@type': type };
		$(el)
			.find('[itemprop]')
			.each((__, propEl) => {
				const scope = $(propEl).closest('[itemscope]').get(0);
				if (scope !== el) return;
				const key = ($(propEl).attr('itemprop') || '').trim();
				if (!key) return;
				const val =
					$(propEl).attr('content') ||
					$(propEl).attr('href') ||
					$(propEl).attr('src') ||
					$(propEl).text();
				const cleaned = (val || '').replace(/\s+/g, ' ').trim();
				if (!cleaned) return;
				if (node[key] == null) node[key] = cleaned;
			});
		nodes.push(node);
	});
	return nodes;
}

export function hasAriaLandmarks($: CheerioAPI): boolean {
	return (
		$('main, [role="main"], nav, [role="navigation"], header, [role="banner"]').length > 0
	);
}

function firstMetaContent($: CheerioAPI, attr: 'name' | 'property', keys: readonly string[]): string {
	const want = new Set(keys.map((k) => k.toLowerCase()));
	let found = '';
	$('meta').each((_, el) => {
		if (found) return;
		const key = ($(el).attr(attr) || '').trim().toLowerCase();
		if (!want.has(key)) return;
		const content = ($(el).attr('content') || '').replace(/\s+/g, ' ').trim();
		if (content) found = content;
	});
	return found;
}

function firstCanonicalHref($: CheerioAPI): string | null {
	let href: string | null = null;
	$('link[rel]').each((_, el) => {
		if (href) return;
		const rel = ($(el).attr('rel') || '').toLowerCase();
		if (!/\bcanonical\b/.test(rel)) return;
		const raw = ($(el).attr('href') || '').trim();
		if (raw) href = extractPureUrl(raw) || raw;
	});
	return href;
}

export function parseMeta($: CheerioAPI, siteName?: string, hydration?: HydrationSignals): ParsedMeta {
	const title =
		$('title').first().text().replace(/\s+/g, ' ').trim() ||
		(hydration?.title || '').replace(/\s+/g, ' ').trim();
	const ogTitle =
		firstMetaContent($, 'property', ['og:title']) ||
		firstMetaContent($, 'name', ['og:title', 'twitter:title']) ||
		hydration?.ogTitle ||
		null;
	const metaDescription =
		firstMetaContent($, 'name', ['description']) ||
		firstMetaContent($, 'property', ['description', 'og:description']) ||
		hydration?.description ||
		'';
	const pageTitle =
		splitPageTitle(title, siteName) ||
		splitPageTitle(ogTitle || '', siteName) ||
		title;
	return {
		title,
		titleLength: title.length,
		pageTitle,
		metaDescription,
		metaDescriptionLength: metaDescription.length,
		canonical: firstCanonicalHref($) || hydration?.canonical || null,
		ogTitle,
		ogDescription:
			firstMetaContent($, 'property', ['og:description']) ||
			firstMetaContent($, 'name', ['og:description', 'twitter:description']) ||
			hydration?.ogDescription ||
			null,
		ogImage:
			firstMetaContent($, 'property', ['og:image']) ||
			firstMetaContent($, 'name', ['og:image', 'twitter:image']) ||
			hydration?.ogImage ||
			null,
		htmlLang: $('html').attr('lang')?.trim() || $('html').attr('xml:lang')?.trim() || null,
	};
}

export function parseHeadings($: CheerioAPI): ParsedHeadings {
	const levels: number[] = [];
	const skipExamples: string[] = [];
	$('h1,h2,h3,h4,h5,h6').each((_, el) => {
		const tag = (el as { name?: string }).name?.toLowerCase();
		if (!tag) return;
		const level = Number(tag.replace('h', ''));
		if (!Number.isFinite(level)) return;
		const prev = levels[levels.length - 1];
		if (prev != null && level > prev + 1 && skipExamples.length < 3) {
			skipExamples.push(`h${prev} → h${level}`);
		}
		levels.push(level);
	});

	const h1Texts = extractContentScopedHeadings($);
	const h2Texts = extractContentScopedH2($);
	// Keep raw DOM h1 count for SEO structure checks (multiple H1 warning).
	const rawH1Count = $('h1').length;

	return {
		h1Count: rawH1Count,
		h1Texts: h1Texts.length > 0 ? h1Texts : [],
		h2Texts,
		levels,
		hasSkip: skipExamples.length > 0,
		skipExamples,
		hasH1ToH3: $('h1,h2,h3').length >= 2,
	};
}

export function parseJsonLd($: CheerioAPI, rawHtml?: string, hydration?: HydrationSignals): ParsedSchema {
	let rawBlockCount = 0;
	let parseErrors = 0;
	const nodes: Record<string, unknown>[] = [];
	const snippets: string[] = [];

	const bodies = collectJsonLdBodies($, rawHtml);
	for (const raw of bodies) {
		rawBlockCount += 1;
		if (!raw) {
			parseErrors += 1;
			continue;
		}
		const parsed = parseJsonLdDocument(raw);
		if (snippets.length < 3) {
			const pretty = parsed
				? JSON.stringify(parsed, null, 2)
				: raw;
			snippets.push(pretty.length > 1200 ? `${pretty.slice(0, 1200)}\n…` : pretty);
		}
		if (parsed == null) {
			parseErrors += 1;
			continue;
		}
		flattenJsonLd(parsed, nodes);
	}

	const microdata = parseMicrodata($);
	if (microdata.length) {
		rawBlockCount += microdata.length;
		flattenJsonLd(microdata, nodes);
	}

	if (hydration?.schemaNodes.length) {
		flattenJsonLd(hydration.schemaNodes, nodes);
	}

	const summaries = nodes.flatMap(summarizeNode);
	const types = Array.from(new Set(summaries.map((s) => normalizeSchemaType(s.type)).filter(Boolean))).sort();

	const orgNodes = nodes.filter((n) => hasOrgLikeType(n));
	const articleNodes = nodes.filter(
		(n) => hasType(n, 'Article') || hasType(n, 'NewsArticle') || hasType(n, 'BlogPosting'),
	);
	const personNodes = nodes.filter((n) => hasType(n, 'Person'));

	const orgRequiredFor = (node: Record<string, unknown>): readonly string[] => {
		const local = typeList(node).some((t) => LOCAL_NAP_TYPES.has(t));
		return local ? [...ORG_REQUIRED, ...LOCAL_NAP_REQUIRED] : ORG_REQUIRED;
	};
	const organizationMissing =
		orgNodes.length === 0
			? [...ORG_REQUIRED, ...LOCAL_NAP_REQUIRED]
			: Array.from(new Set(orgNodes.flatMap((n) => missingKeys(n, orgRequiredFor(n)))));

	const articleMissing =
		articleNodes.length === 0
			? [...ARTICLE_REQUIRED]
			: Array.from(new Set(articleNodes.flatMap((n) => missingKeys(n, ARTICLE_REQUIRED))));

	const personMissing =
		personNodes.length === 0
			? ['name', 'profileIdentifier(url|sameAs|jobTitle…)']
			: Array.from(
					new Set(
						personNodes.flatMap((n) => {
							const missing = missingKeys(n, PERSON_REQUIRED);
							const hasIdentifier = PERSON_IDENTIFIERS.some((key) => isPresent(n[key]));
							if (!hasIdentifier) missing.push('profileIdentifier(url|sameAs|jobTitle…)');
							return missing;
						}),
					),
				);

	return {
		rawBlockCount,
		validBlockCount: nodes.length,
		parseErrors,
		types,
		nodes: summaries,
		snippets,
		organizationMissing,
		articleMissing,
		personMissing,
		hasOrganization: orgNodes.length > 0,
		hasArticle: articleNodes.some((n) => hasType(n, 'Article') || hasType(n, 'BlogPosting')),
		hasNewsArticle: articleNodes.some((n) => hasType(n, 'NewsArticle')),
		hasAboutPage: nodes.some((n) => hasType(n, 'AboutPage')),
		hasMedicalWebPage: nodes.some((n) => hasType(n, 'MedicalWebPage')),
		hasPerson: personNodes.length > 0,
		hasWebSite: nodes.some((n) => hasType(n, 'WebSite')),
		hasWebPage:
			nodes.some((n) => hasType(n, 'WebPage')) ||
			nodes.some((n) => hasType(n, 'MedicalWebPage')) ||
			nodes.some((n) => hasType(n, 'AboutPage')) ||
			nodes.some((n) => hasType(n, 'ContactPage')) ||
			nodes.some((n) => hasType(n, 'CollectionPage')),
		hasBreadcrumb: nodes.some((n) => hasType(n, 'BreadcrumbList')),
		hasFaqOrHowTo: nodes.some((n) => hasType(n, 'FAQPage') || hasType(n, 'HowTo')),
		hasBusinessOrApp: nodes.some(
			(n) =>
				hasType(n, 'SoftwareApplication') ||
				hasType(n, 'LocalBusiness') ||
				hasType(n, 'Organization') ||
				hasType(n, 'NewsMediaOrganization') ||
				hasType(n, 'Corporation') ||
				hasType(n, 'Product') ||
				hasType(n, 'MedicalBusiness') ||
				hasType(n, 'MedicalClinic') ||
				hasType(n, 'Hospital') ||
				hasType(n, 'Physician') ||
				hasType(n, 'Dentist'),
		),
		nap: extractSchemaNap(nodes),
	};
}

export function parseImages($: CheerioAPI): ParsedImages {
	const images = $('img');
	const total = images.length;
	const missingAlt = images.filter((_, el) => {
		const alt = $(el).attr('alt')?.trim();
		const aria = $(el).attr('aria-label')?.trim();
		const decorative =
			($(el).attr('role') || '').toLowerCase() === 'presentation' ||
			$(el).attr('aria-hidden') === 'true';
		return !(alt || aria || decorative);
	}).length;
	const coveragePct = total === 0 ? 100 : Math.round(((total - missingAlt) / total) * 100);
	return { total, missingAlt, coveragePct };
}

/** Score internal hrefs so board/query PHP pages are not dropped by the link cap. */
function scoreInternalHref(path: string, search: string): number {
	const href = `${path}${search}`.toLowerCase();
	let score = 0;
	if (/\/bbs\/board\.php/i.test(path) && /[?&]bo_table=/i.test(search)) score += 100;
	if (/\/bbs\/(write|content|faq|qalist|qaview)\.php/i.test(path)) score += 80;
	if (/\/shop\/(list|item|content)\.php/i.test(path)) score += 70;
	if (search && /[?&](bo_table|co_id|it_id|ca_id)=/i.test(search)) score += 60;
	else if (search) score += 25;
	if (/\.php$/i.test(path)) score += 20;
	if (/\/\d{2,4}\.php$/i.test(path) || /\/s?\d{2,4}\.php$/i.test(path)) score += 15;
	if (/\.(css|js|png|jpe?g|gif|svg|webp|ico|pdf|zip|woff2?)$/i.test(path)) score -= 100;
	if (/\/(login|logout|register|admin|adm)\b/i.test(href)) score -= 40;
	return score;
}

function normalizeInternalHref(
	href: string,
	pageUrl: string,
	origin: string,
): { path: string; search: string; hrefPath: string } | null {
	if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
		return null;
	}
	try {
		const abs = new URL(href, pageUrl);
		if (abs.origin !== origin) return null;
		const path = abs.pathname || '/';
		// Keep full querystring (Gnuboard board.php?bo_table=* etc.)
		const search = abs.search || '';
		return { path, search, hrefPath: search ? `${path}${search}` : path };
	} catch {
		return null;
	}
}

/**
 * Collect same-origin internal `<a href>` targets for URL↔source mapping.
 * Preserves query strings (e.g. `/bbs/board.php?bo_table=qa`, `/bbs/write.php`).
 * Prioritizes board/parameter URLs so they survive the collection cap.
 */
export function extractInternalLinks($: CheerioAPI, pageUrl: string, limit = 120): string[] {
	let origin: string;
	try {
		origin = new URL(pageUrl).origin;
	} catch {
		return [];
	}

	const scored = new Map<string, number>();
	$('a[href]').each((_, el) => {
		const href = $(el).attr('href')?.trim();
		if (!href) return;
		const norm = normalizeInternalHref(href, pageUrl, origin);
		if (!norm) return;
		const score = scoreInternalHref(norm.path, norm.search);
		if (score < 0) return;
		const prev = scored.get(norm.hrefPath) ?? Number.NEGATIVE_INFINITY;
		if (score > prev) scored.set(norm.hrefPath, score);
	});

	return [...scored.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, limit)
		.map(([href]) => href);
}

/**
 * Collect footer / 사업자 정보 text for Organization.legalName extraction.
 * Prefers 상호명/법인명/상호 labeled lines; copyright-only snippets may still
 * appear in corpus but must not bind as legalName (v10 filter).
 */
export function extractFooterLegalText($: CheerioAPI, limit = 1200): string {
	const scopes = ['footer', '#ft', '.footer', '#footer', '.ft_info', '.footer_info', '.business_info', '#business'];
	const chunks: string[] = [];
	for (const sel of scopes) {
		$(sel).each((_, el) => {
			const text = $(el).text().replace(/\s+/g, ' ').trim();
			if (text.length >= 4) chunks.push(text);
		});
		if (chunks.length > 0) break;
	}
	// Whole-document fallback — prefer labeled 상호명/법인명/상호 first
	if (chunks.length === 0) {
		const body = $('body').text().replace(/\s+/g, ' ').trim();
		const labeled =
			body.match(/(?:상호명|법인명|상호)\s*[:：]\s*[^.|]{2,80}/i) ||
			body.match(/(?:주식회사|\(주\)|㈜|사업자(?:등록)?명?)[^.]{0,120}/i);
		if (labeled?.[0]) chunks.push(labeled[0].trim());
	}
	const joined = chunks.join('\n').trim();
	return joined.length > limit ? joined.slice(0, limit) : joined;
}

/**
 * Collect GNB / header nav labels with their hrefs for $page_meta title resolution.
 */
export function extractNavItems($: CheerioAPI, pageUrl: string, limit = 40): NavLinkItem[] {
	let origin: string;
	try {
		origin = new URL(pageUrl).origin;
	} catch {
		return [];
	}

	const scopes = ['header a[href]', 'nav a[href]', '.gnb a[href]', '#gnb a[href]', '#hd a[href]', '.header a[href]', '.lnb a[href]', '#lnb a[href]'];
	const seen = new Set<string>();
	const out: NavLinkItem[] = [];

	const ingestSelector = (selector: string) => {
		$(selector).each((_, el) => {
			if (out.length >= limit) return false;
			const href = $(el).attr('href')?.trim();
			if (!href) return;
			const norm = normalizeInternalHref(href, pageUrl, origin);
			if (!norm) return;
			const name = $(el).text().replace(/\s+/g, ' ').trim();
			if (!name || name.length > 40) return;
			if (/^(home|메인|로그인|logout|회원가입)$/i.test(name)) return;
			const key = norm.hrefPath.toLowerCase();
			if (seen.has(key)) return;
			seen.add(key);
			out.push({ name, url: norm.hrefPath });
		});
	};

	for (const sel of scopes) {
		ingestSelector(sel);
		if (out.length >= limit) break;
	}

	// Fallback: whole-document anchors with short labels (still keep query URLs).
	if (out.length < 4) {
		ingestSelector('body a[href]');
	}

	return out;
}

/** Full DOM pass used by the precision audit engine (no LLM). */
export function parsePageHtml(
	$: CheerioAPI,
	pageUrl?: string,
	siteName?: string,
	rawHtml?: string,
): PageParseResult {
	const hydration = extractHydrationSignals(rawHtml || '');
	const bodyTextLength = $('body').text().replace(/\s+/g, ' ').trim().length;
	const renderBlockingScripts = $('script[src]:not([async]):not([defer])').length;
	return {
		meta: parseMeta($, siteName, hydration),
		headings: parseHeadings($),
		schema: parseJsonLd($, rawHtml, hydration),
		images: parseImages($),
		bodyTextLength,
		renderBlockingScripts,
		internalLinks: pageUrl ? extractInternalLinks($, pageUrl) : [],
	};
}

/** Target schema types for coverage % (developer-tool style rubric). */
export const SCHEMA_COVERAGE_TYPES = [
	'Organization',
	'WebSite',
	'WebPage',
	'BreadcrumbList',
	'Article',
	'NewsArticle',
	'Person',
	'FAQPage',
] as const;

export function computeSchemaCoverage(types: string[]): number {
	const set = new Set(types.map(normalizeSchemaType).filter(Boolean));
	const hasLocalEntity = [...ORG_LIKE_TYPES].some((t) => set.has(t));
	const hit = SCHEMA_COVERAGE_TYPES.filter((t) => {
		if (t === 'Organization') {
			return hasLocalEntity;
		}
		if (t === 'Article') {
			return (
				set.has('Article') ||
				set.has('BlogPosting') ||
				set.has('NewsArticle') ||
				set.has('MedicalWebPage') ||
				set.has('AboutPage') ||
				hasLocalEntity
			);
		}
		if (t === 'NewsArticle') {
			return (
				set.has('NewsArticle') ||
				set.has('MedicalWebPage') ||
				set.has('AboutPage') ||
				hasLocalEntity
			);
		}
		if (t === 'WebPage') {
			return (
				set.has('WebPage') ||
				set.has('MedicalWebPage') ||
				set.has('AboutPage') ||
				set.has('ContactPage') ||
				set.has('CollectionPage')
			);
		}
		return set.has(t);
	}).length;
	return Math.round((hit / SCHEMA_COVERAGE_TYPES.length) * 100);
}
