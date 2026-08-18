/**
 * AI Engine Visibility & Trigger Keyword Depth Testing.
 *
 * MOCK / HEURISTIC LAYER
 * ---------------------
 * Today this module synthesizes per-engine visibility from crawled on-page
 * signals (schema coverage, FAQ, robots.txt AI-bot access, GEO citation score,
 * Organization completeness) plus a domain-seeded PRNG so the same site always
 * receives the same diagnostic across reloads.
 *
 * Live crawler replacement (see `/api/audit/ai-visibility`):
 *  1. Probe each engine with Level 1 / 2 / 3 trigger queries via the Redue
 *     AI crawler / partner APIs (ChatGPT Search, Gemini Grounding, Claude,
 *     Perplexity Sonar, Copilot, Naver Clova).
 *  2. Parse whether the target domain / brand appears in the answer + citations.
 *  3. Assign status from the *deepest* query that still surfaces the site:
 *       Level 3 hit → `optimal`
 *       Level 2 only → `moderate`
 *       Level 1 only → `exact_only`
 *       no hit       → `not_indexed`
 *  4. Persist raw probe responses; this generator becomes a fallback only.
 *     Swap the UI call site (`buildAiEngineVisibilityReportFromAudit`) with
 *     `fetch('/api/audit/ai-visibility')` — the JSON schema is identical.
 */

import {
	extractSignalsFromReport,
	type GeoReputationSignals,
} from '@/lib/audit/geo-score';
import { buildDiagnosisScoreSnapshot } from '@/lib/audit/diagnosis-scores';
import { resolveIsHttps } from '@/lib/audit/scoreCalculator';
import {
	calculateTriggerDepths,
	mergeUniqueTags,
	type EngineTriggerSim,
} from '@/lib/audit/triggerDepthEngine';
import { levelFromEngineScore, scoreFromDepthLevel } from '@/lib/geo/rating-meta';
import {
	fallbackSiteMetadata,
	resolveSiteMetadata,
	type SiteMetadata,
} from '@/lib/audit/site-metadata';
import {
	buildToBeCategoryKeywords,
	buildToBeKeywordPack,
	categoryDisplacementWarning,
	isMedicalHonestyField,
	shouldCapAsIsToBrandOnly,
} from '@/lib/geo/as-is-honesty';
import { cleanMedicalEntities } from '@/lib/geo/clean-medical-entities';
import { extractCoreSpecialties } from '@/lib/geo/core-specialties';
import { generateEngineSimulation } from '@/lib/geo/engine-simulation';
import { resolveIndustryConfig, type IndustryConfig } from '@/lib/registry/universalIndustryRegistry';
import { formatColloquialLocation, pickExpandedTriggerQuery } from '@/lib/geo/query-location';
import { generateQueryMatrix } from '@/lib/geo/query-matrix';
import {
	buildSiteEntityProfile,
	type SiteEntityProfile,
} from '@/lib/geo/site-entity';
import { buildEngineOptimizationGuide } from '@/lib/geo/engine-optimization-guide';
import {
	buildCurrentStatus,
	buildOptimizationAdvice,
	buildPostOptimization,
} from '@/lib/geo/trigger-simulation';
import type { AuditLang, AuditReport } from '@/lib/site-auditor';
import type {
	EngineCurrentStatus,
	EngineOptimizationAdvice,
	EngineOptimizationGuide,
	EnginePostOptimization,
} from '@/types/geo-trigger-simulation';

export type AiVisibilityEngineId =
	| 'chatgpt'
	| 'gemini'
	| 'claude'
	| 'perplexity'
	| 'copilot'
	| 'clova';

/** 0 = not indexed · 1 = brand/exact · 2 = category+location · 3 = broad unbranded. */
export type TriggerKeywordDepthLevel = 0 | 1 | 2 | 3;

export type AiEngineVisibilityStatus = 'optimal' | 'moderate' | 'exact_only' | 'not_indexed';

/** Preset used by the mock API / Storybook-style fixtures. `auto` uses audit signals. */
export type AiVisibilityScenario = 'auto' | 'high' | 'low';

export interface TriggerQuerySet {
	/** Level 1 — brand / exact match (e.g. "[brand] location"). */
	level1: string;
	/** Level 2 — category + location (e.g. "[city] [category]"). */
	level2: string;
	/** Level 3 — broad conversational / unbranded intent. */
	level3: string;
}

export interface AiRecommendedLink {
	label: string;
	url: string;
}

export interface AiEngineVisibilityResult {
	engineId: AiVisibilityEngineId;
	engineName: string;
	status: AiEngineVisibilityStatus;
	triggerLevel: TriggerKeywordDepthLevel;
	/** Query that defines the engine's current trigger depth. */
	testedQuery: string;
	simulatedResponse: string;
	/** Terms the chat UI should highlight (brand + domain). */
	highlightTerms: string[];
	recommendedLinks: AiRecommendedLink[];
	/** Actionable Redue GEO tip to climb toward Level 3. */
	optimizationTip: string;
	currentStatus?: EngineCurrentStatus;
	optimizationAdvice?: EngineOptimizationAdvice;
	optimizationGuide?: EngineOptimizationGuide;
	postOptimization?: EnginePostOptimization;
	/** Score-engine simulation packet (levels / tags / HTTPS lock). */
	triggerSim?: EngineTriggerSim;
}

export interface AiEngineVisibilitySummary {
	indexedCount: number;
	totalEngines: number;
	/** Mean trigger depth across all 6 engines (0–3). */
	averageDepth: number;
	/** Normalized 0–100 exposure index (averageDepth / 3 * 100). */
	exposureIndex: number;
	levelCounts: Record<TriggerKeywordDepthLevel, number>;
}

export interface AiEngineVisibilityReport {
	targetUrl: string;
	domain: string;
	brandName: string;
	generatedAt: string;
	scenario: AiVisibilityScenario;
	/**
	 * `mock` = heuristic generator (current).
	 * `live` = reserved for crawler/probe responses once the pipeline ships.
	 */
	source: 'mock' | 'live';
	queries: TriggerQuerySet;
	engines: AiEngineVisibilityResult[];
	summary: AiEngineVisibilitySummary;
	/** When true, As-Is may only claim brand (Level 1) queries. */
	brandOnlyAsIs?: boolean;
}

export interface AiEngineVisibilityInput {
	url: string;
	lang?: AuditLang;
	scenario?: AiVisibilityScenario;
	siteMeta?: SiteMetadata | null;
	signals?: GeoReputationSignals | null;
	/** Measured 0–100 engine scores (same source as the exposure panel). */
	measuredEngineScores?: Partial<Record<AiVisibilityEngineId, number>> | null;
	/** Central HTTPS gate — false locks every engine at Level 1. */
	isHttps?: boolean;
}

export const AI_VISIBILITY_ENGINE_IDS: readonly AiVisibilityEngineId[] = [
	'chatgpt',
	'gemini',
	'claude',
	'perplexity',
	'copilot',
	'clova',
] as const;

export const ENGINE_DISPLAY_NAME: Record<AiVisibilityEngineId, string> = {
	chatgpt: 'ChatGPT',
	gemini: 'Gemini',
	claude: 'Claude',
	perplexity: 'Perplexity',
	copilot: 'Copilot',
	clova: 'Naver Clova',
};

const DEPTH_FROM_STATUS: Record<AiEngineVisibilityStatus, TriggerKeywordDepthLevel> = {
	optimal: 3,
	moderate: 2,
	exact_only: 1,
	not_indexed: 0,
};

const STATUS_FROM_DEPTH: Record<TriggerKeywordDepthLevel, AiEngineVisibilityStatus> = {
	3: 'optimal',
	2: 'moderate',
	1: 'exact_only',
	0: 'not_indexed',
};

const HIGH_PERFORMANCE_LEVELS: Record<AiVisibilityEngineId, TriggerKeywordDepthLevel> = {
	chatgpt: 3,
	gemini: 3,
	claude: 2,
	perplexity: 3,
	copilot: 2,
	clova: 3,
};

const LOW_PERFORMANCE_LEVELS: Record<AiVisibilityEngineId, TriggerKeywordDepthLevel> = {
	chatgpt: 1,
	gemini: 2,
	claude: 0,
	perplexity: 1,
	copilot: 0,
	clova: 1,
};

export function statusFromDepth(level: TriggerKeywordDepthLevel): AiEngineVisibilityStatus {
	return STATUS_FROM_DEPTH[level];
}

export function depthFromStatus(status: AiEngineVisibilityStatus): TriggerKeywordDepthLevel {
	return DEPTH_FROM_STATUS[status];
}

export function summarizeVisibilityEngines(engines: AiEngineVisibilityResult[]): AiEngineVisibilitySummary {
	const totalEngines = engines.length || 6;
	const levelCounts: Record<TriggerKeywordDepthLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
	let depthSum = 0;
	for (const engine of engines) {
		levelCounts[engine.triggerLevel] += 1;
		depthSum += engine.triggerLevel;
	}
	const indexedCount = engines.filter((e) => e.triggerLevel > 0).length;
	const averageDepth = totalEngines > 0 ? Math.round((depthSum / totalEngines) * 10) / 10 : 0;
	const exposureIndex = Math.round((averageDepth / 3) * 100);
	return { indexedCount, totalEngines, averageDepth, exposureIndex, levelCounts };
}

function hashStringToSeed(input: string): number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return function next() {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function domainFromUrl(raw: string): string {
	try {
		const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
		return new URL(withProtocol).hostname.replace(/^www\./, '') || raw;
	} catch {
		return raw.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0] || raw;
	}
}

function canonicalUrl(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed) return 'https://example.com';
	try {
		const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
		const u = new URL(withProtocol);
		u.hash = '';
		return u.toString().replace(/\/$/, '');
	} catch {
		return trimmed;
	}
}

interface SiteContext {
	url: string;
	domain: string;
	brandName: string;
	category: string;
	primaryKeyword: string;
	location: string;
	industryType: SiteMetadata['industryType'];
	lang: AuditLang;
	entityProfile: SiteEntityProfile;
	specialties: string[];
	industryConfig: IndustryConfig;
}

export type TriggerQueryContext = Pick<
	SiteContext,
	'brandName' | 'category' | 'primaryKeyword' | 'location' | 'domain' | 'lang'
> & {
	businessEntity?: string;
	needSignals?: string[];
	entityPhrases?: string[];
	title?: string;
	metaDescription?: string;
	description?: string;
	ogTitle?: string;
	ogDescription?: string;
	metaKeywords?: string;
	coreSpecialties?: string[];
	schemaTypes?: string[];
	schemaKnowsAbout?: string[];
	jsonLdSnippets?: string[];
	navMenuTexts?: string[];
	detectedKeywords?: string[];
};

function resolveSiteContext(input: AiEngineVisibilityInput): SiteContext {
	const lang: AuditLang = input.lang === 'en' ? 'en' : 'ko';
	const url = canonicalUrl(input.url);
	const domain = domainFromUrl(url);
	const meta = resolveSiteMetadata(input.siteMeta ?? fallbackSiteMetadata(url, lang));

	const brandName = meta.brandName?.trim() || domain;
	const primaryKeyword =
		meta.primaryKeyword?.trim() && !/믿을 만한 곳|trusted provider/i.test(meta.primaryKeyword)
			? meta.primaryKeyword.trim()
			: meta.category?.trim() || (lang === 'en' ? 'services' : '서비스');
	const category =
		meta.category?.trim() && !/믿을 만한 곳|trusted provider/i.test(meta.category)
			? meta.category.trim()
			: primaryKeyword;
	const location = formatColloquialLocation(meta.location?.trim() || meta.broadLocation?.trim() || '');
	const entityProfile = buildSiteEntityProfile({
		title: meta.title,
		metaDescription: meta.metaDescription,
		brandName,
		primaryKeyword,
		category,
		location,
		keywords: meta.entityPhrases,
		lang,
	});
	if (meta.businessEntity) entityProfile.businessEntity = meta.businessEntity;
	if (meta.needSignals?.length) entityProfile.needSignals = meta.needSignals;
	if (meta.entityPhrases?.length) entityProfile.entityPhrases = meta.entityPhrases;

	const specialties = cleanMedicalEntities(
		meta.coreSpecialties?.length
			? meta.coreSpecialties
			: extractCoreSpecialties({
					title: meta.title,
					metaKeywords: meta.metaKeywords,
					navMenuTexts: meta.navMenuTexts,
					description: meta.metaDescription,
					ogTitle: meta.ogTitle,
					ogDescription: meta.ogDescription,
					schemaTerms: meta.schemaKnowsAbout,
					targetKeywords: meta.detectedKeywords || meta.entityPhrases,
					category,
					primaryKeyword,
					h2Texts: meta.h2Texts,
					lang,
				}),
		{ plasticOk: true, limit: 3 },
	);

	const industryConfig = resolveIndustryConfig({
		lang,
		brandName,
		location,
		primaryKeyword,
		services: specialties,
		domain,
		url,
		legacyIndustry: meta.industryType,
		title: meta.title,
		description: meta.metaDescription || meta.ogDescription,
		keywords: [meta.metaKeywords, category, primaryKeyword, ...(meta.detectedKeywords ?? [])].filter(Boolean).join(' '),
		extraText: [...(meta.schemaEntityTypes ?? []), ...(meta.navMenuTexts ?? []), ...specialties].join(' '),
	});

	return {
		url,
		domain,
		brandName,
		category,
		primaryKeyword,
		location,
		industryType: meta.industryType,
		lang,
		entityProfile,
		specialties,
		industryConfig,
	};
}

export function buildTriggerQueries(ctx: TriggerQueryContext): TriggerQuerySet {
	const matrix = generateQueryMatrix({
		lang: ctx.lang,
		brandName: ctx.brandName,
		category: ctx.category,
		primaryKeyword: ctx.primaryKeyword,
		location: ctx.location,
		businessEntity: ctx.businessEntity,
		needSignals: ctx.needSignals,
		entityPhrases: ctx.entityPhrases,
		title: ctx.title,
		metaDescription: ctx.metaDescription || ctx.description,
		ogTitle: ctx.ogTitle,
		ogDescription: ctx.ogDescription,
		metaKeywords: ctx.metaKeywords,
		coreSpecialties: ctx.coreSpecialties,
		schemaTypes: ctx.schemaTypes,
		schemaKnowsAbout: ctx.schemaKnowsAbout,
		jsonLdSnippets: ctx.jsonLdSnippets,
		navMenuTexts: ctx.navMenuTexts,
		detectedKeywords: ctx.detectedKeywords,
	});
	return matrix.triggerQueries;
}

function queryForLevel(queries: TriggerQuerySet, level: TriggerKeywordDepthLevel): string {
	if (level >= 3) return queries.level3;
	if (level === 2) return queries.level2;
	return queries.level1;
}

function engineBaseScore(engineId: AiVisibilityEngineId, signals: GeoReputationSignals): number {
	const faq = signals.faqPresent ? 82 : 34;
	const bots = signals.aiBotsOk ? 80 : 26;
	const org = signals.orgComplete ? 88 : signals.orgPresent ? 56 : 28;

	switch (engineId) {
		case 'chatgpt':
			return bots * 0.45 + signals.geoPct * 0.35 + faq * 0.2;
		case 'gemini':
			return org * 0.45 + signals.schemaPct * 0.3 + signals.geoPct * 0.25;
		case 'claude':
			return faq * 0.35 + signals.technicalPct * 0.35 + signals.geoPct * 0.3;
		case 'perplexity':
			return faq * 0.5 + signals.geoPct * 0.5;
		case 'copilot':
			return bots * 0.3 + signals.schemaPct * 0.3 + signals.geoPct * 0.4;
		case 'clova':
			return signals.geoPct * 0.45 + faq * 0.3 + (signals.keywords.length >= 3 ? 78 : 42) * 0.25;
	}
}

function scoreToLevel(score: number): TriggerKeywordDepthLevel {
	if (!Number.isFinite(score) || score <= 0) return 0;
	return levelFromEngineScore(score);
}

function defaultSignals(domain: string): GeoReputationSignals {
	return {
		domain,
		technicalPct: 50,
		schemaPct: 45,
		geoPct: 48,
		orgPresent: false,
		orgComplete: false,
		faqPresent: false,
		aiBotsOk: true,
		keywords: [],
	};
}

function entityNoun(config: IndustryConfig, consultAgency = false): { singular: string; plural: string } {
	if (consultAgency) {
		return config.lang === 'en'
			? { singular: 'consulting / research organization', plural: 'consulting and research organizations' }
			: { singular: '컨설팅·연구소', plural: '컨설팅·연구소' };
	}
	const noun = config.defaultCategory;
	if (config.lang === 'en') {
		return { singular: noun, plural: `${noun}s` };
	}
	return { singular: noun, plural: noun };
}

function buildSimulatedResponse(
	engineId: AiVisibilityEngineId,
	level: TriggerKeywordDepthLevel,
	ctx: SiteContext,
	queries: TriggerQuerySet,
): string {
	const { brandName, domain, url, location, category, primaryKeyword, lang } = ctx;
	const loc = location || (lang === 'en' ? 'the area' : '해당 지역');
	const topic = primaryKeyword || category;
	const en = lang === 'en';
	const noun = entityNoun(ctx.industryConfig, ctx.entityProfile.isConsultAgency);
	const sim = generateEngineSimulation(engineId, brandName, location, ctx.specialties, domain, {
		url,
		lang,
		asIsQuery: queries.level1,
		toBeQuery: queries.level3,
		industryConfig: ctx.industryConfig,
		services: ctx.specialties,
	});

	if (level === 0) {
		if (en) {
			return engineId === 'clova'
				? `I found several well-known ${noun.plural} for “${queries.level1}”, but I don’t have a confident listing that matches this exact ${noun.singular} yet.`
				: `Here are a few commonly cited options for “${queries.level1}”. I don’t currently have a verified listing for ${brandName} (${domain}) in my sources, so I’m sticking to better-documented regional ${noun.plural}.`;
		}
		if (engineId === 'clova') {
			return `‘${queries.level1}’에 해당하는 대형·포털 등록 ${noun.plural}은 몇 곳 확인되지만, 해당 ${noun.singular}의 공식 정보는 아직 지식 베이스에 충분히 연결되어 있지 않습니다.`;
		}
		if (engineId === 'perplexity') {
			return `‘${queries.level1}’ 출처를 대조했지만 ${brandName}(${domain})을 확인된 인용 카드로 올리지 못했습니다. 정보가 더 풍부한 ${noun.plural}을 중심으로 안내합니다.`;
		}
		if (engineId === 'gemini') {
			return `Google 지도/지식패널에서 ‘${queries.level1}’에 대응하는 ${brandName} 핀을 아직 자신 있게 연결하지 못했습니다.`;
		}
		if (engineId === 'claude') {
			return `공개 출처만으로는 ${brandName}의 E-E-A-T 이력·엔티티를 검증할 수 없어 ‘${queries.level1}’ 답변에서 제외합니다.`;
		}
		if (engineId === 'copilot') {
			return `Bing 인덱스에서 ${brandName}(${domain}) 링크 카드를 찾지 못해, ‘${queries.level1}’에는 다른 지역 ${noun.plural}을 우선 표시합니다.`;
		}
		return `‘${queries.level1}’ 조건으로 자주 인용되는 ${noun.plural}을 몇 곳 찾았습니다. 현재 출처에서는 ${brandName}(${domain})을 확인된 추천 후보로 올리지 못해, 정보가 더 풍부한 곳을 중심으로 안내합니다.`;
	}

	if (level === 1) {
		const toBe = buildToBeCategoryKeywords({
			lang,
			location,
			category,
			primaryKeyword,
			brandName,
			businessEntity: ctx.entityProfile.businessEntity,
			needSignals: ctx.entityProfile.needSignals,
			specialties: ctx.specialties,
		});
		const miss = categoryDisplacementWarning({
			lang,
			categoryQuery: toBe.find((q) => /클리닉|clinic|센터|병원|추천/i.test(q)) || toBe[0] || queries.level2,
			recommendQuery: toBe.find((q) => /추천|recommend|상담|consult/i.test(q)) || toBe[1] || `${loc} ${topic} 추천`,
			medicalField: isMedicalHonestyField({
				brandName,
				category,
				primaryKeyword,
				businessEntity: ctx.entityProfile.businessEntity,
			}),
		});
		return `${sim.asIsResponse} ${miss}`;
	}

	if (level === 2) {
		if (en) {
			return `For “${queries.level2}”, ${brandName} appears among local ${ctx.specialties[0] || category} options in ${loc}. The official site (${domain}) matches the NAP details I have. To rank first on “${queries.level3}”, it still needs more citable FAQ/review pages.`;
		}
		if (engineId === 'perplexity') {
			return `‘${queries.level2}’ 인용에서 ${brandName}이 ${loc} ${ctx.specialties[0] || category} 후보로 등장합니다.\n\n* NAP: ${domain}\n* 대화형 1순위(‘${queries.level3}’)에는 FAQ 문서가 더 필요합니다.`;
		}
		if (engineId === 'gemini') {
			return `‘${queries.level2}’에서 Google 지도 후보로 ${brandName}(${loc})이 보입니다. 비브랜드 ‘추천해줘’ 질의 1순위까지는 지식패널·영업시간 구조화가 더 필요합니다.`;
		}
		if (engineId === 'clova') {
			return `‘${queries.level2}’로 찾아보면 ${brandName}이 ${loc} 후보에 올라와요. 다만 플레이스 리뷰·블로그가 더 쌓여야 ‘${queries.level3}’에서도 먼저 추천할 수 있어요.`;
		}
		if (engineId === 'claude') {
			return `‘${queries.level2}’ 범위에서 ${brandName}은 지역 후보로 식별됩니다. E-E-A-T 긴 글과 저자 엔티티가 보강되면 대화형 질의까지 확장됩니다.`;
		}
		if (engineId === 'copilot') {
			return `Bing이 ‘${queries.level2}’에서 ${brandName} 링크 카드를 보여 줍니다. 비브랜드 추천 질의 고정에는 사이트맵·스키마 신호가 더 필요합니다.\n\n🔗 ${url}`;
		}
		return `‘${queries.level2}’ 질의에서 ${brandName}이 ${loc} ${ctx.specialties[0] || category} 후보로 등장합니다. 공식 도메인 ${domain}의 NAP 정보와 일치합니다. 다만 ‘추천해줘’처럼 대화형·비브랜드 질의에서 1순위로 올리려면 FAQ·후기형 인용 문서와 엔티티 마크업을 더 보강해야 합니다.`;
	}

	return sim.toBeResponse;
}

function buildOptimizationTip(
	engineId: AiVisibilityEngineId,
	level: TriggerKeywordDepthLevel,
	ctx: SiteContext,
): string {
	const { brandName, lang } = ctx;
	const en = lang === 'en';
	const engine = ENGINE_DISPLAY_NAME[engineId];

	const engineFocus: Record<AiVisibilityEngineId, { ko: string; en: string }> = {
		chatgpt: {
			ko: 'Bing Places 등록, GPTBot 허용, 최신 웹 언급(Digital Footprint) 확대',
			en: 'Bing Places registration, GPTBot access, and a thicker recent web-mention footprint',
		},
		gemini: {
			ko: 'Google Business Profile + LocalBusiness/Organization JSON-LD 완결',
			en: 'a complete Google Business Profile plus LocalBusiness/Organization JSON-LD',
		},
		claude: {
			ko: 'E-E-A-T 긴 글(서비스 설명·주의사항·FAQ)과 저자/담당자 엔티티',
			en: 'long-form E-E-A-T pages (services, cautions, FAQ) plus author/expert entities',
		},
		perplexity: {
			ko: '인용 가능한 FAQPage/HowTo 문서와 공식 출처 URL 클러스터',
			en: 'citable FAQPage/HowTo documents and a cluster of official source URLs',
		},
		copilot: {
			ko: 'Bing 인덱싱·Places 연동과 Copilot이 읽는 사이트맵/스키마 신호',
			en: 'Bing indexing/Places plus sitemap and schema signals Copilot can read',
		},
		clova: {
			ko: '네이버 플레이스 일치 + 블로그/지식iN 최신 Q&A 콘텐츠',
			en: 'Naver Place NAP match plus fresh blog/Knowledge-iN Q&A content',
		},
	};

	const focus = en ? engineFocus[engineId].en : engineFocus[engineId].ko;

	if (level === 0) {
		return en
			? `${engine} is not citing ${brandName} yet. Unblock AI crawlers, publish Organization schema with logo/url/sameAs, and earn a first indexed source page. Then re-probe Level 1 brand queries.`
			: `${engine}에서 ${brandName}이 아직 인용되지 않습니다. AI 크롤러 허용, Organization 스키마(logo/url/sameAs) 배포, 인덱싱 가능한 공식 페이지를 먼저 확보한 뒤 Level 1 브랜드 질의부터 재측정하세요.`;
	}
	if (level === 1) {
		return en
			? `Exact-brand queries work, but category+location queries do not. Next: local landing pages, NAP consistency, and ${focus}. Goal: appear on Level 2 queries without the brand name.`
			: `브랜드 정확 질의만 통과한 상태입니다. 다음은 지역 랜딩 페이지, NAP 일치, ${focus}입니다. 목표: 브랜드명 없이 Level 2 질의에도 등장하는 것입니다.`;
	}
	if (level === 2) {
		return en
			? `${brandName} is visible on local-intent queries. To reach Level 3, add conversational FAQ content and ${focus} so ${engine} can recommend you on unbranded “please recommend” prompts.`
			: `${brandName}은 지역 의도 질의까지 노출됩니다. Level 3로 올리려면 대화형 FAQ 콘텐츠와 ${focus}를 보강해, ${engine}이 ‘추천해줘’형 비브랜드 질의에서도 1순위로 답하게 만드세요.`;
	}
	return en
		? `${engine} already recommends ${brandName} on broad unbranded prompts. Maintain recency (reviews, FAQ updates) and keep entity markup in sync so this Level 3 position does not decay.`
		: `${engine}이 이미 광의·비브랜드 질의에서 ${brandName}을 추천합니다. 후기·FAQ 최신성과 엔티티 마크업을 유지해 Level 3 지위를 지켜 주세요.`;
}

function recommendedLinks(ctx: SiteContext, level: TriggerKeywordDepthLevel): AiRecommendedLink[] {
	if (level === 0) return [];
	const links: AiRecommendedLink[] = [
		{
			label: ctx.lang === 'en' ? `${ctx.brandName} official site` : `${ctx.brandName} 공식 사이트`,
			url: ctx.url,
		},
	];
	if (level >= 2) {
		links.push({
			label: ctx.lang === 'en' ? `${ctx.brandName} · ${ctx.category}` : `${ctx.brandName} · ${ctx.category}`,
			url: ctx.url,
		});
	}
	return links;
}

function resolveEngineScoreMap(
	scenario: AiVisibilityScenario,
	signals: GeoReputationSignals,
	domain: string,
	measuredEngineScores?: Partial<Record<AiVisibilityEngineId, number>> | null,
): Record<AiVisibilityEngineId, number> {
	const hasMeasured = measuredEngineScores && Object.keys(measuredEngineScores).length > 0;
	if (hasMeasured) {
		const scores = {} as Record<AiVisibilityEngineId, number>;
		for (const engineId of AI_VISIBILITY_ENGINE_IDS) {
			const measured = measuredEngineScores[engineId];
			scores[engineId] =
				typeof measured === 'number' ? measured : engineBaseScore(engineId, signals);
		}
		return scores;
	}
	if (scenario === 'high' || scenario === 'low') {
		const fixture = scenario === 'high' ? HIGH_PERFORMANCE_LEVELS : LOW_PERFORMANCE_LEVELS;
		const scores = {} as Record<AiVisibilityEngineId, number>;
		for (const engineId of AI_VISIBILITY_ENGINE_IDS) {
			scores[engineId] = scoreFromDepthLevel(fixture[engineId]);
		}
		return scores;
	}
	const rand = mulberry32(hashStringToSeed(`ai-visibility|${domain}|${signals.geoPct}|${signals.schemaPct}`));
	const scores = {} as Record<AiVisibilityEngineId, number>;
	for (const engineId of AI_VISIBILITY_ENGINE_IDS) {
		const jitter = (rand() - 0.5) * 18;
		scores[engineId] = clamp(engineBaseScore(engineId, signals) + jitter, 0, 100);
	}
	return scores;
}

function resolveEngineLevels(
	scenario: AiVisibilityScenario,
	signals: GeoReputationSignals,
	domain: string,
	measuredEngineScores?: Partial<Record<AiVisibilityEngineId, number>> | null,
): Record<AiVisibilityEngineId, TriggerKeywordDepthLevel> {
	if (scenario === 'high') return { ...HIGH_PERFORMANCE_LEVELS };
	if (scenario === 'low') return { ...LOW_PERFORMANCE_LEVELS };

	const scores = resolveEngineScoreMap(scenario, signals, domain, measuredEngineScores);
	const levels = {} as Record<AiVisibilityEngineId, TriggerKeywordDepthLevel>;
	for (const engineId of AI_VISIBILITY_ENGINE_IDS) {
		levels[engineId] = scoreToLevel(scores[engineId]);
	}
	return levels;
}

export function buildAiEngineVisibilityReport(input: AiEngineVisibilityInput): AiEngineVisibilityReport {
	const ctx = resolveSiteContext(input);
	const scenario: AiVisibilityScenario = input.scenario ?? 'auto';
	const signals = input.signals ?? defaultSignals(ctx.domain);
	const meta = resolveSiteMetadata(input.siteMeta ?? fallbackSiteMetadata(ctx.url, ctx.lang));
	const queries = buildTriggerQueries({
		...ctx,
		businessEntity: ctx.entityProfile.businessEntity,
		needSignals: ctx.entityProfile.needSignals,
		entityPhrases: ctx.entityProfile.entityPhrases,
		title: meta.title,
		metaDescription: meta.metaDescription,
		ogTitle: meta.ogTitle,
		ogDescription: meta.ogDescription,
		metaKeywords: meta.metaKeywords,
		coreSpecialties: ctx.specialties,
		schemaTypes: meta.schemaEntityTypes,
		schemaKnowsAbout: meta.schemaKnowsAbout,
		navMenuTexts: meta.navMenuTexts,
		detectedKeywords: meta.detectedKeywords,
	});
	const isHttps = input.isHttps ?? resolveIsHttps({ url: ctx.url });
	const engineScoreMap = resolveEngineScoreMap(scenario, signals, ctx.domain, input.measuredEngineScores);
	const triggerDepths = calculateTriggerDepths(
		ctx.brandName,
		ctx.location,
		ctx.primaryKeyword || ctx.category,
		engineScoreMap,
		isHttps,
	);
	const levels = resolveEngineLevels(scenario, signals, ctx.domain, input.measuredEngineScores);
	const brandOnlyAsIs = shouldCapAsIsToBrandOnly({
		brandName: ctx.brandName,
		title: ctx.entityProfile.corpus,
		corpus: ctx.entityProfile.corpus,
		category: ctx.category,
		primaryKeyword: ctx.primaryKeyword,
		businessEntity: ctx.entityProfile.businessEntity,
		signals,
		allowCategoryAsIs: scenario === 'high' && !ctx.entityProfile.isConsultAgency,
	});
	const toBePack = buildToBeKeywordPack({
		lang: ctx.lang,
		location: ctx.location,
		category: ctx.category,
		primaryKeyword: ctx.primaryKeyword,
		brandName: ctx.brandName,
		businessEntity: ctx.entityProfile.businessEntity,
		needSignals: ctx.entityProfile.needSignals,
		specialties: ctx.specialties,
	});
	const toBeCategoryQueries = toBePack.all;

	const useFixtureLevels = scenario === 'high' || scenario === 'low';
	const engines: AiEngineVisibilityResult[] = AI_VISIBILITY_ENGINE_IDS.map((engineId) => {
		const sim = triggerDepths[engineId];
		const rawLevel = levels[engineId];
		let asIsLevel: 1 | 2 | 3 = sim?.currentLevel ?? 1;
		let displayLevel: TriggerKeywordDepthLevel = asIsLevel;
		if (useFixtureLevels) {
			if (!isHttps) {
				displayLevel = rawLevel === 0 ? 0 : 1;
				asIsLevel = 1;
			} else if (brandOnlyAsIs && rawLevel > 0) {
				displayLevel = 1;
				asIsLevel = 1;
			} else {
				displayLevel = rawLevel;
				asIsLevel = rawLevel === 0 ? 1 : rawLevel;
			}
		} else if (brandOnlyAsIs) {
			asIsLevel = 1;
			displayLevel = 1;
		}
		const status = statusFromDepth(displayLevel);
		const currentQuery = queryForLevel(queries, asIsLevel);
		const currentResponse = buildSimulatedResponse(engineId, displayLevel, ctx, queries);
		const expandedTriggerQuery = pickExpandedTriggerQuery(engineId, toBePack, queries.level3);
		const postQueries = { ...queries, level3: expandedTriggerQuery };
		const postResponse = buildSimulatedResponse(engineId, 3, ctx, postQueries);
		const tip = buildOptimizationTip(engineId, displayLevel, ctx);
		let statusTags = [...(sim?.tags ?? [])];
		if (asIsLevel === 1) {
			statusTags = mergeUniqueTags(
				statusTags.filter((tag) => tag !== '#세부서비스인용가능'),
				['#브랜드전용트리거'],
			);
		}
		const currentStatus = buildCurrentStatus({
			lang: ctx.lang,
			asIsLevel,
			triggerQuery: currentQuery,
			simulationResponse: currentResponse,
			statusTags,
			isLockedBySecurity: !isHttps,
		});
		const optimizationAdvice = buildOptimizationAdvice(engineId, undefined, ctx.lang, { isHttps });
		const optimizationGuide = buildEngineOptimizationGuide({
			engineId,
			currentLevel: asIsLevel,
			lang: ctx.lang,
			location: ctx.location,
			category: ctx.category,
			specialties: ctx.specialties,
			needSignals: ctx.entityProfile.needSignals,
			brandName: ctx.brandName,
		});
		const postOptimization = buildPostOptimization({
			lang: ctx.lang,
			expandedTriggerQuery,
			expectedSimulationResponse: postResponse,
			expandedCategoryQueries: toBeCategoryQueries,
		});
		return {
			engineId,
			engineName: ENGINE_DISPLAY_NAME[engineId],
			status,
			triggerLevel: displayLevel,
			testedQuery: currentQuery,
			simulatedResponse: currentResponse,
			highlightTerms: [ctx.brandName, ctx.domain].filter(Boolean),
			recommendedLinks: recommendedLinks(ctx, displayLevel),
			optimizationTip: tip,
			currentStatus,
			optimizationAdvice,
			optimizationGuide,
			postOptimization,
			triggerSim: sim
				? {
						...sim,
						currentLevel: asIsLevel,
						currentQuery,
						targetQuery: expandedTriggerQuery || sim.targetQuery,
						tags: statusTags,
						isLockedBySecurity: !isHttps,
					}
				: undefined,
		};
	});

	return {
		targetUrl: ctx.url,
		domain: ctx.domain,
		brandName: ctx.brandName,
		generatedAt: new Date().toISOString(),
		scenario,
		source: 'mock',
		queries,
		engines,
		summary: summarizeVisibilityEngines(engines),
		brandOnlyAsIs,
	};
}

/** Client/report path — uses live crawl signals from the audit engine. */
export function buildAiEngineVisibilityReportFromAudit(
	report: AuditReport,
	lang: AuditLang = 'ko',
	scenario: AiVisibilityScenario = 'auto',
	measuredEngineScores?: Partial<Record<AiVisibilityEngineId, number>> | null,
	isHttps?: boolean,
): AiEngineVisibilityReport {
	const https = isHttps ?? resolveIsHttps({ url: report.url, hasSsl: report.hasSsl });
	const reputationScores =
		measuredEngineScores ??
		buildDiagnosisScoreSnapshot(report, null, lang).scores.engineScores;
	return buildAiEngineVisibilityReport({
		url: report.url,
		lang,
		scenario,
		siteMeta: report.siteMeta,
		signals: extractSignalsFromReport(report),
		measuredEngineScores: reputationScores,
		isHttps: https,
	});
}

/** High-GEO fixture (most engines at Level 2–3) for QA / demos. */
export function buildHighPerformanceVisibilityFixture(
	url = 'https://sunshineclinic.kr',
	lang: AuditLang = 'ko',
): AiEngineVisibilityReport {
	return buildAiEngineVisibilityReport({ url, lang, scenario: 'high' });
}

/** Low-GEO fixture (Level 0–1 dominant) for QA / demos. */
export function buildLowPerformanceVisibilityFixture(
	url = 'https://sunshineclinic.kr',
	lang: AuditLang = 'ko',
): AiEngineVisibilityReport {
	return buildAiEngineVisibilityReport({ url, lang, scenario: 'low' });
}
