/**
 * Precision GEO diagnostics — AI crawler access, Schema.org 5-property
 * completeness, and per-engine citation/penalty chips.
 *
 * All builders are pure and optional-field safe. Per-bot allow/block comes
 * from the crawled robots.txt map — never a mock “ClaudeBot-only” default.
 */

import type { AuditLang, AuditReport } from '@/lib/site-auditor';
import { resolveIndustryConfigFromSite } from '@/lib/registry/universalIndustryRegistry';
import {
	evaluateSchemaFiveProperties,
	formatSameAsCheckDetail,
	sameAsFidelityFromUrls,
	schemaFiveToChecks,
} from '@/lib/audit/extractors/universal-entity';
import { buildJsonLdEntityPool, detectGeoCoordinates, detectOpeningHoursSpecification, detectServiceCatalog } from '@/lib/audit/schemaAnalyzer';
import type {
	AiCrawlerBotId,
	AiCrawlerBotStatus,
	AIEngineId,
	AIEngineStatusBadge,
	EngineAnalysisTag,
	KeywordDepthLevel,
	SchemaPropertyCheck,
} from '@/types/geo-diagnostic';

export type PrecisionLang = AuditLang;

const BOT_META: Record<AiCrawlerBotId, { label: string; provider?: string }> = {
	gptbot: { label: 'GPTBot (OpenAI)', provider: 'OpenAI' },
	perplexitybot: { label: 'PerplexityBot', provider: 'Perplexity' },
	claudebot: { label: 'ClaudeBot (Anthropic)', provider: 'Anthropic' },
	'google-extended': { label: 'Google-Extended', provider: 'Google' },
};

const ENTITY_TYPE_CANDIDATES = [
	'MedicalClinic',
	'Hospital',
	'Dentist',
	'Physician',
	'VeterinaryCare',
	'MedicalBusiness',
	'Pharmacy',
	'LegalService',
	'Attorney',
	'AccountingService',
	'HomeAndConstructionBusiness',
	'HealthClub',
	'ExerciseGym',
	'EducationalOrganization',
	'RealEstateAgent',
	'ProfessionalService',
	'LocalBusiness',
	'Store',
	'Restaurant',
	'BeautySalon',
	'OnlineStore',
	'SoftwareApplication',
	'Manufacturer',
	'Organization',
] as const;

export interface AiCrawlerStatusInput {
	lang: PrecisionLang;
	aiBotsOk: boolean;
	aiBotAccess?: Partial<Record<AiCrawlerBotId, boolean>>;
}

export interface SchemaPropertyInput {
	lang: PrecisionLang;
	schemaTypes?: readonly string[];
	jsonLdCorpus?: string;
	html?: string;
	/** Official sameAs URLs already extracted for the entity gauge — shared source of truth. */
	sameAs?: readonly string[];
	collectedUrls?: readonly string[];
	organizationMissing?: readonly string[];
	orgComplete?: boolean;
	industryType?: string;
	category?: string;
	keyword?: string;
}

export interface EngineTagInput {
	lang: PrecisionLang;
	engineId: AIEngineId;
	statusBadge: AIEngineStatusBadge;
	depthLevel: KeywordDepthLevel | null;
	napMatchRate?: number;
	bingPlacesRegistered?: boolean;
	googleMentionsLow?: boolean;
	naverMentionIssue?: boolean;
	faqPresent?: boolean;
	orgPresent?: boolean;
	orgComplete?: boolean;
	claudeBotBlocked?: boolean;
	hasLocalBusinessSchema?: boolean;
	/** After-prescription snapshot: schema/FAQ chips flip positive. */
	improved?: boolean;
	/** Injected need/specialty attributes (e.g. 야간진료_속성_추가). */
	attributeLabels?: readonly string[];
	/** Central HTTPS gate — false prepends security-warning chips. */
	isHttps?: boolean;
}

function claudeBlockedWarning(lang: PrecisionLang): string {
	return lang === 'en'
		? 'Direct cause of lower Claude exposure — ClaudeBot cannot ingest this site.'
		: 'Claude 노출률 저하의 직접 원인 — ClaudeBot 수집이 차단되어 있습니다.';
}

/**
 * Per-bot allow map from the live robots.txt crawl.
 * Missing per-bot keys fall back to the aggregate `aiBotsOk` check — never
 * invent a ClaudeBot-only block.
 */
export function buildAiCrawlerStatuses(input: AiCrawlerStatusInput): AiCrawlerBotStatus[] {
	const { lang, aiBotsOk, aiBotAccess } = input;
	const ids: AiCrawlerBotId[] = ['gptbot', 'perplexitybot', 'claudebot', 'google-extended'];
	const hasPerBot = Boolean(aiBotAccess && Object.keys(aiBotAccess).length > 0);

	return ids.map((id) => {
		const meta = BOT_META[id];
		const recorded = hasPerBot ? aiBotAccess?.[id] : undefined;
		const allowed = typeof recorded === 'boolean' ? recorded : aiBotsOk;
		const warning = !allowed && id === 'claudebot' ? claudeBlockedWarning(lang) : undefined;
		return { id, label: meta.label, provider: meta.provider, allowed, warning };
	});
}

export function buildAiCrawlerStatusesFromAudit(report: AuditReport, lang: PrecisionLang): AiCrawlerBotStatus[] {
	const checks = report.checklist?.length ? report.checklist : report.categories.flatMap((c) => c.checks);
	const botCheck = checks.find((c) => c.id === 'ai-bots-allowed');
	const aiBotsOk = botCheck ? (botCheck.status ?? (botCheck.passed ? 'pass' : 'fail')) === 'pass' : true;
	return buildAiCrawlerStatuses({
		lang,
		aiBotsOk,
		aiBotAccess: report.metrics?.aiBotAccess,
	});
}

function findEntityType(schemaTypes: readonly string[]): string | undefined {
	const normalized = schemaTypes.map((t) => t.replace(/^https?:\/\/schema\.org\//i, '').trim());
	return ENTITY_TYPE_CANDIDATES.find((candidate) =>
		normalized.some((t) => t.toLowerCase() === candidate.toLowerCase()),
	);
}

function expectedEntityType(input: SchemaPropertyInput): string {
	const found = findEntityType(input.schemaTypes ?? []);
	if (found && !/^Hospital$/i.test(found)) return found;
	const hay = `${input.keyword || ''} ${input.category || ''} ${input.industryType || ''}`.toLowerCase();
	if (/치과|dental|implant/.test(hay)) return 'Dentist';
	if (/동물병원|vet/.test(hay)) return 'VeterinaryCare';
	const config = resolveIndustryConfigFromSite({
		lang: input.lang,
		primaryKeyword: input.keyword,
		category: input.category,
		legacyIndustry: input.industryType,
		title: input.keyword,
		description: hay,
		keywords: hay,
		schemaTypes: input.schemaTypes,
	});
	return config.schemaType;
}

export function applySharedSameAsToSchemaChecks(
	properties: readonly SchemaPropertyCheck[],
	sameAsUrls: readonly string[],
	lang: PrecisionLang = 'ko',
): SchemaPropertyCheck[] {
	const fidelity = sameAsFidelityFromUrls(sameAsUrls);
	const detail = formatSameAsCheckDetail(fidelity, lang);
	return properties.map((item) =>
		item.id === 'sameAs' ? { ...item, complete: fidelity.complete, detail } : item,
	);
}

export function buildSchemaPropertyChecks(input: SchemaPropertyInput): SchemaPropertyCheck[] {
	const lang = input.lang;
	const types = input.schemaTypes ?? [];
	const corpus = [input.jsonLdCorpus ?? '', input.html ?? '', ...(input.collectedUrls ?? [])]
		.filter(Boolean)
		.join('\n');
	const expectedType = expectedEntityType(input);
	const parsed = evaluateSchemaFiveProperties(corpus, {
		schemaTypes: types,
		expectedType,
		sameAs: input.sameAs,
	});
	if (types.some((t) => /GeoCoordinates/i.test(t))) parsed.geo.complete = true;
	if (types.some((t) => /OpeningHoursSpecification/i.test(t))) parsed.openingHours.complete = true;
	if (types.some((t) => /OfferCatalog/i.test(t))) parsed.availableService.complete = true;

	// Defense-in-depth: `schemaAnalyzer.ts` independently re-flattens the same
	// `@graph` into an entity pool and re-checks geo / openingHours /
	// hasOfferCatalog from scratch. Its result can only turn a false
	// "missing" into a correct "present" (never the reverse), so it's safe
	// to OR into `evaluateSchemaFiveProperties`'s read without risking a
	// regression if the two implementations ever diverge.
	const entityPool = buildJsonLdEntityPool(corpus);
	if (entityPool.length) {
		if (!parsed.geo.complete) {
			const geo = detectGeoCoordinates(entityPool);
			if (geo.found) {
				parsed.geo = { complete: true, latitude: geo.latitude, longitude: geo.longitude };
			}
		}
		if (!parsed.openingHours.complete && detectOpeningHoursSpecification(entityPool).found) {
			parsed.openingHours.complete = true;
		}
		if (!parsed.availableService.complete) {
			const catalog = detectServiceCatalog(entityPool);
			if (catalog.found) {
				parsed.availableService = {
					complete: true,
					count: Math.max(parsed.availableService.count, catalog.itemCount),
					categoryCount: parsed.availableService.categoryCount,
				};
			}
		}
	}
	if (!parsed.entityType.complete) {
		const fromTypes = findEntityType(types);
		if (fromTypes) {
			parsed.entityType.complete = true;
			parsed.entityType.value = fromTypes;
		}
	}
	if (!parsed.entityType.value) parsed.entityType.value = expectedType;
	return schemaFiveToChecks(parsed, lang);
}

export function buildSchemaPropertyChecksFromAudit(report: AuditReport, lang: PrecisionLang): SchemaPropertyCheck[] {
	const orgMissing = report.metrics?.organizationMissing;
	// `jsonLdFullCorpus` is untruncated and safe to re-parse as JSON; `jsonLdSnippets`
	// is a 1200-char display preview that corrupts multi-entity `@graph` documents
	// (geo / openingHoursSpecification / hasOfferCatalog silently read as "missing").
	const jsonLdCorpus = report.metrics?.jsonLdFullCorpus || (report.metrics?.jsonLdSnippets ?? []).join('\n');
	return buildSchemaPropertyChecks({
		lang,
		schemaTypes: report.metrics?.schemaTypes,
		jsonLdCorpus,
		html: [jsonLdCorpus, report.footerText, ...(report.collectedUrls ?? [])].filter(Boolean).join('\n'),
		sameAs: report.siteMeta?.sameAs,
		collectedUrls: report.collectedUrls,
		organizationMissing: orgMissing,
		orgComplete: Boolean(orgMissing && orgMissing.length === 0),
		industryType: report.siteMeta?.industryType,
		category: report.siteMeta?.category,
		keyword: report.siteMeta?.primaryKeyword,
	});
}

export function schemaCompletenessScore(properties: readonly SchemaPropertyCheck[]): {
	completeCount: number;
	total: number;
	percent: number;
} {
	const total = properties.length || 5;
	const completeCount = properties.filter((p) => p.complete).length;
	return { completeCount, total, percent: Math.round((completeCount / total) * 100) };
}

function tag(id: string, label: string, polarity: EngineAnalysisTag['polarity']): EngineAnalysisTag {
	return { id, label, polarity };
}

function labels(lang: PrecisionLang) {
	if (lang === 'en') {
		return {
			napMatch: 'Official NAP match',
			napMismatch: 'NAP mismatch',
			bingMissing: 'Bing Places unlisted',
			bingOk: 'Bing Places listed',
			webMentionsLow: 'Thin web mentions',
			webMentionsOk: 'Healthy web mentions',
			mapsOk: 'Google Maps reviews healthy',
			mapsLow: 'Google Maps reviews thin',
			localSchema: 'LocalBusiness schema',
			localSchemaMissing: 'LocalBusiness schema missing',
			faqWeak: 'FAQ structure weak',
			faqOk: 'FAQ structured',
			sourcesWeak: 'Official source citations thin',
			sourcesOk: 'Official sources cited',
			claudeBlocked: 'ClaudeBot blocked',
			brandOnly: 'Brand-only trigger',
			notIndexed: 'Not indexed',
			schemaPatched: 'Schema reinforced',
			faqPatched: 'FAQ structured',
			naverFresh: 'Naver recency healthy',
			naverStale: 'Naver recency thin',
			copilotSchema: 'Copilot schema signal',
			copilotWeak: 'Bing index signal weak',
			httpsMissing: 'HTTPS not applied',
			httpsRecommendLimit: 'Non-secure source · recommend limited',
		};
	}
	return {
		napMatch: '공식NAP일치',
		napMismatch: 'NAP불일치',
		bingMissing: 'BingPlaces미등록',
		bingOk: 'BingPlaces등록',
		webMentionsLow: '웹언급량부족',
		webMentionsOk: '웹언급량양호',
		mapsOk: '구글맵리뷰양호',
		mapsLow: '구글맵리뷰부족',
		localSchema: 'LocalBusiness스키마',
		localSchemaMissing: 'LocalBusiness스키마누락',
		faqWeak: 'FAQ구조화미흡',
		faqOk: 'FAQ구조화완료',
		sourcesWeak: '공식출처인용부족',
		sourcesOk: '공식출처인용',
		claudeBlocked: 'ClaudeBot차단됨',
		brandOnly: '브랜드전용트리거',
		notIndexed: '미인덱싱',
		schemaPatched: '스키마보강완료',
		faqPatched: 'FAQ구조화완료',
		naverFresh: '네이버최신성양호',
		naverStale: '네이버최신성부족',
		copilotSchema: 'Copilot스키마신호',
		copilotWeak: 'Bing인덱스신호약함',
		httpsMissing: 'HTTPS보안미적용',
		httpsRecommendLimit: '비보안출처_추천제한',
	};
}

/**
 * Dynamic citation / penalty chips. Missing optional signals fall back to
 * status-badge heuristics so engine cards still render without extra payload.
 */
export function buildEngineAnalysisTags(input: EngineTagInput): EngineAnalysisTag[] {
	const t = labels(input.lang);
	const depth = input.depthLevel;
	const brandOnly = input.statusBadge === 'exact_only' || depth === 1;
	const unindexed = input.statusBadge === 'not_indexed' || depth == null;
	const napOk = input.napMatchRate == null ? depth !== null && depth >= 2 : input.napMatchRate >= 90;
	const bingOk = input.bingPlacesRegistered ?? false;
	const mentionsLow = input.googleMentionsLow ?? (input.statusBadge !== 'optimal');
	const faqOk = input.improved ? true : Boolean(input.faqPresent);
	const orgOk = input.improved ? true : Boolean(input.orgPresent || input.hasLocalBusinessSchema);
	const claudeBlocked = input.claudeBotBlocked ?? (input.engineId === 'claude' && (brandOnly || unindexed));
	const securityTags: EngineAnalysisTag[] =
		input.isHttps === false
			? [tag('https-missing', t.httpsMissing, 'negative'), tag('https-recommend-limit', t.httpsRecommendLimit, 'negative')]
			: [];

	if (input.improved) {
		const after: EngineAnalysisTag[] = [];
		if (input.engineId === 'chatgpt' || input.engineId === 'clova') {
			after.push(tag('nap', t.napMatch, 'positive'));
		} else if (input.engineId === 'gemini') {
			after.push(tag('local-schema', t.localSchema, 'positive'));
		} else if (input.engineId === 'perplexity') {
			after.push(tag('faq', t.faqPatched, 'positive'));
		} else if (input.engineId === 'claude') {
			if (claudeBlocked) after.push(tag('claude-bot', t.claudeBlocked, 'negative'));
			after.push(tag('faq', t.faqPatched, 'positive'));
		} else {
			after.push(tag('schema-patched', t.schemaPatched, 'positive'));
		}
		(input.attributeLabels || []).slice(0, 2).forEach((label, index) => {
			after.push(tag(`need-attr-${index}`, label, 'positive'));
		});
		if (!after.some((item) => item.id === 'schema-patched')) {
			after.push(tag('schema-patched', t.schemaPatched, 'positive'));
		}
		return [...securityTags, ...after].slice(0, 6);
	}

	switch (input.engineId) {
		case 'chatgpt':
			return [
				...securityTags,
				tag('nap', napOk ? t.napMatch : t.napMismatch, napOk ? 'positive' : 'negative'),
				tag('bing', bingOk ? t.bingOk : t.bingMissing, bingOk ? 'positive' : 'negative'),
				tag('mentions', mentionsLow ? t.webMentionsLow : t.webMentionsOk, mentionsLow ? 'negative' : 'positive'),
			];
		case 'gemini':
			return [
				...securityTags,
				tag('maps', mentionsLow ? t.mapsLow : t.mapsOk, mentionsLow ? 'negative' : 'positive'),
				tag('local-schema', orgOk ? t.localSchema : t.localSchemaMissing, orgOk ? 'positive' : 'negative'),
			];
		case 'perplexity':
			return [
				...securityTags,
				tag('faq', faqOk ? t.faqOk : t.faqWeak, faqOk ? 'positive' : 'negative'),
				tag('sources', faqOk && !mentionsLow ? t.sourcesOk : t.sourcesWeak, faqOk && !mentionsLow ? 'positive' : 'negative'),
			];
		case 'claude': {
			const tags: EngineAnalysisTag[] = [...securityTags];
			if (claudeBlocked) tags.push(tag('claude-bot', t.claudeBlocked, 'negative'));
			if (unindexed) tags.push(tag('unindexed', t.notIndexed, 'negative'));
			else if (brandOnly) tags.push(tag('brand-only', t.brandOnly, 'negative'));
			if (!tags.length) tags.push(tag('schema', orgOk ? t.localSchema : t.localSchemaMissing, orgOk ? 'positive' : 'negative'));
			return tags;
		}
		case 'copilot':
			return [
				...securityTags,
				tag('bing', bingOk ? t.bingOk : t.copilotWeak, bingOk ? 'positive' : 'negative'),
				tag('schema', orgOk ? t.copilotSchema : t.localSchemaMissing, orgOk ? 'positive' : 'negative'),
			];
		case 'clova':
			return [
				...securityTags,
				tag('nap', napOk ? t.napMatch : t.napMismatch, napOk ? 'positive' : 'negative'),
				tag('naver', input.naverMentionIssue ? t.naverStale : t.naverFresh, input.naverMentionIssue ? 'negative' : 'positive'),
			];
	}
}

export function resolveEngineAnalysisTags(
	result: {
		engine: { id: AIEngineId };
		statusBadge: AIEngineStatusBadge;
		depthLevel: KeywordDepthLevel | null;
		analysisTags?: readonly EngineAnalysisTag[];
	},
	fallback?: Omit<EngineTagInput, 'engineId' | 'statusBadge' | 'depthLevel' | 'lang'> & { lang?: PrecisionLang },
): readonly EngineAnalysisTag[] {
	if (result.analysisTags?.length) return result.analysisTags;
	return buildEngineAnalysisTags({
		lang: fallback?.lang ?? 'ko',
		engineId: result.engine.id,
		statusBadge: result.statusBadge,
		depthLevel: result.depthLevel,
		napMatchRate: fallback?.napMatchRate,
		bingPlacesRegistered: fallback?.bingPlacesRegistered,
		googleMentionsLow: fallback?.googleMentionsLow,
		naverMentionIssue: fallback?.naverMentionIssue,
		faqPresent: fallback?.faqPresent,
		orgPresent: fallback?.orgPresent,
		orgComplete: fallback?.orgComplete,
		claudeBotBlocked: fallback?.claudeBotBlocked,
		hasLocalBusinessSchema: fallback?.hasLocalBusinessSchema,
		improved: fallback?.improved,
		isHttps: fallback?.isHttps,
	});
}
