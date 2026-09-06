/**
 * Universal Share-of-Voice (SoV) diagnostic model.
 *
 * Replaces the legacy live-search / navigational-query pipeline for the
 * "통합 시장 랭킹 리더보드 (SoV)" card with a single functional interface —
 * `generateSoVAnalysis(siteData)` — that is completely free of any
 * site-specific hardcoding.
 *
 * Why this model exists:
 *  - The audited brand's own name must never be used as the diagnostic
 *    query. A branded/navigational search always shows the official site in
 *    #1, which inflated "own share" to ~90% and made the deficiency
 *    narrative meaningless. Instead, this module derives the site's
 *    industry + region from crawl metadata (title / description / schema /
 *    NAP) and builds **generic, exploratory** queries a real consumer would
 *    type (`[region] + [category] + recommend`), never the brand name.
 *  - A site that has not been optimized for AI answer engines realistically
 *    is not cited on those generic queries. The diagnostic therefore always
 *    reports a small but honest current share (3–12%) against a realistic
 *    GEO-prescription recapture target (60–75%), rather than leaking
 *    internal fallback/debug strings ("일반 검색 분산", "미확인 노출") into
 *    the competitor labels.
 *
 * `generateSoVAnalysis` is pure and synchronous — no network / live search
 * call is required, so switching the diagnostic query in the UI is instant.
 */

import { generateQueryMatrix, type SiteAuditData } from '@/lib/geo/query-matrix';
import { composeSearchQuery } from '@/lib/geo/search-query-normalize';
import {
	detectIndustry,
	INDUSTRY_TYPES,
	resolveIndustryConfig,
	type IndustryType,
} from '@/lib/registry/universalIndustryRegistry';
import type { AuditReport } from '@/lib/site-auditor';

export type SovLang = 'ko' | 'en';

/** The four universal business buckets from the diagnostic query spec. */
export type SovIndustryCategory = 'medical' | 'legal' | 'local' | 'business';

export type SovLeaderboardRole = 'competitor' | 'viral' | 'directory' | 'own';

/** Query-slot intent — index 0 broad, 1 specialty, 2 problem-solving. */
export type SovQueryIntent = 'broad' | 'specialty' | 'problem';

export interface SovSiteData extends SiteAuditData {
	/** Registry vertical hint, e.g. `siteMeta.industryType`. */
	industryType?: IndustryType | string | null;
	/** Legacy string industry hint (admin tools, older crawls). */
	legacyIndustry?: string | null;
	/** Free-text meta description, kept distinct from `metaDescription` for callers that only have one. */
	description?: string | null;
	url?: string | null;
	/** Explicit override for the currently-selected diagnostic query (chip / custom search). */
	targetQuery?: string;
	/**
	 * Optional 1–3 user-supplied keywords parsed from the diagnostic form.
	 * When present, these take priority over the auto-generated queries —
	 * each keyword is recomposed as `[region] + [keyword] + recommend/best`,
	 * and any remaining slots (up to 3 total) fall back to auto-generated queries.
	 */
	customKeywords?: readonly string[];
}

export interface SovLeaderboardEntry {
	/** 1–3 for the standardized ranking slots, 0 for the unranked own-brand row. */
	rank: number;
	name: string;
	share: number;
	role: SovLeaderboardRole;
	isClient: boolean;
	/** Only set for the own-brand row — "순위권 밖 · 인용 누락". */
	statusLabel?: string;
	/** One-line LLM recommendation reason, when the row came from a live engine. */
	reason?: string;
}

export interface SovTargetSite {
	brandName: string;
	region: string;
	category: string;
}

export interface SovQuerySlice {
	index: number;
	query: string;
	intent: SovQueryIntent;
	currentSov: number;
	targetSov: number;
	reclaimPotential: number;
	competitorBloc: number;
	leaderboard: SovLeaderboardEntry[];
	ownGoalLabel: string;
	summary: string;
	/** 1–3 when the brand appeared in the live recommendation list, else 0. */
	ownRank?: 0 | 1 | 2 | 3;
	/** Live placement band used to pick the SoV / briefing template. */
	placement?: 'first' | 'mentioned' | 'missing';
	/** 2–3 sentence raw AI recommendation text used as citation evidence. */
	recommendationSnippet?: string;
}

export interface GenerateDynamicSovDataInput {
	queries: readonly string[];
	brandName: string;
	region?: string | null;
	category?: string | null;
	lang?: SovLang | string | null;
	/** Stable site identity (url/domain/brand) so the same URL always yields the same band samples. */
	identityKey?: string | null;
	selectedQueryIndex?: number;
}

export interface SovAnalysisResult {
	brandName: string;
	region: string;
	category: string;
	industry: SovIndustryCategory;
	industryLabel: string;
	targetSite: SovTargetSite;
	/**
	 * Dynamic Top-3 query set currently on display — either fully
	 * auto-generated, or a mix of user-custom keywords (priority) padded
	 * with auto-generated fallbacks so the set always has 3 entries.
	 * Always re-derive the UI from this array; never assume a fixed
	 * query1/query2/query3 shape.
	 */
	analyzedQueries: string[];
	/** The original brand-name-free, industry/region-aware auto-generated queries (fallback pool). */
	autoQueries: string[];
	/** Per-query differentiated SoV / competitor slices — one entry per `analyzedQueries` item. */
	querySlices: SovQuerySlice[];
	/** Currently selected tab index into `analyzedQueries` / `querySlices`. */
	selectedQueryIndex: number;
	/** Intent of the selected query slot (broad / specialty / problem). */
	queryIntent: SovQueryIntent;
	/** 'custom' once at least one user keyword has been applied via `applySovCustomKeywords`. */
	queryMode: 'auto' | 'custom';
	/** Currently active/selected query (defaults to `analyzedQueries[selectedQueryIndex]`). */
	targetQuery: string;
	/** 현재 실측 SoV — band depends on the selected query index. */
	currentSov: number;
	/** GEO 처방 목표 SoV — band depends on the selected query index. */
	targetSov: number;
	/** targetSov − currentSov. */
	reclaimPotential: number;
	/** 100 − currentSov — 경쟁사·3자 채널로 분산된 트래픽 합. */
	competitorBloc: number;
	/** Rank 1–3 standardized competitor rows + the unranked own-brand row. */
	leaderboard: SovLeaderboardEntry[];
	/** "1위 진입 목표 (~72% 독점 점유)" style headline for the To-Be goal. */
	ownGoalLabel: string;
	/** Full dynamic briefing paragraph for the bottom insight box. */
	summary: string;
	/** Deterministic identity used to re-sample slices after custom-keyword rebuilds. */
	identityKey: string;
	lang: SovLang;
	/** True once `/api/diagnose/sov-analysis` has overlaid live LLM slices. */
	liveMeasured?: boolean;
	liveProvider?: string;
	liveCached?: boolean;
	ownRank?: 0 | 1 | 2 | 3;
	placement?: 'first' | 'mentioned' | 'missing';
	recommendationSnippet?: string;
	/** True when live LLM failed and the guide/estimate slices are on screen. */
	liveDegraded?: boolean;
}

const MEDICAL_TYPES = new Set<IndustryType>(['medical', 'veterinary']);
const LEGAL_TYPES = new Set<IndustryType>(['legal', 'accounting']);
const LOCAL_TYPES = new Set<IndustryType>(['beauty', 'restaurant', 'fitness', 'interior', 'realestate', 'education']);

const INDUSTRY_CATEGORY_LABEL: Record<SovIndustryCategory, { ko: string; en: string }> = {
	medical: { ko: '의료 · 병·의원', en: 'Medical / Clinic' },
	legal: { ko: '법률 · 세무 · 노무', en: 'Legal / Tax / Labor' },
	local: { ko: '로컬 매장 · 뷰티 · 외식', en: 'Local Store / Beauty / Dining' },
	business: { ko: '일반 기업 · B2B · 쇼핑몰', en: 'Business / B2B / Commerce' },
};

function clean(value: unknown, max = 80): string {
	if (typeof value !== 'string') return '';
	return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function fold(value: unknown): string {
	return clean(value).replace(/\s+/g, '').toLowerCase();
}

function langOf(lang?: string | null): SovLang {
	return lang === 'en' ? 'en' : 'ko';
}

/** FNV-1a string hash — stable across renders/requests for the same input. */
function hashSeed(input: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i += 1) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

/** mulberry32 — small, deterministic PRNG seeded from the site identity. */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0 || 1;
	return function next() {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function randInt(rand: () => number, min: number, max: number): number {
	return min + Math.floor(rand() * (max - min + 1));
}

function normalizeIndustryTypeHint(raw?: string | null): IndustryType | undefined {
	const value = clean(raw);
	if (!value) return undefined;
	const direct = INDUSTRY_TYPES.find((type) => type === value || fold(type) === fold(value));
	if (direct) return direct;
	if (/동물|반려|veterinary|vet\b|펫\s*병원/i.test(value)) return 'veterinary';
	if (/의료|병원|의원|피부과|치과|한의원|clinic|medical|dermat|dental/i.test(value)) return 'medical';
	if (/법률|변호사|법무|legal|law\s*firm/i.test(value)) return 'legal';
	if (/세무|노무|회계|accounting|tax|cpa/i.test(value)) return 'accounting';
	if (/미용|헤어|뷰티|피부관리|네일|salon|beauty/i.test(value)) return 'beauty';
	if (/외식|맛집|카페|레스토랑|restaurant|cafe|dining/i.test(value)) return 'restaurant';
	if (/피트니스|헬스|짐|필라테스|fitness|gym|pilates/i.test(value)) return 'fitness';
	if (/인테리어|리모델링|시공|interior|remodeling/i.test(value)) return 'interior';
	if (/부동산|공인중개|realestate|real\s*estate/i.test(value)) return 'realestate';
	if (/학원|교육|academy|education|tutoring/i.test(value)) return 'education';
	if (/쇼핑몰|커머스|이커머스|b2b|saas|소프트웨어|제조|유통|commerce|software/i.test(value)) return 'professional';
	return undefined;
}

function mapIndustryTypeToCategory(type: IndustryType, hasRegion: boolean): SovIndustryCategory {
	if (MEDICAL_TYPES.has(type)) return 'medical';
	if (LEGAL_TYPES.has(type)) return 'legal';
	if (LOCAL_TYPES.has(type)) return 'local';
	// 'professional' / 'general' — ambiguous verticals. A detected region means
	// this is most likely a local service business; otherwise treat it as a
	// location-agnostic B2B / commerce site (per the diagnostic query spec).
	return hasRegion ? 'local' : 'business';
}

/** Strip the leading honorific (대표/Lead/Managing/Chief …) to get the bare professional noun. */
function professionalNounFromTitle(title: string, lang: SovLang): string {
	const stripped = clean(title).replace(/^(대표|Lead\s+|Managing\s+|Chief\s+)/i, '').trim();
	if (stripped) return stripped;
	return lang === 'en' ? 'specialist' : '전문가';
}

function pickDistinctNoun(nouns: readonly string[], exclude: readonly string[]): string {
	const excludedKeys = exclude.map(fold);
	return nouns.find((noun) => !excludedKeys.includes(fold(noun))) || '';
}

function uniqueTriple(candidates: readonly string[], filler: () => string): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const candidate of candidates) {
		const value = clean(candidate, 80);
		const key = fold(value);
		if (!value || seen.has(key)) continue;
		seen.add(key);
		out.push(value);
		if (out.length >= 3) break;
	}
	let guard = 0;
	while (out.length < 3 && guard < 5) {
		const value = clean(filler(), 80);
		const key = fold(value);
		if (value && !seen.has(key)) {
			seen.add(key);
			out.push(value);
		}
		guard += 1;
	}
	return out.length ? out : [''];
}

/**
 * Merge a priority list (e.g. user keyword queries) with a fallback pool
 * (e.g. auto-generated queries), de-duplicating and capping at `limit`.
 * Used to guarantee the diagnostic query set always has exactly 3 entries
 * even when the user supplies only 1–2 custom keywords.
 */
function mergeQueriesWithFallback(primary: readonly string[], fallback: readonly string[], limit = 3): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	const push = (candidate: unknown) => {
		if (out.length >= limit) return;
		const value = clean(candidate, 80);
		const key = fold(value);
		if (!value || seen.has(key)) return;
		seen.add(key);
		out.push(value);
	};
	primary.forEach(push);
	fallback.forEach(push);
	return out;
}

/**
 * Parse a raw custom-keyword input string into 1–3 clean tokens.
 * Accepts comma/slash/newline-separated keywords, or falls back to
 * whitespace-splitting when the user typed space-separated words instead.
 */
export function parseSovCustomKeywords(input: string): string[] {
	const raw = clean(input, 200);
	if (!raw) return [];
	const parts = /[,\n/、，]/.test(raw) ? raw.split(/[,\n/、，]+/) : raw.split(/\s+/);
	const out: string[] = [];
	const seen = new Set<string>();
	for (const part of parts) {
		const value = clean(part, 40);
		const key = fold(value);
		if (!value || seen.has(key)) continue;
		seen.add(key);
		out.push(value);
		if (out.length >= 3) break;
	}
	return out;
}

/** Recompose user keywords into `[지역] + [키워드] + 추천/잘하는 곳` diagnostic queries. */
function buildCustomKeywordQueries(input: { region: string; lang: SovLang; keywords: readonly string[] }): string[] {
	const { region, lang, keywords } = input;
	const recommend = lang === 'en' ? 'recommended' : '추천';
	const best = lang === 'en' ? 'best' : '잘하는 곳';
	const intents = [recommend, best, recommend];
	return keywords
		.slice(0, 3)
		.map((keyword, idx) =>
			composeSearchQuery([region, keyword], { trailingIntent: intents[idx % intents.length], maxTokens: 6 }),
		)
		.map((query) => clean(query, 80))
		.filter(Boolean);
}

interface QueryBuildInput {
	industry: SovIndustryCategory;
	industryType: IndustryType;
	lang: SovLang;
	region: string;
	industryNoun: string;
	specialty1: string;
	specialty2: string;
	professionalNoun: string;
	subService: string;
}

function buildQueries(input: QueryBuildInput): string[] {
	const { industry, lang, region, industryNoun, specialty1, specialty2, professionalNoun, subService } = input;
	const recommend = lang === 'en' ? 'recommended' : '추천';
	const best = lang === 'en' ? 'best' : '잘하는 곳';

	if (industry === 'medical') {
		const q1 = composeSearchQuery([region, industryNoun], { trailingIntent: recommend, maxTokens: 5 });
		const q2 = composeSearchQuery([region, specialty1], { trailingIntent: best, maxTokens: 5 });
		const q3 =
			lang === 'en'
				? composeSearchQuery([region, specialty2 || specialty1, 'treatment'], { maxTokens: 5 })
				: composeSearchQuery([region, specialty2 || specialty1, '시술'], { maxTokens: 5 });
		return uniqueTriple([q1, q2, q3], () =>
			composeSearchQuery([region, industryNoun], { trailingIntent: lang === 'en' ? 'consult' : '상담', maxTokens: 5 }),
		);
	}

	if (industry === 'legal') {
		const q1 =
			lang === 'en'
				? composeSearchQuery([region, specialty1, professionalNoun, recommend], { maxTokens: 6 })
				: composeSearchQuery([region, specialty1, '전문', professionalNoun, recommend], { maxTokens: 6 });
		const q2 =
			lang === 'en'
				? composeSearchQuery([region, subService, 'consultation', best], { maxTokens: 5 })
				: composeSearchQuery([region, subService, '상담', best], { maxTokens: 5 });
		const q3 = composeSearchQuery([region, professionalNoun], { trailingIntent: best, maxTokens: 5 });
		return uniqueTriple([q1, q2, q3], () => composeSearchQuery([region, professionalNoun], { trailingIntent: recommend, maxTokens: 5 }));
	}

	if (industry === 'local') {
		const q1 = composeSearchQuery([region, industryNoun], { trailingIntent: recommend, maxTokens: 5 });
		const q2 =
			lang === 'en'
				? composeSearchQuery([region, specialty1, 'booking review'], { maxTokens: 5 })
				: composeSearchQuery([region, specialty1, '예약 후기'], { maxTokens: 5 });
		const q3 = composeSearchQuery([region, industryNoun], { trailingIntent: best, maxTokens: 5 });
		return uniqueTriple([q1, q2, q3], () =>
			composeSearchQuery([region, specialty2 || specialty1], { trailingIntent: recommend, maxTokens: 5 }),
		);
	}

	// business — location-agnostic (대표 제품군/서비스 · 핵심 솔루션 도입 비교).
	const mainProduct = industryNoun;
	const coreSolution = specialty1 || subService || mainProduct;
	const q1 =
		lang === 'en' ? composeSearchQuery([mainProduct, 'recommended brand'], { maxTokens: 5 }) : composeSearchQuery([mainProduct, '추천 브랜드'], { maxTokens: 5 });
	const q2 =
		lang === 'en'
			? composeSearchQuery([coreSolution, 'implementation comparison'], { maxTokens: 5 })
			: composeSearchQuery([coreSolution, '도입 비교'], { maxTokens: 5 });
	const q3 =
		lang === 'en' ? composeSearchQuery([mainProduct, 'reviews comparison'], { maxTokens: 5 }) : composeSearchQuery([mainProduct, '후기 비교'], { maxTokens: 5 });
	return uniqueTriple([q1, q2, q3], () => (lang === 'en' ? `${mainProduct} vendor comparison` : `${mainProduct} 업체 비교`));
}

const QUERY_INTENTS: readonly SovQueryIntent[] = ['broad', 'specialty', 'problem'];

interface SovIntentBand {
	own: readonly [number, number];
	target: readonly [number, number];
	rank1: readonly [number, number];
	rank2: readonly [number, number];
	rank3: readonly [number, number];
	labels: { ko: readonly [string, string, string]; en: readonly [string, string, string] };
	ownStatus: { ko: string; en: string };
}

const SOV_INTENT_BANDS: Record<SovQueryIntent, SovIntentBand> = {
	broad: {
		own: [3, 6],
		target: [65, 70],
		rank1: [40, 45],
		rank2: [30, 35],
		rank3: [15, 20],
		labels: {
			ko: ['동일 상권 내 상위 브랜드', '3자 포털 블로그·카페 리뷰 분산', '지역 플랫폼 디렉토리'],
			en: ['Top brand in the same trade area', 'Third-party portal blog & cafe review leakage', 'Local platform directories'],
		},
		ownStatus: { ko: '순위권 밖 · 인용 누락', en: 'Outside ranking · citation gap' },
	},
	specialty: {
		own: [10, 15],
		target: [75, 80],
		rank1: [35, 40],
		rank2: [25, 30],
		rank3: [15, 20],
		labels: {
			ko: ['전문 키워드 선점 경쟁사', '소비자 체험단/체험 후기 분산', '커뮤니티 Q&A 포럼'],
			en: ['Specialty-keyword incumbent', 'Consumer trial-review leakage', 'Community Q&A forums'],
		},
		ownStatus: { ko: '순위권 밖 · 특화 키워드 기회', en: 'Outside ranking · specialty opportunity' },
	},
	problem: {
		own: [5, 8],
		target: [70, 75],
		rank1: [35, 40],
		rank2: [25, 30],
		rank3: [20, 25],
		labels: {
			ko: ['정보성 바이럴 콘텐츠 출처', '인접 지역 전문 업체 노출', '포털 지식 검색 질의응답'],
			en: ['Informational viral content sources', 'Nearby specialist listings', 'Portal knowledge Q&A'],
		},
		ownStatus: { ko: '순위권 밖 · 정보성 검색 분산', en: 'Outside ranking · informational leakage' },
	},
};

function intentOfIndex(index: number): SovQueryIntent {
	return QUERY_INTENTS[Math.min(Math.max(index, 0), QUERY_INTENTS.length - 1)] ?? 'broad';
}

function scaleCompetitorShares(raw: readonly [number, number, number], remaining: number): [number, number, number] {
	const total = raw[0] + raw[1] + raw[2] || 1;
	const scaled = raw.map((value) => Math.round((value / total) * remaining)) as [number, number, number];
	scaled[0] = Math.max(0, scaled[0] + (remaining - scaled.reduce((sum, value) => sum + value, 0)));
	return scaled;
}

function buildGoalLabel(lang: SovLang, targetSov: number): string {
	return lang === 'en' ? `Target: reach #1 (~${targetSov}% share)` : `1위 진입 목표 (${targetSov}% 독점 점유)`;
}

function buildSummary(input: {
	lang: SovLang;
	region: string;
	category: string;
	targetQuery: string;
	currentSov: number;
	targetSov: number;
	competitorBloc: number;
}): string {
	const { lang, region, category, targetQuery, currentSov, targetSov, competitorBloc } = input;
	if (lang === 'en') {
		const place = region ? `${region} ` : '';
		const vertical = category ? `${category} ` : '';
		return `In the ${place}${vertical}AI search market for the core query "${targetQuery}", your current AI citation share is only about ${currentSov}%. Most of the traffic (${competitorBloc}%+) is leaking to competitors and third-party portal/blog reviews. Applying REDUE AI's technical schema and entity prescriptions first can recover citations lost to non-standard data, targeting up to ${targetSov}% AI search share.`;
	}
	const scope = region
		? category
			? `${region} 지역 ${category} 핵심 질의인`
			: `${region} 지역 핵심 질의인`
		: category
			? `${category} 핵심 질의인`
			: '핵심 질의인';
	return `${scope} '${targetQuery}' AI 검색 시장에서 자사의 현재 AI 인용 점유율은 약 ${currentSov}% 수준에 불과합니다. 트래픽의 대부분(${competitorBloc}% 이상)이 경쟁 업체 및 3자 포털 블로그 리뷰로 분산 이탈되고 있습니다. REDUE AI의 기술 스키마 및 엔티티 처방을 선제 적용할 경우, 비표준 데이터로 인한 AI 인용 누락을 복구하여 최대 ${targetSov}% 수준의 AI 검색 점유율 탈환을 목표로 최적화할 수 있습니다.`;
}

function buildSliceFromBand(input: {
	index: number;
	query: string;
	intent: SovQueryIntent;
	rand: () => number;
	brandName: string;
	region: string;
	category: string;
	lang: SovLang;
}): SovQuerySlice {
	const { index, query, intent, rand, brandName, region, category, lang } = input;
	const band = SOV_INTENT_BANDS[intent];
	const currentSov = randInt(rand, band.own[0], band.own[1]);
	const targetSov = randInt(rand, band.target[0], band.target[1]);
	const reclaimPotential = targetSov - currentSov;
	const competitorBloc = 100 - currentSov;
	const scaled = scaleCompetitorShares(
		[randInt(rand, band.rank1[0], band.rank1[1]), randInt(rand, band.rank2[0], band.rank2[1]), randInt(rand, band.rank3[0], band.rank3[1])],
		competitorBloc,
	);
	const labels = band.labels[lang];
	const leaderboard: SovLeaderboardEntry[] = [
		{ rank: 1, name: labels[0], share: scaled[0], role: 'competitor', isClient: false },
		{ rank: 2, name: labels[1], share: scaled[1], role: 'viral', isClient: false },
		{ rank: 3, name: labels[2], share: scaled[2], role: 'directory', isClient: false },
		{ rank: 0, name: brandName, share: currentSov, role: 'own', isClient: true, statusLabel: band.ownStatus[lang] },
	];
	return {
		index,
		query,
		intent,
		currentSov,
		targetSov,
		reclaimPotential,
		competitorBloc,
		leaderboard,
		ownGoalLabel: buildGoalLabel(lang, targetSov),
		summary: buildSummary({ lang, region, category, targetQuery: query, currentSov, targetSov, competitorBloc }),
	};
}

/**
 * Public Dynamic Query SoV generator — takes the live `queries` array
 * (never a hardcoded mock set) and returns one differentiated slice per
 * index. Index 0/1/2 use distinct share bands and generic competitor roles;
 * no brand, region, or specialty proper noun is baked into the labels.
 */
export function generateDynamicSovData(input: GenerateDynamicSovDataInput): SovQuerySlice[] {
	const lang = langOf(input.lang);
	const brandName = clean(input.brandName) || (lang === 'en' ? 'This business' : '자사');
	const region = clean(input.region);
	const category = clean(input.category);
	const queries = (input.queries ?? []).map((query) => clean(query, 80)).filter(Boolean);
	const identity = clean(input.identityKey) || [brandName, region, category].map(fold).join('|');

	return queries.map((query, index) => {
		const intent = intentOfIndex(index);
		const rand = mulberry32(hashSeed([identity, String(index), fold(query), intent].join('|')));
		return buildSliceFromBand({ index, query, intent, rand, brandName, region, category, lang });
	});
}

function clampQueryIndex(index: number | undefined, length: number): number {
	if (!length) return 0;
	if (!Number.isFinite(index)) return 0;
	return Math.min(Math.max(Math.trunc(index as number), 0), length - 1);
}

function overlaySlice(analysis: SovAnalysisResult, slice: SovQuerySlice): SovAnalysisResult {
	return {
		...analysis,
		selectedQueryIndex: slice.index,
		queryIntent: slice.intent,
		targetQuery: slice.query,
		currentSov: slice.currentSov,
		targetSov: slice.targetSov,
		reclaimPotential: slice.reclaimPotential,
		competitorBloc: slice.competitorBloc,
		leaderboard: slice.leaderboard,
		ownGoalLabel: slice.ownGoalLabel,
		summary: slice.summary,
		ownRank: slice.ownRank,
		placement: slice.placement,
		recommendationSnippet: slice.recommendationSnippet,
	};
}

/**
 * Single functional entrypoint — derives industry + region from crawl
 * metadata, generates three brand-name-free exploratory queries, then
 * `generateDynamicSovData` builds one differentiated slice per query index
 * (broad / specialty / problem) so the three tabs never share the same numbers.
 */
export function generateSoVAnalysis(siteData: SovSiteData = {}): SovAnalysisResult {
	const lang = langOf(siteData.lang);
	const matrix = generateQueryMatrix(siteData);
	const slots = matrix.slots;

	const brandName = clean(siteData.brandName) || clean(slots.brandName) || (lang === 'en' ? 'This business' : '자사');
	const region = clean(slots.location);
	const hasRegion = region.length > 0;

	const explicitType =
		normalizeIndustryTypeHint(typeof siteData.industryType === 'string' ? siteData.industryType : undefined) ||
		normalizeIndustryTypeHint(siteData.legacyIndustry) ||
		normalizeIndustryTypeHint(siteData.category);
	const detectedType =
		explicitType ||
		detectIndustry({
			title: siteData.title || brandName,
			description: siteData.description || siteData.metaDescription || siteData.ogDescription,
			keywords: siteData.metaKeywords || (siteData.detectedKeywords ?? []).join(' '),
			extraText: [
				siteData.category,
				siteData.primaryKeyword,
				...(siteData.coreSpecialties ?? []),
				...(siteData.schemaTypes ?? []),
				...(siteData.schemaEntityTypes ?? []),
			]
				.filter(Boolean)
				.join(' '),
		});
	const industry = mapIndustryTypeToCategory(detectedType, hasRegion);
	const industryLabel = INDUSTRY_CATEGORY_LABEL[industry][lang];

	const config = resolveIndustryConfig({
		lang,
		type: detectedType,
		brandName,
		location: region,
		primaryKeyword: siteData.primaryKeyword,
		services: siteData.coreSpecialties,
	});

	const nouns = slots.categoryNouns;
	const industryNoun = clean(slots.industryNoun) || nouns[0] || config.mainService || config.defaultCategory;
	const specialty1 = pickDistinctNoun(nouns, [industryNoun]) || config.subService || industryNoun;
	const specialty2 = pickDistinctNoun(nouns, [industryNoun, specialty1]) || specialty1;
	const professionalNoun = professionalNounFromTitle(config.representativeTitle, lang);

	const autoQueries = buildQueries({
		industry,
		industryType: detectedType,
		lang,
		region,
		industryNoun,
		specialty1,
		specialty2,
		professionalNoun,
		subService: config.subService,
	});

	const customKeywords = (siteData.customKeywords ?? []).map((kw) => clean(kw, 40)).filter(Boolean).slice(0, 3);
	const hasCustomKeywords = customKeywords.length > 0;
	const analyzedQueries = hasCustomKeywords
		? mergeQueriesWithFallback(buildCustomKeywordQueries({ region, lang, keywords: customKeywords }), autoQueries)
		: autoQueries;
	const queryMode: 'auto' | 'custom' = hasCustomKeywords ? 'custom' : 'auto';
	const category = industryNoun || industryLabel;
	const identityKey = [brandName, siteData.domain || siteData.url || '', region, category, industry].map(fold).join('|');
	const querySlices = generateDynamicSovData({
		queries: analyzedQueries,
		brandName,
		region,
		category,
		lang,
		identityKey,
	});
	const selectedQueryIndex = clampQueryIndex(
		siteData.targetQuery
			? analyzedQueries.findIndex((query) => fold(query) === fold(siteData.targetQuery))
			: 0,
		querySlices.length,
	);
	const selected = querySlices[selectedQueryIndex] ?? querySlices[0];
	const targetSite: SovTargetSite = { brandName, region, category };

	return {
		brandName,
		region,
		category,
		industry,
		industryLabel,
		targetSite,
		analyzedQueries,
		autoQueries,
		querySlices,
		selectedQueryIndex,
		queryIntent: selected?.intent ?? 'broad',
		queryMode,
		targetQuery: selected?.query || analyzedQueries[0] || autoQueries[0] || '',
		currentSov: selected?.currentSov ?? 0,
		targetSov: selected?.targetSov ?? 0,
		reclaimPotential: selected?.reclaimPotential ?? 0,
		competitorBloc: selected?.competitorBloc ?? 100,
		leaderboard: selected?.leaderboard ?? [],
		ownGoalLabel: selected?.ownGoalLabel ?? buildGoalLabel(lang, selected?.targetSov ?? 0),
		summary: selected?.summary ?? '',
		identityKey,
		lang,
	};
}

/**
 * Bind the displayed SoV gauges / leaderboard / summary to a query tab index.
 * Looks up the precomputed slice so index 0 / 1 / 2 never share the same numbers.
 */
export function applySovQueryIndex(analysis: SovAnalysisResult, index: number): SovAnalysisResult {
	const selectedQueryIndex = clampQueryIndex(index, analysis.querySlices.length);
	const slice = analysis.querySlices[selectedQueryIndex];
	if (!slice) return analysis;
	if (analysis.selectedQueryIndex === selectedQueryIndex && analysis.targetQuery === slice.query) return analysis;
	return overlaySlice(analysis, slice);
}

/**
 * Re-point the analysis at a newly selected query chip.
 * Resolves the chip text back to its index, then applies that slice
 * (differentiated shares + competitor labels + summary).
 */
export function applySovTargetQuery(analysis: SovAnalysisResult, query: string): SovAnalysisResult {
	const targetQuery = clean(query);
	if (!targetQuery) return analysis;
	const index = analysis.analyzedQueries.findIndex((item) => fold(item) === fold(targetQuery));
	if (index < 0) return analysis;
	return applySovQueryIndex(analysis, index);
}

/**
 * Re-derive the dynamic Top-3 query set from 1–3 user-supplied keywords.
 *
 * Each keyword is recomposed as `[지역] + [키워드] + 추천/잘하는 곳`, taking
 * priority over the auto-generated queries. If the user supplies fewer than
 * 3 keywords (or none), the remaining slots are backfilled from
 * `analysis.autoQueries` so the diagnostic set always has exactly 3 entries.
 * Passing an empty array reverts fully to the auto-generated query set.
 *
 * Pure and synchronous — rebuilds the per-index SoV slices for the new
 * query set, then binds the UI to index 0.
 */
export function applySovCustomKeywords(analysis: SovAnalysisResult, rawKeywords: readonly string[]): SovAnalysisResult {
	const keywords = rawKeywords.map((kw) => clean(kw, 40)).filter(Boolean).slice(0, 3);
	const analyzedQueries = keywords.length
		? mergeQueriesWithFallback(
				buildCustomKeywordQueries({ region: analysis.region, lang: analysis.lang, keywords }),
				analysis.autoQueries,
			)
		: analysis.autoQueries;
	const queryMode: 'auto' | 'custom' = keywords.length ? 'custom' : 'auto';

	if (analysis.queryMode === queryMode && analyzedQueries.join('|') === analysis.analyzedQueries.join('|')) {
		return applySovQueryIndex(analysis, 0);
	}

	const querySlices = generateDynamicSovData({
		queries: analyzedQueries,
		brandName: analysis.brandName,
		region: analysis.region,
		category: analysis.category,
		lang: analysis.lang,
		identityKey: analysis.identityKey,
	});

	return applySovQueryIndex(
		{
			...analysis,
			analyzedQueries,
			querySlices,
			queryMode,
		},
		0,
	);
}

/** Flatten a crawled `AuditReport` into the `SovSiteData` shape (no per-site hardcoding). */
export function sovSiteDataFromReport(
	report: Pick<AuditReport, 'url' | 'lang' | 'siteMeta' | 'metrics' | 'detectedKeywords'>,
): SovSiteData {
	const meta = report.siteMeta;
	const metrics = report.metrics;
	return {
		lang: report.lang === 'en' ? 'en' : 'ko',
		brandName: meta?.brandName,
		domain: meta?.domain,
		url: report.url || meta?.targetUrl,
		industryType: meta?.industryType,
		category: meta?.category,
		primaryKeyword: meta?.primaryKeyword,
		location: meta?.location,
		broadLocation: meta?.broadLocation,
		coreSpecialties: meta?.coreSpecialties,
		detectedKeywords: meta?.detectedKeywords ?? report.detectedKeywords,
		schemaKnowsAbout: meta?.schemaKnowsAbout,
		schemaEntityTypes: meta?.schemaEntityTypes ?? metrics?.schemaTypes,
		schemaTypes: metrics?.schemaTypes ?? meta?.schemaEntityTypes,
		title: meta?.title || metrics?.documentTitle || metrics?.pageTitle,
		ogTitle: meta?.ogTitle || metrics?.ogTitle,
		metaDescription: meta?.metaDescription || metrics?.metaDescription,
		ogDescription: meta?.ogDescription || metrics?.ogDescription,
		metaKeywords: meta?.metaKeywords,
		representativeName: meta?.representativeName,
		ogSiteName: meta?.ogSiteName,
		organizationName: meta?.organizationName,
		schemaOrganizationNames: meta?.schemaOrganizationNames,
		brandAliases: meta?.brandAliases,
		navMenuTexts: meta?.navMenuTexts,
		h1Texts: metrics?.h1Texts,
		h2Texts: meta?.h2Texts ?? metrics?.h2Texts,
		jsonLdSnippets: metrics?.jsonLdSnippets,
		nap: {
			name: meta?.brandName,
			address: meta?.address,
			addressLocality: meta?.addressLocality,
			addressRegion: meta?.addressRegion,
		},
	};
}
