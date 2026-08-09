import type { CheerioAPI } from 'cheerio';

export interface ParsedMeta {
	title: string;
	titleLength: number;
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
	h1Texts: string[];
	levels: number[];
	hasSkip: boolean;
	skipExamples: string[];
	hasH1ToH3: boolean;
}

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
	hasPerson: boolean;
	hasWebSite: boolean;
	hasWebPage: boolean;
	hasBreadcrumb: boolean;
	hasFaqOrHowTo: boolean;
	hasBusinessOrApp: boolean;
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
}

const ORG_REQUIRED = ['logo', 'url', 'sameAs'] as const;
const ARTICLE_REQUIRED = ['headline', 'image', 'datePublished', 'author', 'publisher'] as const;
const PERSON_REQUIRED = ['name'] as const;
/** Soft E-E-A-T identifiers — at least one strengthens author graph. */
const PERSON_IDENTIFIERS = ['url', 'sameAs', 'jobTitle', 'worksFor', 'image', 'description'] as const;

function asArray<T>(value: T | T[] | undefined | null): T[] {
	if (value == null) return [];
	return Array.isArray(value) ? value : [value];
}

function typeList(node: Record<string, unknown>): string[] {
	return asArray(node['@type']).filter((t): t is string => typeof t === 'string');
}

function hasType(node: Record<string, unknown>, type: string): boolean {
	return typeList(node).some((t) => t === type || t.endsWith(`/${type}`));
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

function flattenJsonLd(value: unknown, out: Record<string, unknown>[]): void {
	if (value == null) return;
	if (Array.isArray(value)) {
		value.forEach((item) => flattenJsonLd(item, out));
		return;
	}
	if (typeof value !== 'object') return;
	const obj = value as Record<string, unknown>;
	if (obj['@graph']) flattenJsonLd(obj['@graph'], out);
	out.push(obj);
}

function summarizeNode(node: Record<string, unknown>): SchemaNodeSummary[] {
	const types = typeList(node);
	if (types.length === 0) return [];

	return types.map((type) => {
		let required: readonly string[] = [];
		if (type === 'Organization' || type === 'LocalBusiness') required = ORG_REQUIRED;
		else if (type === 'Article' || type === 'NewsArticle' || type === 'BlogPosting') required = ARTICLE_REQUIRED;
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

export function parseMeta($: CheerioAPI): ParsedMeta {
	const title = $('title').first().text().replace(/\s+/g, ' ').trim();
	const metaDescription = $('meta[name="description"]').attr('content')?.replace(/\s+/g, ' ').trim() || '';
	return {
		title,
		titleLength: title.length,
		metaDescription,
		metaDescriptionLength: metaDescription.length,
		canonical: $('link[rel="canonical"]').attr('href')?.trim() || null,
		ogTitle: $('meta[property="og:title"]').attr('content')?.trim() || null,
		ogDescription: $('meta[property="og:description"]').attr('content')?.trim() || null,
		ogImage: $('meta[property="og:image"]').attr('content')?.trim() || null,
		htmlLang: $('html').attr('lang')?.trim() || null,
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

	const h1Texts: string[] = [];
	$('h1').each((_, el) => {
		const text = $(el).text().replace(/\s+/g, ' ').trim();
		if (text) h1Texts.push(text.slice(0, 80));
	});

	return {
		h1Count: $('h1').length,
		h1Texts,
		levels,
		hasSkip: skipExamples.length > 0,
		skipExamples,
		hasH1ToH3: $('h1,h2,h3').length >= 2,
	};
}

export function parseJsonLd($: CheerioAPI): ParsedSchema {
	let rawBlockCount = 0;
	let parseErrors = 0;
	const nodes: Record<string, unknown>[] = [];
	const snippets: string[] = [];

	$('script[type="application/ld+json"]').each((_, el) => {
		rawBlockCount += 1;
		const raw = $(el).contents().text().trim();
		if (!raw) {
			parseErrors += 1;
			return;
		}
		if (snippets.length < 3) {
			const pretty = (() => {
				try {
					return JSON.stringify(JSON.parse(raw), null, 2);
				} catch {
					return raw;
				}
			})();
			snippets.push(pretty.length > 1200 ? `${pretty.slice(0, 1200)}\n…` : pretty);
		}
		try {
			flattenJsonLd(JSON.parse(raw), nodes);
		} catch {
			parseErrors += 1;
		}
	});

	const summaries = nodes.flatMap(summarizeNode);
	const types = Array.from(new Set(summaries.map((s) => s.type))).sort();

	const orgNodes = nodes.filter((n) => hasType(n, 'Organization') || hasType(n, 'LocalBusiness'));
	const articleNodes = nodes.filter(
		(n) => hasType(n, 'Article') || hasType(n, 'NewsArticle') || hasType(n, 'BlogPosting'),
	);
	const personNodes = nodes.filter((n) => hasType(n, 'Person'));

	const organizationMissing =
		orgNodes.length === 0
			? [...ORG_REQUIRED]
			: Array.from(new Set(orgNodes.flatMap((n) => missingKeys(n, ORG_REQUIRED))));

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
		hasPerson: personNodes.length > 0,
		hasWebSite: nodes.some((n) => hasType(n, 'WebSite')),
		hasWebPage: nodes.some((n) => hasType(n, 'WebPage')),
		hasBreadcrumb: nodes.some((n) => hasType(n, 'BreadcrumbList')),
		hasFaqOrHowTo: nodes.some((n) => hasType(n, 'FAQPage') || hasType(n, 'HowTo')),
		hasBusinessOrApp: nodes.some(
			(n) =>
				hasType(n, 'SoftwareApplication') ||
				hasType(n, 'LocalBusiness') ||
				hasType(n, 'Organization') ||
				hasType(n, 'Product'),
		),
	};
}

export function parseImages($: CheerioAPI): ParsedImages {
	const images = $('img');
	const total = images.length;
	const missingAlt = images.filter((_, el) => !$(el).attr('alt')?.trim()).length;
	const coveragePct = total === 0 ? 100 : Math.round(((total - missingAlt) / total) * 100);
	return { total, missingAlt, coveragePct };
}

/** Full DOM pass used by the precision audit engine (no LLM). */
export function parsePageHtml($: CheerioAPI): PageParseResult {
	const bodyTextLength = $('body').text().replace(/\s+/g, ' ').trim().length;
	const renderBlockingScripts = $('script[src]:not([async]):not([defer])').length;
	return {
		meta: parseMeta($),
		headings: parseHeadings($),
		schema: parseJsonLd($),
		images: parseImages($),
		bodyTextLength,
		renderBlockingScripts,
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
	const set = new Set(types);
	const hit = SCHEMA_COVERAGE_TYPES.filter((t) => {
		if (t === 'Article') return set.has('Article') || set.has('BlogPosting') || set.has('NewsArticle');
		return set.has(t);
	}).length;
	return Math.round((hit / SCHEMA_COVERAGE_TYPES.length) * 100);
}
