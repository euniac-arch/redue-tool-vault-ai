import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { buildTriggerQueries } from '@/lib/audit/ai-engine-visibility';
import {
	extractSiteMetadata,
	fallbackSiteMetadata,
	resolveSiteMetadata,
	type IndustryType,
	type SiteMetadata,
} from '@/lib/audit/site-metadata';
import { parseMeta } from '@/lib/audit/parser';
import { scoreFromDepthLevel } from '@/lib/geo/rating-meta';
import { buildKeywordWeights, buildRecommendationReasons } from '@/lib/geo/prompt-insights';
import { shouldCapAsIsToBrandOnly } from '@/lib/geo/as-is-honesty';
import { cleanMedicalEntities } from '@/lib/geo/clean-medical-entities';
import { attributeTagLabels, buildExpandedQueryCoverage, extractSpecialties } from '@/lib/geo/query-coverage';
import { assertPublicHttpUrl, UnsafeAuditUrlError } from '@/lib/ssrf-guard';
import {
	AI_ENGINE_CATALOG,
	AI_ENGINE_IDS,
	type AIEngineId,
	type GeoDiagnosticReport,
	type KeywordDepthLevel,
} from '@/types/geo-diagnostic';
import type {
	ApplyPrescriptionRequest,
	ApplyPrescriptionResponse,
	GeoNapInfo,
	GeoSiteContext,
	PrescriptionLang,
	PrescriptionLevelChange,
} from '@/types/geo-prescription';
import {
	buildAfterDiagnosticReport,
	buildAppliedPatches,
	canonicalSiteUrl,
	contextFromDiagnostic,
	domainFromUrl,
	liftAfterLevel,
	resolveGeneratedSchemaType,
	toAiSimulations,
	toTriggerQueryRecord,
} from '@/lib/geo/prescription-patches';

const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_CHARS = 1_500_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; ReduGeoBot/1.0; +https://redue.ai/geo)';
const PHONE_RE = /(?:\+82[-\s]?)?0?\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/;

export interface ScrapedSiteEntities {
	ok: boolean;
	url: string;
	html?: string;
	meta: SiteMetadata;
	ogTitle?: string;
	ogDescription?: string;
	ogImage?: string;
	description?: string;
	existingSchemaTypes: string[];
	existingJsonLd: unknown[];
	nap: GeoNapInfo;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function flattenJsonLd(value: unknown, out: Record<string, unknown>[]): void {
	if (value == null) return;
	if (Array.isArray(value)) {
		value.forEach((item) => flattenJsonLd(item, out));
		return;
	}
	const obj = asRecord(value);
	if (!obj) return;
	if (obj['@graph'] != null) flattenJsonLd(obj['@graph'], out);
	out.push(obj);
}

function typeList(node: Record<string, unknown>): string[] {
	const raw = node['@type'];
	if (typeof raw === 'string') return [raw.replace(/^https?:\/\/schema\.org\//i, '')];
	if (Array.isArray(raw)) {
		return raw
			.map((item) => String(item).replace(/^https?:\/\/schema\.org\//i, ''))
			.filter(Boolean);
	}
	return [];
}

function textOf(value: unknown): string {
	if (typeof value === 'string') return value.trim();
	if (typeof value === 'number') return String(value);
	const obj = asRecord(value);
	if (obj?.name) return textOf(obj.name);
	if (obj?.telephone) return textOf(obj.telephone);
	return '';
}

function napFromNodes(nodes: Record<string, unknown>[]): GeoNapInfo {
	const nap: GeoNapInfo = {};
	for (const node of nodes) {
		if (!nap.name) nap.name = textOf(node.name) || undefined;
		if (!nap.telephone) nap.telephone = textOf(node.telephone) || undefined;
		const geo = asRecord(node.geo);
		if (geo) {
			if (!nap.latitude) nap.latitude = textOf(geo.latitude) || undefined;
			if (!nap.longitude) nap.longitude = textOf(geo.longitude) || undefined;
		}
		const address = node.address;
		if (typeof address === 'string' && !nap.address) nap.address = address.trim();
		const addr = asRecord(address);
		if (addr) {
			if (!nap.streetAddress) nap.streetAddress = textOf(addr.streetAddress) || undefined;
			if (!nap.addressLocality) nap.addressLocality = textOf(addr.addressLocality) || undefined;
			if (!nap.addressRegion) nap.addressRegion = textOf(addr.addressRegion) || undefined;
			if (!nap.address) {
				nap.address = [addr.addressRegion, addr.addressLocality, addr.streetAddress]
					.map((part) => textOf(part))
					.filter(Boolean)
					.join(' ');
			}
		}
	}
	return nap;
}

function parseJsonLdBlocks(html: string, $: CheerioAPI): { nodes: Record<string, unknown>[]; raw: unknown[] } {
	const raw: unknown[] = [];
	const nodes: Record<string, unknown>[] = [];
	$('script').each((_, el) => {
		const type = (($(el).attr('type') || '') + '').toLowerCase();
		if (!type.includes('ld+json')) return;
		const body = ($(el).contents().text() || $(el).html() || '').trim();
		if (!body) return;
		try {
			const parsed = JSON.parse(body);
			raw.push(parsed);
			flattenJsonLd(parsed, nodes);
		} catch {
			/* ignore invalid JSON-LD */
		}
	});
	if (raw.length === 0 && html) {
		const re = /<script[^>]*type=["'][^"']*ld\+json[^"']*["'][^>]*>([\s\S]*?)<\/script>/gi;
		let match: RegExpExecArray | null;
		while ((match = re.exec(html))) {
			const body = (match[1] || '').trim();
			if (!body) continue;
			try {
				const parsed = JSON.parse(body);
				raw.push(parsed);
				flattenJsonLd(parsed, nodes);
			} catch {
				/* ignore */
			}
		}
	}
	return { nodes, raw };
}

function phoneFromHtml($: CheerioAPI, html: string): string | undefined {
	const telHref = $('a[href^="tel:"]').first().attr('href')?.replace(/^tel:/i, '').trim();
	if (telHref) return telHref;
	const hit = html.match(PHONE_RE);
	return hit?.[0]?.replace(/\s+/g, '-');
}

function withNocacheParam(url: string, forceRefresh: boolean): string {
	if (!forceRefresh) return url;
	try {
		const u = new URL(url);
		u.searchParams.set('_redue_nocache', String(Date.now()));
		return u.toString();
	} catch {
		const sep = url.includes('?') ? '&' : '?';
		return `${url}${sep}_redue_nocache=${Date.now()}`;
	}
}

async function fetchHtml(url: string, forceRefresh = true): Promise<{ ok: boolean; text: string }> {
	const fetchUrl = withNocacheParam(url, forceRefresh);
	try {
		const res = await fetch(fetchUrl, {
			headers: {
				'User-Agent': USER_AGENT,
				Accept: 'text/html,application/xhtml+xml',
				...(forceRefresh
					? {
							'Cache-Control': 'no-cache, no-store, must-revalidate',
							Pragma: 'no-cache',
						}
					: {}),
			},
			cache: 'no-store',
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			redirect: 'follow',
		});
		const text = await res.text();
		return { ok: res.ok, text: text.slice(0, MAX_HTML_CHARS) };
	} catch {
		return { ok: false, text: '' };
	}
}

export async function scrapeSiteEntities(
	targetUrl: string,
	lang: PrescriptionLang,
	opts?: { forceRefresh?: boolean },
): Promise<ScrapedSiteEntities> {
	const url = canonicalSiteUrl(targetUrl);
	const fallback = fallbackSiteMetadata(url, lang);
	const forceRefresh = opts?.forceRefresh !== false;
	try {
		await assertPublicHttpUrl(url);
	} catch (err) {
		if (err instanceof UnsafeAuditUrlError) {
			return {
				ok: false,
				url,
				meta: fallback,
				existingSchemaTypes: [],
				existingJsonLd: [],
				nap: { name: fallback.brandName },
			};
		}
		throw err;
	}

	const page = await fetchHtml(url, forceRefresh);
	if (!page.text) {
		return {
			ok: false,
			url,
			meta: fallback,
			existingSchemaTypes: [],
			existingJsonLd: [],
			nap: { name: fallback.brandName },
		};
	}

	const $ = cheerio.load(page.text);
	const meta = extractSiteMetadata($, url, lang, page.text);
	const parsedMeta = parseMeta($, meta.brandName);
	const { nodes, raw } = parseJsonLdBlocks(page.text, $);
	const nap = napFromNodes(nodes);
	if (!nap.telephone) nap.telephone = phoneFromHtml($, page.text);
	if (!nap.name) nap.name = meta.brandName;
	const existingSchemaTypes = Array.from(new Set(nodes.flatMap(typeList)));

	return {
		ok: page.ok,
		url,
		html: page.text.slice(0, 80_000),
		meta,
		ogTitle: parsedMeta.ogTitle || undefined,
		ogDescription: parsedMeta.ogDescription || undefined,
		ogImage: parsedMeta.ogImage || undefined,
		description: parsedMeta.metaDescription || parsedMeta.ogDescription || undefined,
		existingSchemaTypes,
		existingJsonLd: raw,
		nap,
	};
}

function parseCurrentSchema(raw: ApplyPrescriptionRequest['currentSchema']): string[] {
	if (!raw) return [];
	if (Array.isArray(raw)) return raw.map((item) => String(item)).filter(Boolean);
	if (typeof raw === 'string') {
		const trimmed = raw.trim();
		if (!trimmed) return [];
		try {
			const parsed = JSON.parse(trimmed) as unknown;
			if (Array.isArray(parsed)) return parsed.map((item) => String(item)).filter(Boolean);
			const obj = asRecord(parsed);
			if (obj?.['@type']) return typeList(obj);
		} catch {
			return trimmed.split(/[,\s]+/).filter(Boolean);
		}
		return [trimmed];
	}
	return typeList(raw);
}

function mergeKeywords(scraped: SiteMetadata, requested?: string[]): string[] {
	const plasticOk = (scraped.coreSpecialties || []).some((s) => /성형외과|plastic/i.test(s));
	return cleanMedicalEntities(
		[
			...(requested || []),
			...(scraped.coreSpecialties || []),
			...(scraped.navMenuTexts || []),
			scraped.primaryKeyword,
			scraped.category,
		],
		{ plasticOk, limit: 8 },
	);
}

function buildSiteContext(
	input: ApplyPrescriptionRequest,
	scraped: ScrapedSiteEntities | null,
	lang: PrescriptionLang,
): GeoSiteContext {
	const url = canonicalSiteUrl(input.targetUrl || scraped?.url || '');
	const fallback = fallbackSiteMetadata(url, lang);
	const meta = resolveSiteMetadata(scraped?.meta || fallback);
	const brandName = input.brandName?.trim() || meta.brandName || fallback.brandName;
	const category = input.category?.trim() || meta.category || meta.primaryKeyword;
	const primaryKeyword = meta.primaryKeyword || category;
	const location = input.location?.trim() || meta.location || meta.broadLocation || '';
	const industryType = (input.industryType || meta.industryType || 'GENERAL') as IndustryType;
	const existingSchemaTypes = Array.from(
		new Set([...(scraped?.existingSchemaTypes || []), ...parseCurrentSchema(input.currentSchema)]),
	);
	const targetKeywords = mergeKeywords(meta, input.targetKeywords);
	const draft: GeoSiteContext = {
		url,
		domain: meta.domain || domainFromUrl(url),
		brandName,
		category: meta.businessEntity || category,
		primaryKeyword: meta.businessEntity || primaryKeyword,
		location,
		industryType,
		schemaType: resolveGeneratedSchemaType({
			industryType,
			primaryKeyword: meta.businessEntity || primaryKeyword,
			category: meta.businessEntity || category,
			existingSchemaTypes,
			description: scraped?.description,
			brandName,
			schemaType: 'LocalBusiness',
		}),
		lang,
		description: scraped?.description,
		ogTitle: scraped?.ogTitle,
		ogDescription: scraped?.ogDescription,
		ogImage: scraped?.ogImage,
		existingSchemaTypes,
		nap: scraped?.nap || { name: brandName },
		targetKeywords,
		specialties: [],
		businessEntity: meta.businessEntity,
		entityPhrases: meta.entityPhrases,
		needSignals: meta.needSignals,
		title: meta.title,
		metaKeywords: meta.metaKeywords,
		navMenuTexts: meta.navMenuTexts,
	};
	draft.specialties = extractSpecialties(draft);
	draft.brandOnlyAsIs = shouldCapAsIsToBrandOnly({
		brandName,
		title: scraped?.ogTitle,
		corpus: `${scraped?.ogTitle || ''} ${scraped?.ogDescription || ''} ${scraped?.description || ''}`,
		category: draft.category,
		primaryKeyword: draft.primaryKeyword,
		businessEntity: draft.businessEntity,
		schemaType: draft.schemaType,
		existingSchemaTypes,
	});
	return draft;
}

function syntheticBeforeReport(ctx: GeoSiteContext, queries: GeoDiagnosticReport['triggerQueries']): GeoDiagnosticReport {
	return {
		caseId: 'low',
		caseLabel: ctx.lang === 'en' ? 'Before GEO prescription' : 'GEO 처방전 적용 전',
		targetUrl: ctx.url,
		domain: ctx.domain,
		brandName: ctx.brandName,
		generatedAt: new Date().toISOString(),
		triggerQueries: queries,
		engines: AI_ENGINE_IDS.map((id) => ({
			engine: AI_ENGINE_CATALOG[id],
			score: scoreFromDepthLevel(1),
			statusBadge: 'exact_only' as const,
			depthLevel: 1 as const,
			triggerQuery: queries[1],
			simulatedResponse: '',
			improvementTip: '',
		})),
	};
}

function applyBeforeLevels(
	report: GeoDiagnosticReport,
	beforeLevels?: ApplyPrescriptionRequest['beforeLevels'],
): GeoDiagnosticReport {
	if (!beforeLevels) return report;
	return {
		...report,
		engines: report.engines.map((engine) => {
			const raw = beforeLevels[engine.engine.id];
			if (raw === undefined) return engine;
			if (raw === 0 || raw === null) {
				return { ...engine, statusBadge: 'not_indexed', depthLevel: null, score: scoreFromDepthLevel(null) };
			}
			if (raw === 3) return { ...engine, statusBadge: 'moderate', depthLevel: 2, score: scoreFromDepthLevel(2) };
			if (raw === 2) return { ...engine, statusBadge: 'moderate', depthLevel: 2, score: scoreFromDepthLevel(2) };
			return { ...engine, statusBadge: 'exact_only', depthLevel: 1, score: scoreFromDepthLevel(1) };
		}),
	};
}

export function buildLevelChanges(before: GeoDiagnosticReport, after: GeoDiagnosticReport): Record<AIEngineId, PrescriptionLevelChange> {
	const afterById = new Map(after.engines.map((engine) => [engine.engine.id, engine]));
	const out = {} as Record<AIEngineId, PrescriptionLevelChange>;
	for (const id of AI_ENGINE_IDS) {
		const prev = before.engines.find((engine) => engine.engine.id === id);
		const next = afterById.get(id);
		out[id] = {
			before: prev?.depthLevel ?? 0,
			after: next?.depthLevel ?? liftAfterLevel(prev?.depthLevel ?? null, id),
		};
	}
	return out;
}

/**
 * GEO prescription pipeline:
 *  1. Scrape target URL (meta, OG, JSON-LD, NAP)
 *  2. Generate category-fit Schema.org + FAQ 5 + meta patches
 *  3. Re-simulate 6 AI engines at lifted trigger depths
 */
export async function applyGeoPrescription(
	input: ApplyPrescriptionRequest,
	beforeReport?: GeoDiagnosticReport | null,
): Promise<ApplyPrescriptionResponse> {
	const lang: PrescriptionLang = input.lang === 'en' ? 'en' : 'ko';
	const targetUrl = canonicalSiteUrl(input.targetUrl || beforeReport?.targetUrl || '');
	if (!targetUrl || targetUrl === 'https://example.com') {
		throw new Error('targetUrl is required');
	}

	let scraped: ScrapedSiteEntities | null = null;
	try {
		scraped = await scrapeSiteEntities(targetUrl, lang, {
			forceRefresh: input.forceRefresh !== false,
		});
	} catch {
		scraped = null;
	}

	const ctx = buildSiteContext({ ...input, targetUrl }, scraped, lang);
	const queries = toTriggerQueryRecord(
		buildTriggerQueries({
			brandName: ctx.brandName,
			category: ctx.category,
			primaryKeyword: ctx.primaryKeyword,
			location: ctx.location,
			domain: ctx.domain,
			lang,
			businessEntity: ctx.businessEntity,
			needSignals: ctx.needSignals,
			entityPhrases: ctx.entityPhrases,
			title: ctx.title || ctx.ogTitle,
			metaDescription: ctx.ogDescription || ctx.description,
			description: ctx.description,
			ogTitle: ctx.ogTitle,
			ogDescription: ctx.ogDescription,
			coreSpecialties: ctx.specialties,
			schemaTypes: ctx.existingSchemaTypes,
			detectedKeywords: ctx.targetKeywords,
		}),
	);

	const before = applyBeforeLevels(beforeReport || syntheticBeforeReport(ctx, queries), input.beforeLevels);
	const coverage = buildExpandedQueryCoverage(ctx);
	const ctxWithAttrs: GeoSiteContext = {
		...ctx,
		attributeLabels: attributeTagLabels(coverage, lang),
	};
	const after = buildAfterDiagnosticReport(before, ctxWithAttrs, queries, lang);
	const patches = buildAppliedPatches(ctxWithAttrs);

	return {
		siteUrl: ctx.url,
		siteId: input.siteId,
		appliedPatches: patches,
		levelChanges: buildLevelChanges(before, after),
		aiSimulations: toAiSimulations(after, lang),
		afterReport: after,
		expandedQueryCoverage: coverage,
		keywordWeights: buildKeywordWeights(ctxWithAttrs, coverage),
		recommendationReasons: buildRecommendationReasons(ctxWithAttrs, coverage),
		scraped: Boolean(scraped?.ok),
	};
}

export function applyGeoPrescriptionFromReport(
	before: GeoDiagnosticReport,
	lang: PrescriptionLang,
	extra?: Parameters<typeof contextFromDiagnostic>[2],
): ApplyPrescriptionResponse {
	const ctx = contextFromDiagnostic(before, lang, extra);
	const queries = {
		...before.triggerQueries,
		...toTriggerQueryRecord(
			buildTriggerQueries({
				brandName: ctx.brandName,
				category: ctx.category || before.triggerQueries[2],
				primaryKeyword: ctx.primaryKeyword,
				location: ctx.location,
				domain: ctx.domain,
				lang,
				businessEntity: ctx.businessEntity,
				needSignals: ctx.needSignals,
				entityPhrases: ctx.entityPhrases,
				title: ctx.title || ctx.ogTitle,
				metaDescription: ctx.ogDescription || ctx.description,
				description: ctx.description,
				ogTitle: ctx.ogTitle,
				ogDescription: ctx.ogDescription,
				coreSpecialties: ctx.specialties,
				schemaTypes: ctx.existingSchemaTypes,
				detectedKeywords: ctx.targetKeywords,
			}),
		),
	};
	const coverage = buildExpandedQueryCoverage(ctx);
	const after = buildAfterDiagnosticReport(before, { ...ctx, attributeLabels: attributeTagLabels(coverage, lang) }, queries, lang);
	return {
		siteUrl: ctx.url,
		appliedPatches: buildAppliedPatches(ctx),
		levelChanges: buildLevelChanges(before, after),
		aiSimulations: toAiSimulations(after, lang),
		afterReport: after,
		expandedQueryCoverage: coverage,
		keywordWeights: buildKeywordWeights(ctx, coverage),
		recommendationReasons: buildRecommendationReasons(ctx, coverage),
		scraped: false,
	};
}
