/**
 * Next-gen GEO metrics (2026) — Share of Voice, entity disambiguation,
 * RAG chunk readability, fact density (information gain), and `/llms.txt`.
 *
 * Pure TypeScript. Industry nouns, Schema.org types, representative titles,
 * and FAQ copy come from `universalIndustryRegistry` — never hardcoded
 * leftover verticals.
 */

import { composeSearchQuery, dedupeQueryTokens } from '@/lib/geo/search-query-normalize';
import { buildSovMarketAnalysis } from '@/lib/audit/universal-compliant-engine';
import { matchCompetitorRoster } from '@/lib/audit/competitor-match';
import {
	SOV_LEADER_RESIDUAL_RATIO,
	THIRD_PARTY_SHARE,
	buildCompetitorSearchQuery,
	cleanCompetitorName,
	findClientSearchIndex,
	isSelfBrandName,
	resolveLiveCompetitorNames,
	toSearchRankList,
} from '@/lib/audit/realCompetitors';
import {
	normalizeSovKeyword,
	resolveKeywordSovShares,
	type ResolveKeywordSovOptions,
	type SovShareTable,
} from '@/lib/audit/sovLeaderboardData';
import { buildTargetBrandTokens, classifyQuerySovIntent, type QuerySovIntent } from '@/lib/audit/universal-sov-engine';
import {
	allocateGenericSovPie,
	calculateGenericSoV,
	decomposeQueryEntity,
	normalizeSovSearchHits,
	scoreEntityMatch,
	type GenericSovCandidate,
	type SovSearchHit,
} from '@/lib/audit/generic-sov';
import {
	buildNicheLeadershipInsight,
	genericSearchDispersionLabels,
	listingMentionsNiche,
	resolveNicheOfferingMatch,
} from '@/lib/audit/sov-niche-entity';
import {
	detectIndustry,
	getIndustryProfile,
	resolveIndustryConfig,
	type FaqItem,
	type IndustryConfig,
	type IndustryType,
	type RegistryLang,
	type ResolveIndustryConfigInput,
} from '@/lib/registry/universalIndustryRegistry';
import { generateLlmsTxt, type SiteDiagnosticResult } from '@/lib/audit/llms-txt';
import {
	collectOfficialSameAs,
	detectPersonKnowledgeGraph,
	extractPlaceCidPrecise,
	extractTaxIdPrecise,
	normalizeTaxId as normalizeTaxIdPrecise,
} from '@/lib/audit/extractors/universal-entity';

export type AdvancedGeoLang = RegistryLang;

/**
 * Unified market leaderboard pie — client stays in their live search slot.
 * #1 = 27%, #2 = 16%, #3 / outside top 3 = 5%, 3rd-party blogs = 52%.
 */
export const RANK_BENCHMARK = {
	leader: { min: 27, max: 27 },
	runner: { min: 16, max: 16 },
	unranked: { min: 5, max: 5 },
	directory: { min: 50, max: 60 },
} as const;

/** Fixed rank-share table used for the unified 1–3 leaderboard. */
export const RANK_1_SHARE = 27;
export const RANK_2_SHARE = 16;
export const RANK_3_SHARE = 5;
export const RANK_SHARE_TABLE = [RANK_1_SHARE, RANK_2_SHARE, RANK_3_SHARE] as const;

/** `clientRank` when the brand is not in the live top 3 (shown in the #3 slot). */
export const CLIENT_UNRANKED_RANK = 4;

/** Unlisted / #3 official-web baseline. */
export const AS_IS_SHARE_MIN = RANK_3_SHARE;

/** Unified model uses a fixed 5% for #3 and outside top 3. */
export const AS_IS_UNRANKED_MAX = RANK_3_SHARE;

/** Overall As-Is cap including a live #1 listing. */
export const AS_IS_SHARE_MAX = RANK_1_SHARE;

/** GEO 처방 후 탈환 목표 밴드 (48–55, 전형 48–52). */
export const TO_BE_SHARE_MIN = 48;
export const TO_BE_SHARE_MAX = 55;

/** Unranked on-page GEO (최대 +4%p): 스키마 3 + 엔티티 1 + RAG 1. */
export const AS_IS_SCHEMA_WEIGHT = 3;
export const AS_IS_ENTITY_WEIGHT = 1;
export const AS_IS_RAG_WEIGHT = 1;

/** 3자 블로그 파이 흡수율 — To-Be = asIs + directory × 0.65 + leader × 0.35. */
export const TO_BE_DIRECTORY_ABSORB_RATIO = 0.65;
/** 1위 경쟁사 파이 흡수율. */
export const TO_BE_LEADER_ABSORB_RATIO = 0.35;

/** Recommended text-to-HTML ratio for RAG-friendly pages (25%+). */
export const RAG_TEXT_TO_HTML_RECOMMENDED = 0.25;

/** Fact-density target: 10% of tokens are quantitative. */
export const FACT_DENSITY_TARGET = 0.1;

export const ENTITY_DISAMBIGUATION_WEIGHTS = {
	taxId: 30,
	placeCid: 25,
	sameAs: 25,
	representativeKg: 20,
} as const;

export const RAG_CHUNK_WEIGHTS = {
	textToHtml: 60,
	semantic: 40,
} as const;

export const SEMANTIC_TAG_POINTS = {
	article: 16,
	section: 14,
	main: 10,
} as const;

export interface AdvancedGeoNap {
	name?: string;
	telephone?: string;
	address?: string;
	addressLocality?: string;
	addressRegion?: string;
	streetAddress?: string;
}

export interface CompetitorSeed {
	name: string;
	/** Optional relative weight; omitted seeds share the residual evenly. */
	weight?: number;
	/** True when the name came from Naver Local / Google Places. */
	isRealData?: boolean;
}

export interface ShareOfVoiceInput {
	brandName?: string;
	location?: string;
	industryType?: IndustryType | string | null;
	legacyIndustry?: string | null;
	title?: string | null;
	description?: string | null;
	keywords?: string | readonly string[] | null;
	primaryKeyword?: string | null;
	/** Explicit As-Is override (5–27). When omitted, derived from live search rank. */
	ownSharePct?: number;
	/** Site-measured GEO readiness used to compute unranked As-Is brand share. */
	geoReadinessScore?: GeoReadinessScore;
	/** True when JSON-LD / Schema.org types were detected on the audited page. */
	hasSchema?: boolean;
	competitors?: readonly CompetitorSeed[];
	/** Raw top-5 search titles including the audited brand (Naver Local / Google). */
	rawSearchResults?: readonly string[];
	/** Live search query, e.g. `안성 도수치료 추천`. */
	targetQuery?: string;
	/** Dynamic brand aliases extracted from the audited site metadata. */
	brandAliases?: readonly string[];
	/** Equipment / product tokens used to classify specialized queries. */
	productTokens?: readonly string[];
	/** Official menu / equipment / amenity corpus from the audited site. */
	offerings?: readonly string[];
	offeringCorpus?: string;
	/** Optional SERP rows with title/snippet/body for strict entity co-occurrence. */
	searchHits?: ReadonlyArray<string | SovSearchHit>;
	/** Per-engine AI recommendation counts keyed by listing name. */
	aiCitations?: ReadonlyArray<{ name: string; count?: number }>;
	/** JSON-LD @types from the audited page (MedicalBusiness, LegalService, …). */
	schemaTypes?: readonly string[];
	/** Narrative used on the SoV gap card when live names are bound. */
	lossInsight?: string;
	/** Override for the vulnerability / recapture-strategy callout. */
	vulnerabilityInsight?: string;
	lang?: AdvancedGeoLang;
}

export interface ShareOfVoiceShare {
	id: string;
	name: string;
	sharePct: number;
	isOwn: boolean;
	rank: number;
	isRealData?: boolean;
	isDominant?: boolean;
	/** True for the portal blog/cafe/map-review leakage slice. */
	isDirectory?: boolean;
}

export interface ShareOfVoiceResult {
	ownSharePct: number;
	/** Alias of `ownSharePct` — unified-leaderboard As-Is (27 / 16 / 5). */
	asIsShare: number;
	/** 1-based live search rank; 4 when the brand is outside the top 3. */
	clientRank: number;
	/** GEO 처방 적용 시 탈환 목표 점유율 (48–55). */
	toBeShare: number;
	/** Non-client ranking slots on the leaderboard (always 2). */
	competitorCount: 2;
	shares: ShareOfVoiceShare[];
	/** Rank 1–3 + directory — always 100. */
	totalPct: 100;
	/** Highest non-client ranking share (27 if the client is not #1, else 16). */
	leaderSharePct: number;
	/** Portal blog/cafe/map-review leakage (typically 52). */
	directoryShare: number;
	/** leaderSharePct − ownSharePct */
	gapPct: number;
	/** Alias of `gapPct` — 1위와의 격차 (%p). */
	gapToLeader: number;
	/** To-Be − As-Is recapture potential (%p). */
	reclaimPotential: number;
	/** Alias of `reclaimPotential`. */
	reclaimGain: number;
	/** Combined non-client ranking share (100 − own − directory). */
	competitorBlocPct: number;
	regionWeight: number;
	industryWeight: number;
	regionTier: RegionCompetitionTier;
	hasRealCompetitorData: boolean;
	targetQuery?: string;
	lossInsight?: string;
	/** 경쟁사 온페이지 취약점 + GEO 처방 시 역전 안내. */
	vulnerabilityInsight?: string;
	/** Full 1–3 + 3rd-party pie with the client left in their live slot. */
	leaderboard: LeaderboardItem[];
}

export interface GeoReadinessScore {
	entityScore: number;
	ragScore: number;
	hasSchema: boolean;
}

export interface CompetitorItem {
	name: string;
	share: number;
	isDominant: boolean;
	isRealData?: boolean;
	isDirectory?: boolean;
}

export interface SearchRankItem {
	name: string;
	isClient: boolean;
}

export interface LeaderboardItem {
	rank: number;
	name: string;
	share: number;
	isClient: boolean;
	isRealData: boolean;
	isThirdParty?: boolean;
}

export interface UnifiedSovResult {
	targetQuery: string;
	brandName: string;
	/** Intent-adjusted display rank (navigational brand queries are always 1). */
	clientRank: number;
	/** Live search rank before intent override. */
	liveClientRank: number;
	queryIntent?: QuerySovIntent;
	asIsShare: number;
	toBeShare: number;
	reclaimGain: number;
	leaderboard: LeaderboardItem[];
	lossInsight: string;
	placeMonopoly?: boolean;
	targetIndustry?: string;
	nicheLeadership?: boolean;
	nicheItemToken?: string;
	hasNicheItem?: boolean;
}

export interface CalculateUnifiedSovOptions {
	industryConfig?: IndustryConfig;
	categoryName?: string;
	lang?: AdvancedGeoLang;
	targetQuery?: string;
	brandAliases?: readonly string[];
	productTokens?: readonly string[];
	offerings?: readonly string[];
	offeringCorpus?: string;
	searchHits?: ReadonlyArray<string | SovSearchHit>;
	aiCitations?: ReadonlyArray<{ name: string; count?: number }>;
	industryType?: string;
	schemaTypes?: readonly string[];
}

export interface DynamicSovResult {
	targetQuery: string;
	brandName: string;
	/** 통합 리더보드 점유율 — 키워드별 실측 As-Is (추천 칩 기본 5) */
	asIsShare: number;
	/** GEO 처방 후 탈환 목표 — 키워드별 To-Be (추천 칩 기본 48) */
	toBeShare: number;
	/** 포털 블로그·카페·지도 리뷰 3자 분산 — 키워드별 실측 (추천 칩 기본 52) */
	directoryShare: number;
	/** Intent-adjusted display rank (navigational brand queries are always 1). */
	clientRank: number;
	/** Live search rank before intent override — used when switching back to generic chips. */
	liveClientRank?: number;
	queryIntent?: QuerySovIntent;
	/** 1위와의 격차 (자사가 1위이면 0) */
	gapToLeader: number;
	/** To-Be − As-Is 탈환 잠재력 (%p) */
	reclaimPotential: number;
	/** Alias of `reclaimPotential`. */
	reclaimGain: number;
	/** Full market table: live #1–#3 (client included) + 3rd-party slice. */
	leaderboard: LeaderboardItem[];
	/** Non-client rows (ranking slots + directory) for legacy consumers. */
	competitors: CompetitorItem[];
	lossInsight: string;
	vulnerabilityInsight: string;
	placeMonopoly?: boolean;
	targetIndustry?: string;
	nicheLeadership?: boolean;
	nicheItemToken?: string;
	hasNicheItem?: boolean;
}

export interface CalculateDynamicSovOptions {
	industryConfig?: IndustryConfig;
	categoryName?: string;
	lang?: AdvancedGeoLang;
	targetQuery?: string;
	/** Audited site's display name — binds the vulnerability callout to the real target instead of a generic pronoun. */
	targetSiteName?: string;
	brandAliases?: readonly string[];
	productTokens?: readonly string[];
	offerings?: readonly string[];
	offeringCorpus?: string;
	searchHits?: ReadonlyArray<string | SovSearchHit>;
	aiCitations?: ReadonlyArray<{ name: string; count?: number }>;
	industryType?: string;
	schemaTypes?: readonly string[];
}

export type RegionCompetitionTier = 'high' | 'mid' | 'local';

export interface EntityDisambiguationInput {
	taxId?: string | null;
	placeCid?: string | null;
	sameAs?: readonly string[] | number | null;
	representativeKgLinked?: boolean;
	representativeName?: string | null;
	jsonLdCorpus?: string | null;
	html?: string | null;
}

export interface EntitySignalScore {
	present: boolean;
	score: number;
	max: number;
}

export interface EntityDisambiguationBreakdown {
	taxId: EntitySignalScore & { valid: boolean; value: string };
	placeCid: EntitySignalScore & { value: string };
	sameAs: EntitySignalScore & { count: number; urls: string[] };
	representativeKg: EntitySignalScore & { linked: boolean };
}

export interface EntityDisambiguationResult {
	/** 0–100 */
	score: number;
	breakdown: EntityDisambiguationBreakdown;
}

export interface RagChunkingInput {
	html?: string | null;
	text?: string | null;
	htmlLength?: number;
	textLength?: number;
	hasArticle?: boolean;
	hasSection?: boolean;
	hasMain?: boolean;
}

export interface RagSemanticFlags {
	article: boolean;
	section: boolean;
	main: boolean;
	score: number;
}

export interface RagChunkingResult {
	/** 0–100 */
	score: number;
	textToHtmlRatio: number;
	textToHtmlPct: number;
	meetsRecommendedRatio: boolean;
	ratioScore: number;
	semantic: RagSemanticFlags;
}

export interface FactDensityInput {
	text?: string | null;
	html?: string | null;
}

export interface FactDensityCategories {
	numbers: number;
	units: number;
	weekdays: number;
	times: number;
	priceConditions: number;
}

export interface FactDensityResult {
	/** 0–100 */
	score: number;
	tokenCount: number;
	quantitativeTokenCount: number;
	densityPct: number;
	categories: FactDensityCategories;
}

export interface LlmsTxtInput {
	brandName?: string;
	industryType?: IndustryType | string | null;
	legacyIndustry?: string | null;
	services?: readonly string[];
	nap?: AdvancedGeoNap;
	representativeName?: string | null;
	representativeTitle?: string;
	location?: string;
	primaryKeyword?: string;
	url?: string;
	domain?: string;
	title?: string | null;
	description?: string | null;
	keywords?: string | readonly string[] | null;
	faqs?: readonly FaqItem[];
	lang?: AdvancedGeoLang;
}

export interface AdvancedGeoMetricsInput
	extends ShareOfVoiceInput,
		EntityDisambiguationInput,
		RagChunkingInput,
		FactDensityInput,
		LlmsTxtInput {
	services?: readonly string[];
	primaryKeyword?: string;
	url?: string;
	domain?: string;
}

export interface AdvancedGeoMetricsReport {
	industry: IndustryConfig;
	shareOfVoice: ShareOfVoiceResult;
	dynamicSov: DynamicSovResult;
	entityDisambiguation: EntityDisambiguationResult;
	ragChunking: RagChunkingResult;
	factDensity: FactDensityResult;
	llmsTxt: string;
}

/** Higher = more leader-heavy (legal/medical ads concentrate). */
const INDUSTRY_CONCENTRATION: Record<IndustryType, number> = {
	legal: 0.78,
	medical: 0.72,
	veterinary: 0.7,
	accounting: 0.68,
	realestate: 0.66,
	professional: 0.64,
	education: 0.6,
	interior: 0.58,
	fitness: 0.54,
	general: 0.52,
	restaurant: 0.5,
	beauty: 0.48,
};

const HIGH_COMPETITION_REGION =
	/서울|강남|서초|송파|분당|판교|여의도|마포|해운대|센텀|잠실|홍대|seoul|gangnam|bundang|pangyo/i;
const MID_COMPETITION_REGION =
	/부산|대구|인천|광주|대전|울산|수원|성남|용인|고양|제주|busan|incheon|daegu|daejeon/i;

const SOCIAL_SAME_AS =
	/instagram|facebook|youtube|twitter|linkedin|threads|tiktok|blog\.naver|cafe\.naver|post\.naver|story\.kakao|pf\.kakao|plus\.kakao|maps\.google|map\.naver|place\.naver|place\.map\.kakao|map\.kakao|bing\.com\/maps|g\.page|goo\.gl\/maps/i;

const UNIT_RE =
	/\d+(?:\.\d+)?\s*(?:kg|g|mg|ml|l|cm|mm|km|m²|㎡|평|원|만원|억원|달러|회|분|시간|일|주|개월|년|명|세|%|℃|°c|kcal|\$|€)|(?:kg|g|mg|ml|cm|mm|km|평|만원|억원|회|명|세)\b/gi;
const WEEKDAY_RE =
	/월요일|화요일|수요일|목요일|금요일|토요일|일요일|평일|주말|월~금|월-금|\b(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?s?\b|weekdays?|weekends?/gi;
const TIME_RE =
	/\b\d{1,2}:\d{2}(?:\s*(?:am|pm))?\b|오전\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?|오후\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?|\d{1,2}시\s*\d{0,2}분?|영업시간|진료시간|상담시간|\b(?:am|pm)\b/gi;
const PRICE_CONDITION_RE =
	/무료|할인|비급여|급여|보험\s*적용|본인부담|부터|이상|이하|원부터|가격|수가|상담료|free|discount|from\s*\$|starting\s+at|co-?pay/gi;
const NUMBER_RE = /(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?:%|원|만원)?/g;

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function clampScore(value: number): number {
	return clamp(Math.round(Number.isFinite(value) ? value : 0), 0, 100);
}

function cleanPhrase(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

function langOf(lang?: AdvancedGeoLang): AdvancedGeoLang {
	return lang === 'en' ? 'en' : 'ko';
}

function resolveConfig(input: ResolveIndustryConfigInput): IndustryConfig {
	const extraText = [input.extraText, input.primaryKeyword, ...(input.services ?? [])].filter(Boolean).join(' ');
	const detected = detectIndustry({
		title: input.title || input.brandName,
		description: input.description,
		keywords: input.keywords,
		extraText,
	});
	return resolveIndustryConfig({
		...input,
		extraText,
		type: input.type || (detected !== 'general' ? detected : undefined),
	});
}

export function regionCompetitionTier(location: string | null | undefined): RegionCompetitionTier {
	const loc = cleanPhrase(location);
	if (!loc) return 'mid';
	if (HIGH_COMPETITION_REGION.test(loc)) return 'high';
	if (MID_COMPETITION_REGION.test(loc)) return 'mid';
	return 'local';
}

export function industryConcentration(type: IndustryType): number {
	return INDUSTRY_CONCENTRATION[type] ?? INDUSTRY_CONCENTRATION.general;
}

/** Residual split: 1위 62% / 2위 38% of the *direct competitor pool* (after 3rd-party leakage). */
export function splitCompetitorResidual(remaining: number): [number, number] {
	const safe = Math.max(0, Math.round(remaining));
	const leader = Math.round(safe * SOV_LEADER_RESIDUAL_RATIO);
	return [leader, safe - leader];
}

export function thirdPartyShareLabel(lang?: AdvancedGeoLang): string {
	return langOf(lang) === 'en'
		? 'Portal blogs, cafes & map reviews (3rd-party leakage)'
		: '포털 블로그·카페·지도 리뷰 (3자 분산)';
}

/** 3-way citation pie: official as-is + directory leakage + two ranking competitors. */
export function allocateCitationPie(asIsShare: number): {
	asIsShare: number;
	directoryShare: number;
	comp1Share: number;
	comp2Share: number;
} {
	const directoryShare = THIRD_PARTY_SHARE;
	const pool = Math.max(0, 100 - asIsShare - directoryShare);
	const [comp1Share, comp2Share] = splitCompetitorResidual(pool);
	return { asIsShare, directoryShare, comp1Share, comp2Share };
}

/**
 * 3위 이하 / 미노출 As-Is (4–8%): 스키마 유무 + 엔티티 식별 + RAG 가중합.
 * 온페이지만으로는 1·2위 밴드(27 / 17)를 넘지 않는다.
 */
export function calculateAsIsBrandShare(geoReadinessScore: GeoReadinessScore): number {
	const entityScore = clamp(Number(geoReadinessScore.entityScore) || 0, 0, 100);
	const ragScore = clamp(Number(geoReadinessScore.ragScore) || 0, 0, 100);
	const schemaWeight = geoReadinessScore.hasSchema ? AS_IS_SCHEMA_WEIGHT : 0;
	const entityWeight = (entityScore / 100) * AS_IS_ENTITY_WEIGHT;
	const ragWeight = (ragScore / 100) * AS_IS_RAG_WEIGHT;
	return Math.min(
		AS_IS_UNRANKED_MAX,
		Math.max(AS_IS_SHARE_MIN, Math.round(AS_IS_SHARE_MIN + schemaWeight + entityWeight + ragWeight)),
	);
}

/** Live search rank → As-Is share. #1=27, #2=16, #3+/unlisted=5. */
export function calculateRankBasedAsIsShare(
	clientIndex: number,
	_geoReadinessScore?: GeoReadinessScore,
): number {
	if (clientIndex === 0) return RANK_1_SHARE;
	if (clientIndex === 1) return RANK_2_SHARE;
	return RANK_3_SHARE;
}

/**
 * Symmetric citation pie on the unified table: #1=27, #2=16, #3=5, directory=52.
 */
export function allocateSymmetricCitationPie(
	clientIndex: number,
	asIsShare: number,
): {
	asIsShare: number;
	directoryShare: number;
	comp1Share: number;
	comp2Share: number;
} {
	const directoryShare = THIRD_PARTY_SHARE;
	if (clientIndex === 0) {
		return { asIsShare, directoryShare, comp1Share: RANK_2_SHARE, comp2Share: RANK_3_SHARE };
	}
	if (clientIndex === 1) {
		return { asIsShare, directoryShare, comp1Share: RANK_1_SHARE, comp2Share: RANK_3_SHARE };
	}
	return { asIsShare, directoryShare, comp1Share: RANK_1_SHARE, comp2Share: RANK_2_SHARE };
}

/** To-Be: 3자 블로그 파이의 65%를 흡수, 48–55% 밴드로 클램프. */
export function calculateUnifiedToBeShare(asIsShare: number): number {
	return Math.min(
		TO_BE_SHARE_MAX,
		Math.max(TO_BE_SHARE_MIN, asIsShare + Math.round(THIRD_PARTY_SHARE * TO_BE_DIRECTORY_ABSORB_RATIO)),
	);
}

/** To-Be: 3자 블로그 파이의 65%를 흡수, 48–55% 밴드로 클램프. */
export function calculateToBeShare(
	asIsShare: number,
	_leaderShare?: number,
	_directoryShare: number = THIRD_PARTY_SHARE,
): number {
	return calculateUnifiedToBeShare(asIsShare);
}

export function buildLossInsight(input: {
	region: string;
	service: string;
	leaderName: string;
	gapToLeader: number;
	leaderShare?: number;
	directoryShare?: number;
	lang?: AdvancedGeoLang;
}): string {
	const lang = langOf(input.lang);
	const directoryShare = input.directoryShare ?? THIRD_PARTY_SHARE;
	const leaderShare = input.leaderShare;
	if (lang === 'en') {
		if (leaderShare != null) {
			return `On “${input.service}” queries in ${input.region}, citations leak to portal blogs/reviews (${directoryShare}%) and the top listing (${leaderShare}%) instead of the official site.`;
		}
		return `On “${input.service}” recommendation queries in ${input.region}, the gap to #1 (${input.leaderName}) is ${input.gapToLeader}pp.`;
	}
	if (leaderShare != null) {
		return `${input.region} 지역 "${input.service}" AI 질의 시, 공식 웹 대신 포털 블로그·리뷰(${directoryShare}%) 및 상위 검색처(${leaderShare}%)로 인용이 분산되고 있습니다.`;
	}
	return `${input.region} 지역 "${input.service}" AI 추천 질의에서 1위(${input.leaderName})와의 점유율 격차는 ${input.gapToLeader}%p입니다.`;
}

/** 스키마 미비 경쟁사는 15–25%에 머물고, GEO 처방 시 3자 블로그 파이를 흡수한다. */
export function buildVulnerabilityInsight(input: {
	leaderName: string;
	leaderShare: number;
	toBeShare: number;
	reclaimPotential?: number;
	/** 진단 대상 사이트명 — 누락 시 안전한 기본값("자사"/"This business")으로 대체된다. */
	targetSiteName?: string;
	lang?: AdvancedGeoLang;
}): string {
	const lang = langOf(input.lang);
	const siteName = cleanPhrase(input.targetSiteName) || (lang === 'en' ? 'This business' : '자사');
	if (lang === 'en') {
		return `Major competitors also have incomplete structured-data signals and remain around ${input.leaderShare}%. Applying GEO prescriptions first can absorb traffic that was leaking to third-party blogs, with a goal of reaching about ${input.toBeShare}% share.`;
	}
	return `주요 경쟁사 역시 구조화 데이터 신호가 불완전하여 ${input.leaderShare}% 수준에 머물러 있습니다. GEO 처방을 선제 적용할 경우 3자 블로그로 분산되던 트래픽을 흡수하여 최대 ${input.toBeShare}% 수준의 점유율 확보를 목표로 최적화할 수 있습니다.`;
}

function detectHasSchema(input: {
	hasSchema?: boolean;
	geoReadinessScore?: GeoReadinessScore;
	jsonLdCorpus?: string | null;
	html?: string | null;
}): boolean {
	if (typeof input.hasSchema === 'boolean') return input.hasSchema;
	if (typeof input.geoReadinessScore?.hasSchema === 'boolean') return input.geoReadinessScore.hasSchema;
	const corpus = `${input.jsonLdCorpus || ''}\n${input.html || ''}`;
	return /"@type"\s*:|application\/ld\+json|itemtype=["'][^"']*schema\.org/i.test(corpus);
}

function unifiedFallbackName(region: string, rank: number, lang: AdvancedGeoLang): string {
	const loc = cleanPhrase(region);
	if (lang === 'en') {
		return loc ? `${loc} #${rank} listing` : `#${rank} listing`;
	}
	return loc ? `${loc} ${rank}위 노출 기관` : `${rank}위 노출 기관`;
}

function clientOutsideLabel(clientName: string, lang: AdvancedGeoLang, foundIndex = -1): string {
	if (foundIndex >= 3) {
		const rank = foundIndex + 1;
		return lang === 'en' ? `You · ${clientName} (#${rank})` : `자사 · ${clientName} (${rank}위)`;
	}
	return lang === 'en' ? `You · ${clientName} (outside top 3)` : `자사 · ${clientName} (순위 밖)`;
}

/**
 * Strips GNB/admin chrome (병원장 인사말, 병원 둘러보기…) and collapses duplicate
 * tokens (병원 병원) from a raw primaryKeyword / category phrase before it is
 * ever shown as a search query. Never returns more than `maxTokens` words.
 */
function sanitizeServicePhrase(value: string, maxTokens = 3): string {
	if (!value) return '';
	return dedupeQueryTokens([value]).slice(0, maxTokens).join(' ');
}

function buildUnifiedTargetQuery(region: string, mainService: string, lang: AdvancedGeoLang): string {
	const loc = cleanPhrase(region);
	const service = sanitizeServicePhrase(mainService);
	if (lang === 'en') return composeSearchQuery([loc, service], { maxTokens: 5 });
	return composeSearchQuery([loc, service], { trailingIntent: '추천', maxTokens: 5 });
}

function buildUnifiedLossInsight(input: {
	region: string;
	/** Currently active/selected keyword chip — NOT the site's static main service. */
	service: string;
	clientRank: number;
	asIsShare: number;
	directoryShare?: number;
	lang: AdvancedGeoLang;
}): string {
	const loc = cleanPhrase(input.region) || (input.lang === 'en' ? 'this area' : '해당');
	const service = cleanPhrase(input.service) || (input.lang === 'en' ? 'this service' : '핵심 서비스');
	const directoryShare = input.directoryShare ?? THIRD_PARTY_SHARE;
	const rankLabel =
		input.clientRank >= CLIENT_UNRANKED_RANK
			? input.lang === 'en'
				? 'outside the top 3'
				: '3위 밖'
			: input.lang === 'en'
				? `#${input.clientRank}`
				: `${input.clientRank}위`;
	if (input.lang === 'en') {
		return `In the ${loc} “${service}” search market, you are currently ${rankLabel} (${input.asIsShare}%), and ${directoryShare}% of traffic is leaking to 3rd-party blogs.`;
	}
	return `${loc} 지역 "${service}" 검색 시장에서 자사는 현재 ${rankLabel}(${input.asIsShare}%)이며, ${directoryShare}%의 트래픽이 3자 블로그로 분산되고 있습니다.`;
}

function peerDisplayName(
	slot: { name?: string; isRealData?: boolean } | undefined,
	rank: number,
	region: string,
	lang: AdvancedGeoLang,
): string {
	const name = cleanPhrase(slot?.name);
	if (name) return name;
	return unifiedFallbackName(region, rank, lang);
}

function composeIntentLeaderboard(input: {
	clientName: string;
	clientRank: number;
	shareTable: SovShareTable;
	peers: ReadonlyArray<{ name: string; isRealData?: boolean }>;
	region: string;
	lang: AdvancedGeoLang;
	liveFoundIndex: number;
}): LeaderboardItem[] {
	const { clientName, clientRank, shareTable, peers, region, lang, liveFoundIndex } = input;

	let items: LeaderboardItem[];
	if (clientRank === 1) {
		items = [
			{ rank: 1, name: clientName, share: shareTable.own, isClient: true, isRealData: true },
			{
				rank: 2,
				name: peerDisplayName(peers[0], 2, region, lang),
				share: shareTable.rank1,
				isClient: false,
				isRealData: peers[0]?.isRealData === true,
			},
			{
				rank: 3,
				name: peerDisplayName(peers[1], 3, region, lang),
				share: shareTable.rank2,
				isClient: false,
				isRealData: peers[1]?.isRealData === true,
			},
		];
	} else if (clientRank === 2) {
		items = [
			{
				rank: 1,
				name: peerDisplayName(peers[0], 1, region, lang),
				share: shareTable.rank1,
				isClient: false,
				isRealData: peers[0]?.isRealData === true,
			},
			{ rank: 2, name: clientName, share: shareTable.own, isClient: true, isRealData: true },
			{
				rank: 3,
				name: peerDisplayName(peers[1], 3, region, lang),
				share: shareTable.rank2,
				isClient: false,
				isRealData: peers[1]?.isRealData === true,
			},
		];
	} else if (clientRank === 3) {
		items = [
			{
				rank: 1,
				name: peerDisplayName(peers[0], 1, region, lang),
				share: shareTable.rank1,
				isClient: false,
				isRealData: peers[0]?.isRealData === true,
			},
			{
				rank: 2,
				name: peerDisplayName(peers[1], 2, region, lang),
				share: shareTable.rank2,
				isClient: false,
				isRealData: peers[1]?.isRealData === true,
			},
			{ rank: 3, name: clientName, share: shareTable.own, isClient: true, isRealData: true },
		];
	} else {
		items = [
			{
				rank: 1,
				name: peerDisplayName(peers[0], 1, region, lang),
				share: shareTable.rank1,
				isClient: false,
				isRealData: peers[0]?.isRealData === true,
			},
			{
				rank: 2,
				name: peerDisplayName(peers[1], 2, region, lang),
				share: shareTable.rank2,
				isClient: false,
				isRealData: peers[1]?.isRealData === true,
			},
			{
				rank: 3,
				name: clientOutsideLabel(clientName, lang, liveFoundIndex),
				share: shareTable.own,
				isClient: true,
				isRealData: liveFoundIndex !== -1,
			},
		];
	}

	return items.filter((item) => item.isClient || item.share > 0);
}

function collectPeerSlots(
	matched: { slots: ReadonlyArray<{ name: string; isClient: boolean; isRealData: boolean }> },
	existing?: ReadonlyArray<LeaderboardItem>,
): Array<{ name: string; isRealData?: boolean }> {
	const fromMatch = matched.slots.filter((slot) => !slot.isClient).map((slot) => ({
		name: slot.name,
		isRealData: slot.isRealData,
	}));
	if (fromMatch.length >= 2) return fromMatch;
	const fromExisting = (existing ?? [])
		.filter((row) => !row.isClient && !row.isThirdParty)
		.map((row) => ({ name: row.name, isRealData: row.isRealData }));
	const seen = new Set(fromMatch.map((row) => row.name.replace(/\s+/g, '').toLowerCase()));
	for (const row of fromExisting) {
		const key = row.name.replace(/\s+/g, '').toLowerCase();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		fromMatch.push(row);
	}
	return fromMatch;
}

function listingKey(name: string): string {
	return name.replace(/\s+/g, '').toLowerCase();
}

function resolveOfferingCorpus(options?: {
	offeringCorpus?: string;
	offerings?: readonly string[];
	productTokens?: readonly string[];
}): string {
	return [options?.offeringCorpus, ...(options?.offerings ?? []), ...(options?.productTokens ?? [])]
		.filter(Boolean)
		.join(' ');
}

function citationCountFor(
	name: string,
	citations: ReadonlyArray<{ name: string; count?: number }> | undefined,
): number {
	if (!citations?.length) return 0;
	const key = listingKey(name);
	return citations.reduce((sum, row) => {
		const rowKey = listingKey(row.name);
		if (!rowKey || (rowKey !== key && !key.includes(rowKey) && !rowKey.includes(key))) return sum;
		return sum + Math.max(0, Math.round(Number(row.count) || 1));
	}, 0);
}

function shareTableFromAllocation(
	allocated: NonNullable<ReturnType<typeof allocateGenericSovPie>>,
	fallback: SovShareTable,
): SovShareTable {
	const own = allocated.own;
	return {
		rank1: allocated.rank1,
		rank2: allocated.rank2,
		own,
		thirdParty: allocated.thirdParty,
		targetSov: clamp(Math.max(own, fallback.targetSov), own, 98),
		potentialGain: clamp(Math.max(own, fallback.targetSov), own, 98) - own,
		intent: 'specialized',
		clientRank: allocated.clientRank,
	};
}

function buildGenericSovCandidates(input: {
	names: readonly string[];
	hits: ReadonlyArray<SovSearchHit>;
	clientName: string;
	brandTokens: readonly string[];
	offeringCorpus: string;
	holdsCoreEntity: boolean;
	aiCitations?: ReadonlyArray<{ name: string; count?: number }>;
}): GenericSovCandidate[] {
	const hitByName = new Map(input.hits.map((hit) => [listingKey(hit.name), hit]));
	const candidates: GenericSovCandidate[] = input.names.map((name, index) => {
		const hit = hitByName.get(listingKey(name));
		const isClient = isSelfBrandName(name, input.clientName, input.brandTokens);
		return {
			name,
			rank: hit?.rank ?? index + 1,
			title: hit?.title,
			snippet: hit?.snippet,
			body: isClient ? [hit?.body, input.offeringCorpus].filter(Boolean).join(' ') : hit?.body,
			aiCitationCount: (hit?.aiCitationCount ?? 0) + citationCountFor(name, input.aiCitations),
			isClient,
			holdsCoreEntity: isClient && input.holdsCoreEntity,
		};
	});
	if (input.clientName && !candidates.some((row) => row.isClient)) {
		candidates.push({
			name: input.clientName,
			rank: 6,
			body: input.offeringCorpus,
			isClient: true,
			holdsCoreEntity: input.holdsCoreEntity,
			aiCitationCount: citationCountFor(input.clientName, input.aiCitations),
		});
	}
	return candidates;
}

/**
 * 검색 API 원본 1~5위를 질의 유형별 SoV로 매핑하고, 자사를 실제 슬롯에 남긴다.
 * 브랜드 직검색(navigational)이면 자사는 무조건 1위 / 85~95% 이다.
 * 특화 장비/고유명사 질의는 `calculateGenericSoV` 로 엔티티 미보유 업체를 배제한다.
 * 3위 밖이면 상위 2곳 + `자사(순위 밖)`로 3위를 대체한다.
 */
export function calculateUnifiedMarketSov(
	clientName: string,
	region: string,
	mainService: string,
	rawSearchResults: ReadonlyArray<string | SovSearchHit> = [],
	options?: CalculateUnifiedSovOptions,
): UnifiedSovResult {
	const lang = langOf(options?.lang ?? options?.industryConfig?.lang);
	const loc = cleanPhrase(region);
	const service = sanitizeServicePhrase(mainService);
	const brand = cleanPhrase(clientName);
	const targetQuery = cleanPhrase(options?.targetQuery) || buildUnifiedTargetQuery(loc, service, lang);
	const insightKeyword = cleanPhrase(options?.targetQuery) || service;
	const brandTokens = buildTargetBrandTokens(options?.brandAliases ?? [], brand);
	const hits = normalizeSovSearchHits(options?.searchHits ?? rawSearchResults);
	const ranked = toSearchRankList(hits.map((hit) => hit.name));
	const offeringCorpus = resolveOfferingCorpus(options);
	const matched = matchCompetitorRoster({
		clientName: brand,
		rankedNames: ranked,
		query: targetQuery,
		categoryName: options?.categoryName || service,
		mainService: service,
		region: loc,
		lang,
		brandAliases: brandTokens,
		industryType: options?.industryType || options?.industryConfig?.type,
		schemaTypes: options?.schemaTypes || (options?.industryConfig?.schemaType ? [options.industryConfig.schemaType] : undefined),
		productTokens: options?.productTokens,
		offerings: options?.offerings,
		offeringCorpus,
	});
	const decomposition = decomposeQueryEntity(targetQuery, {
		region: loc,
		categoryName: options?.categoryName || service,
		mainService: service,
		productTokens: options?.productTokens,
		brandTokens,
	});
	const clientHoldsEntity =
		matched.hasNicheItem ||
		(decomposition.strictEntityCheck &&
			scoreEntityMatch(offeringCorpus, decomposition.coreEntities).kind !== 'none');
	const generic = calculateGenericSoV({
		targetQuery,
		candidates: buildGenericSovCandidates({
			names: matched.unifiedNames.length ? matched.unifiedNames : ranked,
			hits,
			clientName: brand,
			brandTokens,
			offeringCorpus,
			holdsCoreEntity: clientHoldsEntity,
			aiCitations: options?.aiCitations,
		}),
		region: loc,
		categoryName: options?.categoryName || service,
		mainService: service,
		productTokens: options?.productTokens,
		brandTokens,
		decomposition,
	});
	const earlyIntent = classifyQuerySovIntent(targetQuery, brandTokens, options?.productTokens);
	const allocated =
		earlyIntent === 'navigational' || matched.placeMonopoly ? null : allocateGenericSovPie(generic);
	const foundIndex = matched.clientIndex;
	const liveClientRank = foundIndex !== -1 ? foundIndex + 1 : CLIENT_UNRANKED_RANK;
	const nicheLeadership = matched.nicheLeadership || clientHoldsEntity;
	const shareOptions: ResolveKeywordSovOptions = {
		brandTokens,
		brandName: brand,
		productTokens: options?.productTokens,
		clientRank: liveClientRank,
		cited: foundIndex !== -1,
		placeMonopoly: matched.placeMonopoly,
		nicheLeadership,
	};
	const intentTable = resolveKeywordSovShares(targetQuery, shareOptions);
	const shareTable = allocated ? shareTableFromAllocation(allocated, intentTable) : intentTable;
	const queryIntent = shareTable.intent ?? classifyQuerySovIntent(targetQuery, brandTokens, options?.productTokens);
	const clientRank =
		allocated?.clientRank ?? shareTable.clientRank ?? (queryIntent === 'navigational' ? 1 : liveClientRank);
	const fallbackBrand = brand || (lang === 'en' ? 'This business' : '자사');
	const genericPeers = generic.leaderboard
		.filter((row) => !row.isClient)
		.map((row) => ({
			name: row.name,
			isRealData: matched.slots.some((slot) => !slot.isClient && listingKey(slot.name) === listingKey(row.name) && slot.isRealData),
		}));
	const items = composeIntentLeaderboard({
		clientName: fallbackBrand,
		clientRank,
		shareTable,
		peers: allocated ? genericPeers : collectPeerSlots(matched),
		region: loc,
		lang,
		liveFoundIndex: foundIndex,
	});

	const clientItem = items.find((item) => item.isClient) || items[items.length - 1];
	const asIsShare = clientItem?.share ?? shareTable.own;
	const toBeShare = shareTable.targetSov;
	const reclaimGain = toBeShare - asIsShare;
	const leaderboard: LeaderboardItem[] = [
		...items,
		{
			rank: 0,
			name: thirdPartyShareLabel(lang),
			share: shareTable.thirdParty,
			isClient: false,
			isRealData: false,
			isThirdParty: true,
		},
	];

	return {
		targetQuery,
		brandName: brand,
		clientRank,
		liveClientRank,
		queryIntent,
		asIsShare,
		toBeShare,
		reclaimGain,
		leaderboard,
		lossInsight: nicheLeadership
			? buildNicheLeadershipInsight(loc, matched.nicheItemToken || decomposition.coreEntities[0] || '', lang)
			: buildSovMarketAnalysis({
					location: loc,
					primaryKeywords: [insightKeyword],
					metrics: {
						currentShare: asIsShare,
						targetShare: toBeShare,
						directoryShare: shareTable.thirdParty,
						clientRank,
					},
					lang,
				}),
		placeMonopoly: matched.placeMonopoly,
		targetIndustry: matched.targetIndustry,
		nicheLeadership,
		nicheItemToken: matched.nicheItemToken || decomposition.coreEntities[0] || '',
		hasNicheItem: matched.hasNicheItem || clientHoldsEntity,
	};
}

export function unifiedToDynamicSov(
	unified: UnifiedSovResult,
	options?: CalculateDynamicSovOptions,
): DynamicSovResult {
	const lang = langOf(options?.lang ?? options?.industryConfig?.lang);
	const ranking = unified.leaderboard.filter((item) => !item.isThirdParty);
	const directory = unified.leaderboard.find((item) => item.isThirdParty);
	const leader = ranking.find((item) => !item.isClient) ?? ranking[0];
	const leaderShare = leader?.share ?? 0;
	const gapToLeader = unified.clientRank === 1 ? 0 : Math.max(0, leaderShare - unified.asIsShare);

	return {
		targetQuery: unified.targetQuery,
		brandName: unified.brandName,
		asIsShare: unified.asIsShare,
		toBeShare: unified.toBeShare,
		directoryShare: directory?.share ?? 0,
		clientRank: unified.clientRank,
		liveClientRank: unified.liveClientRank,
		queryIntent: unified.queryIntent,
		gapToLeader,
		reclaimPotential: unified.reclaimGain,
		reclaimGain: unified.reclaimGain,
		leaderboard: unified.leaderboard,
		competitors: unified.leaderboard
			.filter((item) => !item.isClient)
			.map((item) => ({
				name: item.name,
				share: item.share,
				isDominant: item.isThirdParty !== true && item.rank === 1 && unified.clientRank !== 1,
				isRealData: item.isRealData,
				isDirectory: item.isThirdParty === true,
			})),
		lossInsight: unified.lossInsight,
		placeMonopoly: unified.placeMonopoly,
		targetIndustry: unified.targetIndustry,
		nicheLeadership: unified.nicheLeadership,
		nicheItemToken: unified.nicheItemToken,
		hasNicheItem: unified.hasNicheItem,
		vulnerabilityInsight: buildVulnerabilityInsight({
			leaderName: leader?.name || '',
			leaderShare,
			toBeShare: unified.toBeShare,
			reclaimPotential: unified.reclaimGain,
			targetSiteName: options?.targetSiteName || unified.brandName,
			lang,
		}),
	};
}

export interface ApplyKeywordSovOptions extends CalculateDynamicSovOptions {
	region?: string;
	mainService?: string;
}

/**
 * Rebind the leaderboard 1:1 to the selected keyword.
 * Navigational (brand) queries force rank 1 / 85–95% own share.
 * Generic chips do not inherit a previous brand-query rank.
 */
export function applyKeywordSovToDynamic(
	sov: DynamicSovResult,
	keyword: string,
	options?: ApplyKeywordSovOptions,
): DynamicSovResult {
	const lang = langOf(options?.lang ?? options?.industryConfig?.lang);
	const query = cleanPhrase(keyword).replace(/^#+\s*/, '');
	const brand = cleanPhrase(options?.targetSiteName || sov.brandName);
	const brandTokens = buildTargetBrandTokens(options?.brandAliases ?? [], brand);
	const sameQuery = normalizeSovKeyword(sov.targetQuery) === normalizeSovKeyword(query);
	const intent = classifyQuerySovIntent(query, brandTokens, options?.productTokens);
	const liveClientRank = sov.liveClientRank ?? (sameQuery ? sov.clientRank : CLIENT_UNRANKED_RANK);
	const placeMonopoly = sameQuery && sov.placeMonopoly === true;
	const offeringCorpus = resolveOfferingCorpus(options);
	const niche = resolveNicheOfferingMatch({
		query,
		region: options?.region,
		mainService: options?.mainService,
		productTokens: options?.productTokens,
		offerings: options?.offerings,
		offeringCorpus,
		lang,
	});
	const decomposition = decomposeQueryEntity(query, {
		region: options?.region,
		mainService: options?.mainService,
		productTokens: options?.productTokens,
		brandTokens,
	});
	const clientHoldsEntity =
		niche.hasNicheItem ||
		(decomposition.strictEntityCheck && scoreEntityMatch(offeringCorpus, decomposition.coreEntities).kind !== 'none');
	const nicheLeadership = niche.nicheLeadership || clientHoldsEntity || (sameQuery && sov.nicheLeadership === true);
	const rawPeers = (sov.leaderboard ?? [])
		.filter((row) => !row.isClient && !row.isThirdParty)
		.map((row) => ({ name: row.name, isRealData: row.isRealData }));
	const generic = calculateGenericSoV({
		targetQuery: query,
		candidates: buildGenericSovCandidates({
			names: [brand, ...rawPeers.map((row) => row.name)].filter(Boolean),
			hits: normalizeSovSearchHits(options?.searchHits),
			clientName: brand,
			brandTokens,
			offeringCorpus,
			holdsCoreEntity: clientHoldsEntity,
			aiCitations: options?.aiCitations,
		}),
		region: options?.region,
		mainService: options?.mainService,
		productTokens: options?.productTokens,
		brandTokens,
		decomposition,
	});
	const allocated = intent === 'navigational' || placeMonopoly ? null : allocateGenericSovPie(generic);
	const intentTable = resolveKeywordSovShares(query, {
		brandTokens,
		brandName: brand,
		productTokens: options?.productTokens,
		clientRank: intent === 'navigational' || placeMonopoly || nicheLeadership ? 1 : sameQuery ? liveClientRank : undefined,
		cited: intent === 'specialized' && sameQuery && liveClientRank <= 3,
		placeMonopoly,
		nicheLeadership,
	});
	const shareTable = allocated ? shareTableFromAllocation(allocated, intentTable) : intentTable;
	const clientRank =
		allocated?.clientRank ??
		shareTable.clientRank ??
		(intent === 'navigational' || nicheLeadership ? 1 : sameQuery ? liveClientRank : 4);
	const genericPeers = generic.leaderboard
		.filter((row) => !row.isClient)
		.map((row) => ({
			name: row.name,
			isRealData: rawPeers.some((peer) => listingKey(peer.name) === listingKey(row.name) && peer.isRealData),
		}));
	const peers = allocated
		? genericPeers
		: niche.isNicheQuery
			? [
					...rawPeers.filter((row) => listingMentionsNiche(row.name, niche.nicheItemTokens)),
					...genericSearchDispersionLabels(lang, niche.nicheItemToken).map((name) => ({ name, isRealData: false })),
				]
			: rawPeers;
	const nextRanking = composeIntentLeaderboard({
		clientName: brand || (lang === 'en' ? 'This business' : '자사'),
		clientRank,
		shareTable,
		peers,
		region: cleanPhrase(options?.region),
		lang,
		liveFoundIndex: liveClientRank >= 1 && liveClientRank <= 5 ? liveClientRank - 1 : -1,
	});
	const nextDirectory: LeaderboardItem = {
		rank: 0,
		name: sov.leaderboard?.find((item) => item.isThirdParty)?.name || thirdPartyShareLabel(lang),
		share: shareTable.thirdParty,
		isClient: false,
		isRealData: false,
		isThirdParty: true,
	};
	const leaderboard = [...nextRanking, nextDirectory];
	const asIsShare = nextRanking.find((item) => item.isClient)?.share ?? shareTable.own;
	const toBeShare = shareTable.targetSov;
	const reclaimGain = toBeShare - asIsShare;
	const leader = nextRanking.find((item) => !item.isClient) ?? nextRanking[0];
	const leaderShare = leader?.share ?? shareTable.rank1;
	const region = cleanPhrase(options?.region);
	const service = cleanPhrase(options?.mainService);
	const insightKeyword = query || service || cleanPhrase(sov.targetQuery);
	const lossInsight = nicheLeadership
		? buildNicheLeadershipInsight(region, niche.nicheItemToken || sov.nicheItemToken || '', lang)
		: region || insightKeyword
			? buildUnifiedLossInsight({
					region,
					service: insightKeyword,
					clientRank,
					asIsShare,
					directoryShare: shareTable.thirdParty,
					lang,
				})
			: sov.lossInsight;

	return {
		...sov,
		targetQuery: query || sov.targetQuery,
		asIsShare,
		toBeShare,
		directoryShare: shareTable.thirdParty,
		clientRank,
		liveClientRank,
		queryIntent: shareTable.intent ?? intent,
		gapToLeader: clientRank === 1 ? 0 : Math.max(0, leaderShare - asIsShare),
		reclaimPotential: reclaimGain,
		reclaimGain,
		leaderboard,
		competitors: leaderboard
			.filter((item) => !item.isClient)
			.map((item) => ({
				name: item.name,
				share: item.share,
				isDominant: item.isThirdParty !== true && item.rank === 1 && clientRank !== 1,
				isRealData: item.isRealData,
				isDirectory: item.isThirdParty === true,
			})),
		lossInsight,
		placeMonopoly,
		nicheLeadership,
		nicheItemToken: niche.nicheItemToken || decomposition.coreEntities[0] || sov.nicheItemToken,
		hasNicheItem: niche.hasNicheItem || clientHoldsEntity || (sameQuery && sov.hasNicheItem === true),
		vulnerabilityInsight: buildVulnerabilityInsight({
			leaderName: leader?.name || '',
			leaderShare,
			toBeShare,
			reclaimPotential: reclaimGain,
			targetSiteName: options?.targetSiteName || sov.brandName,
			lang,
		}),
	};
}

/**
 * 검색 결과 리스트에서 자사를 제외하지 않고 1~3위 슬롯에 그대로 둔다.
 * 점유율은 선택된 키워드 테이블을 따르며, `추천` 칩은 27 / 16 / 5 / 52 베이스라인을 유지한다.
 */
export function calculateSymmetricSov(
	clientName: string,
	region: string,
	mainService: string,
	rawSearchResults: readonly string[],
	_geoReadinessScore?: GeoReadinessScore,
	options?: CalculateDynamicSovOptions,
): DynamicSovResult {
	return unifiedToDynamicSov(
		calculateUnifiedMarketSov(clientName, region, mainService, rawSearchResults, options),
		options,
	);
}

/**
 * 통합 시장 리더보드 SoV.
 * `rawSearchResults` 상위 3곳에 자사를 실제 위치 그대로 포함한다.
 */
export function calculateDynamicSov(
	clientName: string,
	region: string,
	mainService: string,
	rawSearchResults: readonly string[],
	geoReadinessScore: GeoReadinessScore,
	options?: CalculateDynamicSovOptions,
): DynamicSovResult {
	return calculateSymmetricSov(clientName, region, mainService, rawSearchResults, geoReadinessScore, options);
}

/** Live Naver Local → Google Places top-5 (client included), then bind rank-symmetric shares. */
export async function resolveDynamicSov(
	clientName: string,
	region: string,
	mainService: string,
	geoReadinessScore: GeoReadinessScore,
	options?: CalculateDynamicSovOptions,
): Promise<DynamicSovResult> {
	const query = cleanPhrase(options?.targetQuery) || buildCompetitorSearchQuery(region, mainService);
	const live = query
		? await resolveLiveCompetitorNames(query, clientName, {
				categoryName: options?.categoryName || mainService,
				mainService,
				region,
				query,
				industryType: options?.industryType || options?.industryConfig?.type,
				schemaTypes: options?.schemaTypes || (options?.industryConfig?.schemaType ? [options.industryConfig.schemaType] : undefined),
			})
		: { names: [] as string[], rankedNames: [] as string[] };
	return calculateSymmetricSov(
		clientName,
		region,
		mainService,
		live.rankedNames.length ? live.rankedNames : live.names,
		geoReadinessScore,
		options,
	);
}

export function sharesToLeaderboard(shares: readonly ShareOfVoiceShare[]): LeaderboardItem[] {
	return shares.map((row) => ({
		rank: row.isDirectory ? 0 : row.rank,
		name: row.name,
		share: row.sharePct,
		isClient: row.isOwn,
		isRealData: row.isRealData === true || row.isOwn,
		isThirdParty: row.isDirectory === true,
	}));
}

export function toDynamicSovResult(sov: ShareOfVoiceResult): DynamicSovResult {
	const own = sov.shares.find((row) => row.isOwn);
	const reclaimPotential = sov.reclaimGain ?? sov.reclaimPotential ?? sov.toBeShare - sov.asIsShare;
	const leaderboard = sov.leaderboard?.length ? sov.leaderboard : sharesToLeaderboard(sov.shares);
	const competitors = sov.shares
		.filter((row) => !row.isOwn)
		.map((row) => ({
			name: row.name,
			share: row.sharePct,
			isDominant: row.isDominant === true || (row.rank === 1 && row.isDirectory !== true && !row.isOwn),
			isRealData: row.isRealData,
			isDirectory: row.isDirectory === true,
		}));
	return {
		targetQuery: sov.targetQuery || '',
		brandName: own?.name || '',
		asIsShare: sov.asIsShare,
		toBeShare: sov.toBeShare,
		directoryShare: sov.directoryShare,
		clientRank: sov.clientRank ?? CLIENT_UNRANKED_RANK,
		liveClientRank: sov.clientRank,
		gapToLeader: sov.gapToLeader,
		reclaimPotential,
		reclaimGain: reclaimPotential,
		leaderboard,
		competitors,
		lossInsight: sov.lossInsight || '',
		vulnerabilityInsight: sov.vulnerabilityInsight || '',
	};
}

/**
 * Unified market leaderboard SoV: client stays in their live 1–3 slot.
 * Percents come from the selected keyword table (`추천` chip keeps 27 / 16 / 5 / 52).
 */
export function computeShareOfVoice(input: ShareOfVoiceInput = {}): ShareOfVoiceResult {
	const lang = langOf(input.lang);
	const config = resolveConfig({
		lang,
		brandName: input.brandName,
		location: input.location,
		type: input.industryType,
		legacyIndustry: input.legacyIndustry,
		title: input.title,
		description: input.description,
		keywords: input.keywords,
	});
	const ownName = cleanPhrase(input.brandName) || config.brandName || (lang === 'en' ? 'This business' : '자사');
	const ranked = toSearchRankList(
		normalizeSovSearchHits(input.searchHits ?? input.rawSearchResults).map((hit) => hit.name),
	);
	const seeded = (input.competitors ?? [])
		.map((c) => ({
			name: cleanCompetitorName(c.name),
			isRealData: c.isRealData === true,
		}))
		.filter((c) => c.name && !isSelfBrandName(c.name, input.brandName || config.brandName));
	const rawForUnified = ranked.length ? ranked : seeded.map((c) => c.name);
	const location = cleanPhrase(input.location) || cleanPhrase(config.location);
	const service =
		cleanPhrase(input.primaryKeyword) || cleanPhrase(config.primaryKeyword) || cleanPhrase(config.defaultCategory);
	const offeringCorpus = resolveOfferingCorpus({
		offeringCorpus:
			input.offeringCorpus ||
			[input.title, input.description, Array.isArray(input.keywords) ? input.keywords.join(' ') : input.keywords]
				.filter(Boolean)
				.join(' '),
		offerings: input.offerings,
		productTokens: input.productTokens,
	});
	const unified = calculateUnifiedMarketSov(ownName, location, service, rawForUnified, {
		lang,
		industryConfig: config,
		categoryName: config.defaultCategory,
		targetQuery: input.targetQuery,
		brandAliases: input.brandAliases,
		productTokens: input.productTokens,
		offerings: input.offerings,
		offeringCorpus,
		searchHits: input.searchHits,
		aiCitations: input.aiCitations,
		industryType: config.type,
		schemaTypes: input.schemaTypes || (config.schemaType ? [config.schemaType] : undefined),
	});
	const ownSharePct = Number.isFinite(input.ownSharePct)
		? clamp(Math.round(Number(input.ownSharePct)), 0, 100)
		: unified.asIsShare;
	const asIsShare = ownSharePct;
	const toBeShare = Number.isFinite(input.ownSharePct) ? calculateUnifiedToBeShare(asIsShare) : unified.toBeShare;
	const reclaimGain = toBeShare - asIsShare;
	const directoryShare =
		unified.leaderboard.find((item) => item.isThirdParty)?.share ?? THIRD_PARTY_SHARE;
	const residual = 100 - asIsShare - directoryShare;
	const tier = regionCompetitionTier(config.location || input.location);
	const concentration = industryConcentration(config.type);
	const regionWeight = tier === 'high' ? 1 : tier === 'mid' ? 0.72 : 0.48;
	const leaderboard = unified.leaderboard.map((item) =>
		item.isClient ? { ...item, share: asIsShare } : item,
	);
	const shares: ShareOfVoiceShare[] = leaderboard.map((item) => ({
		id: item.isThirdParty ? 'directory' : item.isClient ? 'own' : `comp-${item.rank}`,
		name: item.isClient ? ownName : item.name,
		sharePct: item.share,
		isOwn: item.isClient,
		rank: item.isThirdParty ? 0 : item.rank,
		isRealData: item.isRealData,
		isDominant: item.isThirdParty !== true && item.isClient !== true && item.rank === 1 && unified.clientRank !== 1,
		isDirectory: item.isThirdParty === true,
	}));
	const leaderSharePct = Math.max(
		0,
		...shares.filter((row) => !row.isOwn && row.isDirectory !== true).map((row) => row.sharePct),
	);
	const leaderName = shares.find((row) => !row.isOwn && row.isDirectory !== true)?.name || unifiedFallbackName(location, 1, lang);
	const hasRealCompetitorData = leaderboard.some((item) => item.isRealData && !item.isClient && !item.isThirdParty);
	const gapToLeader = unified.clientRank === 1 ? 0 : Math.max(0, leaderSharePct - asIsShare);
	const lossInsight = cleanPhrase(input.lossInsight) || unified.lossInsight;
	const vulnerabilityInsight =
		cleanPhrase(input.vulnerabilityInsight) ||
		buildVulnerabilityInsight({
			leaderName,
			leaderShare: leaderSharePct,
			toBeShare,
			reclaimPotential: reclaimGain,
			targetSiteName: ownName,
			lang,
		});

	return {
		ownSharePct: asIsShare,
		asIsShare,
		clientRank: unified.clientRank,
		toBeShare,
		competitorCount: 2,
		shares,
		totalPct: 100,
		leaderSharePct,
		directoryShare,
		gapPct: gapToLeader,
		gapToLeader,
		reclaimPotential: reclaimGain,
		reclaimGain,
		competitorBlocPct: residual,
		regionWeight,
		industryWeight: concentration,
		regionTier: tier,
		hasRealCompetitorData,
		targetQuery: unified.targetQuery || undefined,
		lossInsight,
		vulnerabilityInsight,
		leaderboard,
	};
}

const BIZ_NO_WEIGHTS = [1, 3, 7, 1, 3, 7, 1, 3, 5] as const;

export function isValidKoreanTaxId(value: string | null | undefined): boolean {
	const digits = (value || '').replace(/\D/g, '');
	if (digits.length !== 10) return false;
	let sum = 0;
	for (let i = 0; i < 9; i += 1) {
		sum += Number(digits[i]) * BIZ_NO_WEIGHTS[i];
	}
	sum += Math.floor((Number(digits[8]) * 5) / 10);
	const check = (10 - (sum % 10)) % 10;
	return check === Number(digits[9]);
}

export function normalizeTaxId(value: string | null | undefined): string {
	return normalizeTaxIdPrecise(value) || cleanPhrase(value);
}

export function extractTaxId(corpus: string): string {
	return extractTaxIdPrecise(corpus);
}

export function extractPlaceCid(value: string | null | undefined): string {
	return extractPlaceCidPrecise(value);
}

function resolveSameAs(input: EntityDisambiguationInput): { count: number; urls: string[] } {
	if (typeof input.sameAs === 'number' && Number.isFinite(input.sameAs)) {
		return { count: Math.max(0, Math.round(input.sameAs)), urls: [] };
	}
	const listed = Array.isArray(input.sameAs) ? input.sameAs : [];
	const corpus = `${input.jsonLdCorpus || ''}\n${input.html || ''}`;
	const official = collectOfficialSameAs(corpus, listed);
	if (official.length) return { count: official.length, urls: official };
	const urls = new Set<string>();
	for (const item of listed) {
		const url = cleanPhrase(item).toLowerCase();
		if (url) urls.add(url.replace(/[.,);]+$/g, ''));
	}
	for (const url of corpus.match(/https?:\/\/[^\s"'\\<>]+/gi) ?? []) {
		if (SOCIAL_SAME_AS.test(url)) urls.add(url.replace(/[.,);]+$/g, '').toLowerCase());
	}
	return { count: urls.size, urls: [...urls] };
}

function detectRepresentativeKg(input: EntityDisambiguationInput): boolean {
	if (input.representativeKgLinked === true) return true;
	if (input.representativeKgLinked === false) return false;
	const corpus = `${input.jsonLdCorpus || ''}\n${input.html || ''}`;
	if (!corpus.trim()) return false;
	return detectPersonKnowledgeGraph(corpus).linked;
}

function sameAsScore(count: number): number {
	if (count <= 0) return 0;
	if (count === 1) return 10;
	if (count === 2) return 18;
	if (count === 3) return 22;
	return ENTITY_DISAMBIGUATION_WEIGHTS.sameAs;
}

/**
 * Entity disambiguation depth (0–100): taxID, Place CID, SNS sameAs, representative KG.
 */
export function computeEntityDisambiguation(input: EntityDisambiguationInput = {}): EntityDisambiguationResult {
	const corpus = `${input.jsonLdCorpus || ''}\n${input.html || ''}`;
	const taxRaw = cleanPhrase(input.taxId) || extractTaxId(corpus);
	const taxValid = isValidKoreanTaxId(taxRaw);
	const taxPresent = Boolean(taxRaw);
	const taxScore = taxValid
		? ENTITY_DISAMBIGUATION_WEIGHTS.taxId
		: taxPresent
			? Math.round(ENTITY_DISAMBIGUATION_WEIGHTS.taxId * 0.35)
			: 0;

	const cid = extractPlaceCid(input.placeCid) || extractPlaceCid(corpus);
	const cidPresent = Boolean(cid);
	const cidScore = cidPresent ? ENTITY_DISAMBIGUATION_WEIGHTS.placeCid : 0;

	const resolvedSameAs = resolveSameAs(input);
	const sameAsCount = resolvedSameAs.count;
	const sameScore = sameAsScore(sameAsCount);

	const kgLinked = detectRepresentativeKg(input);
	const kgScore = kgLinked ? ENTITY_DISAMBIGUATION_WEIGHTS.representativeKg : 0;

	return {
		score: clampScore(taxScore + cidScore + sameScore + kgScore),
		breakdown: {
			taxId: {
				present: taxPresent,
				valid: taxValid,
				value: taxPresent ? normalizeTaxId(taxRaw) : '',
				score: taxScore,
				max: ENTITY_DISAMBIGUATION_WEIGHTS.taxId,
			},
			placeCid: {
				present: cidPresent,
				value: cid,
				score: cidScore,
				max: ENTITY_DISAMBIGUATION_WEIGHTS.placeCid,
			},
			sameAs: {
				present: sameAsCount > 0,
				count: sameAsCount,
				urls: resolvedSameAs.urls,
				score: sameScore,
				max: ENTITY_DISAMBIGUATION_WEIGHTS.sameAs,
			},
			representativeKg: {
				present: kgLinked,
				linked: kgLinked,
				score: kgScore,
				max: ENTITY_DISAMBIGUATION_WEIGHTS.representativeKg,
			},
		},
	};
}

function stripNoiseHtml(html: string): string {
	return html
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
		.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
		.replace(/<!--[\s\S]*?-->/g, '');
}

export function extractVisibleText(html: string | null | undefined): string {
	if (!html) return '';
	return stripNoiseHtml(html)
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|li|h[1-6]|tr|section|article|main)>/gi, '\n')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/\s+/g, ' ')
		.trim();
}

function hasSemanticTag(html: string, tag: 'article' | 'section' | 'main'): boolean {
	const re = new RegExp(`<${tag}\\b`, 'i');
	return re.test(html);
}

/**
 * RAG chunk readability (0–100): text-to-HTML ratio (25%+ recommended) + semantic landmarks.
 */
export function computeRagChunkingScore(input: RagChunkingInput = {}): RagChunkingResult {
	const html = input.html || '';
	const text = cleanPhrase(input.text) || extractVisibleText(html);
	const htmlLength = input.htmlLength && input.htmlLength > 0 ? input.htmlLength : html.length;
	const textLength = input.textLength && input.textLength > 0 ? input.textLength : text.length;
	const ratio = htmlLength > 0 ? textLength / htmlLength : textLength > 0 ? 1 : 0;
	const ratioScore = clampScore((Math.min(ratio, RAG_TEXT_TO_HTML_RECOMMENDED) / RAG_TEXT_TO_HTML_RECOMMENDED) * RAG_CHUNK_WEIGHTS.textToHtml);

	const article = input.hasArticle ?? hasSemanticTag(html, 'article');
	const section = input.hasSection ?? hasSemanticTag(html, 'section');
	const main = input.hasMain ?? hasSemanticTag(html, 'main');
	const semanticScore =
		(article ? SEMANTIC_TAG_POINTS.article : 0) +
		(section ? SEMANTIC_TAG_POINTS.section : 0) +
		(main ? SEMANTIC_TAG_POINTS.main : 0);

	return {
		score: clampScore(ratioScore + semanticScore),
		textToHtmlRatio: Number(ratio.toFixed(4)),
		textToHtmlPct: Number((ratio * 100).toFixed(2)),
		meetsRecommendedRatio: ratio >= RAG_TEXT_TO_HTML_RECOMMENDED,
		ratioScore,
		semantic: { article, section, main, score: semanticScore },
	};
}

function countMatches(text: string, pattern: RegExp): number {
	const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
	return (text.match(new RegExp(pattern.source, flags)) ?? []).length;
}

function tokenize(text: string): string[] {
	return text
		.split(/[\s,./\\|()[\]{}"“”'’:;!?<>]+/)
		.map((t) => t.trim())
		.filter((t) => t.length > 0);
}

/**
 * Information-gain / fact density (0–100): share of quantitative tokens
 * (numbers, units, weekdays, times, price conditions).
 */
export function computeFactDensity(input: FactDensityInput = {}): FactDensityResult {
	const text = cleanPhrase(input.text) || extractVisibleText(input.html);
	const tokens = tokenize(text);
	const categories: FactDensityCategories = {
		numbers: countMatches(text, NUMBER_RE),
		units: countMatches(text, UNIT_RE),
		weekdays: countMatches(text, WEEKDAY_RE),
		times: countMatches(text, TIME_RE),
		priceConditions: countMatches(text, PRICE_CONDITION_RE),
	};
	const quantitativeTokenCount =
		categories.numbers + categories.units + categories.weekdays + categories.times + categories.priceConditions;
	const tokenCount = tokens.length;
	const density = tokenCount > 0 ? quantitativeTokenCount / tokenCount : 0;
	const diversity = Object.values(categories).filter((n) => n > 0).length;
	const densityScore = (Math.min(density, FACT_DENSITY_TARGET) / FACT_DENSITY_TARGET) * 85;
	const diversityScore = diversity * 3;
	return {
		score: clampScore(densityScore + diversityScore),
		tokenCount,
		quantitativeTokenCount,
		densityPct: Number((density * 100).toFixed(2)),
		categories,
	};
}

function formatNapLine(nap: AdvancedGeoNap | undefined, brand: string, lang: AdvancedGeoLang): {
	name: string;
	address: string;
	telephone: string;
} {
	const name = cleanPhrase(nap?.name) || brand;
	const structured = [nap?.streetAddress, nap?.addressLocality, nap?.addressRegion]
		.map(cleanPhrase)
		.filter(Boolean);
	const address =
		structured.length > 0
			? structured.join(' ')
			: cleanPhrase(nap?.address) || (lang === 'en' ? 'Not listed' : '미기재');
	const telephone = cleanPhrase(nap?.telephone) || (lang === 'en' ? 'Not listed' : '미기재');
	return { name, address, telephone };
}

function officialUrl(input: LlmsTxtInput, config: IndustryConfig): string {
	const url = cleanPhrase(input.url) || cleanPhrase(config.url);
	if (url) return url;
	const domain = cleanPhrase(input.domain) || cleanPhrase(config.domain);
	if (!domain) return '';
	return /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
}

/**
 * Standard `/llms.txt` markdown: brand, industry, top 1–5 services, NAP,
 * representative, and core FAQs from the industry registry.
 */
export function buildLlmsTxtContent(input: LlmsTxtInput = {}): string {
	const lang = langOf(input.lang);
	const config = resolveConfig({
		lang,
		brandName: input.brandName,
		location: input.location,
		primaryKeyword: input.primaryKeyword,
		services: input.services,
		url: input.url,
		domain: input.domain,
		type: input.industryType,
		legacyIndustry: input.legacyIndustry,
		title: input.title,
		description: input.description,
		keywords: input.keywords,
	});
	const brand = cleanPhrase(input.brandName) || config.brandName || (lang === 'en' ? 'This business' : '이 업체');
	const location = cleanPhrase(input.location) || config.location;
	const industryLabel = config.profile.label[lang];
	const services = (input.services?.length ? input.services.map(cleanPhrase).filter(Boolean) : config.services).slice(0, 5);
	const ranked = services.length ? services : [config.primaryKeyword || config.defaultCategory];
	const faqs = (
		input.faqs?.length
			? input.faqs
			: config.profile.faqGenerator({
					brandName: brand,
					location,
					primaryKeyword: config.primaryKeyword,
					services: ranked,
					domain: config.domain || input.domain,
					url: officialUrl(input, config),
					lang,
				})
	)
		.filter((faq) => cleanPhrase(faq.question) && cleanPhrase(faq.answer))
		.slice(0, 3);
	const nap = formatNapLine(input.nap, brand, lang);
	const url = officialUrl(input, config);
	const representativeTitle =
		cleanPhrase(input.representativeTitle) || config.representativeTitle || config.personJobTitle;
	const snapshot: SiteDiagnosticResult = {
		brandName: brand,
		description:
			cleanPhrase(input.description) ||
			(lang === 'en'
				? `${industryLabel}${location ? ` in ${location}` : ''}. Official facts for AI crawlers and RAG citation.`
				: `${location ? `${location} ` : ''}${industryLabel} 공식 사실. AI 크롤러·RAG 인용용 /llms.txt.`),
		industry: industryLabel,
		schemaType: config.schemaType,
		representativeTitle,
		representativeName: cleanPhrase(input.representativeName),
		services: ranked,
		address: nap.address === (lang === 'en' ? 'Not listed' : '미기재') ? '' : nap.address,
		telephone: nap.telephone === (lang === 'en' ? 'Not listed' : '미기재') ? '' : nap.telephone,
		url,
		faqs,
		location,
		lang,
	};
	return generateLlmsTxt(snapshot);
}

/** Compose all 2026 GEO metrics from one industry-aware input. */
export function computeAdvancedGeoMetrics(input: AdvancedGeoMetricsInput = {}): AdvancedGeoMetricsReport {
	const industry = resolveConfig({
		lang: input.lang,
		brandName: input.brandName,
		location: input.location,
		primaryKeyword: input.primaryKeyword,
		services: input.services,
		url: input.url,
		domain: input.domain,
		type: input.industryType,
		legacyIndustry: input.legacyIndustry,
		title: input.title,
		description: input.description,
		keywords: input.keywords,
	});
	const entityDisambiguation = computeEntityDisambiguation(input);
	const ragChunking = computeRagChunkingScore(input);
	const geoReadinessScore: GeoReadinessScore = input.geoReadinessScore ?? {
		entityScore: entityDisambiguation.score,
		ragScore: ragChunking.score,
		hasSchema: detectHasSchema(input),
	};
	const shareOfVoice = computeShareOfVoice({ ...input, geoReadinessScore });
	return {
		industry,
		shareOfVoice,
		dynamicSov: toDynamicSovResult(shareOfVoice),
		entityDisambiguation,
		ragChunking,
		factDensity: computeFactDensity(input),
		llmsTxt: buildLlmsTxtContent(input),
	};
}

export {
	allocateGenericSovPie,
	calculateGenericSoV,
	decomposeQueryEntity,
} from '@/lib/audit/generic-sov';
export type { GenericSovInput, GenericSovResult, QueryEntityDecomposition, SovSearchHit } from '@/lib/audit/generic-sov';
export {
	calculateCompetitorSov,
	fetchGoogleCompetitors,
	fetchGoogleSearchRankings,
	fetchNaverCompetitors,
	fetchNaverSearchRankings,
	findClientSearchIndex,
	SOV_LEADER_RESIDUAL_RATIO,
	SOV_RUNNER_RESIDUAL_RATIO,
	THIRD_PARTY_SHARE,
	toSearchRankList,
} from '@/lib/audit/realCompetitors';
export {
	DEFAULT_SOV_SHARE_TABLE,
	SOV_SAMPLE_DATA,
	classifySovQueryIntent,
	normalizeSovKeyword,
	resolveKeywordSovItem,
	resolveKeywordSovShares,
} from '@/lib/audit/sovLeaderboardData';
export type { SovLeaderboardItem, SovShareTable } from '@/lib/audit/sovLeaderboardData';
export {
	validateSovLeaderboardData,
	logSovValidationResult,
	SOV_VALIDATION_PASS_MESSAGE,
} from '@/lib/audit/sovDiagnosticValidation';
export { detectIndustry, getIndustryProfile, resolveIndustryConfig };
export type { FaqItem, IndustryConfig, IndustryType };
export { extractSiteDiagnostic, generateLlmsTxt } from '@/lib/audit/llms-txt';
export type { SiteDiagnosticResult } from '@/lib/audit/llms-txt';
