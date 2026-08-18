/**
 * AI Engine Exposure & Trigger Depth — GEO Diagnostic data model.
 *
 * Depth is the *deepest* unbranded-to-branded query that still surfaces the
 * site. GEO is complete only when an engine cites the brand on Level 3
 * conversational prompts (no brand name in the query).
 *
 * As-Is level follows the central `engineScores` + `isHttps` packet.
 * Level 3 is allowed when the engine score is 80+ and HTTPS is on.
 * Missing HTTPS locks every engine at Level 1. To-Be is always Level 3
 * after Answer Center 5 prescriptions (SSL + JSON-LD + /llms.txt).
 */

import type {
	EngineCurrentStatus,
	EngineOptimizationAdvice,
	EngineOptimizationGuide,
	EnginePostOptimization,
} from '@/types/geo-trigger-simulation';

/** 1 = Brand · 2 = Category+Location · 3 = Broad Intent */
export const KEYWORD_DEPTH_LEVEL = {
	BRAND: 1,
	CATEGORY_LOCATION: 2,
	BROAD_INTENT: 3,
} as const;

export type KeywordDepthLevel = (typeof KEYWORD_DEPTH_LEVEL)[keyof typeof KEYWORD_DEPTH_LEVEL];

export const AI_ENGINE_IDS = ['chatgpt', 'gemini', 'claude', 'perplexity', 'copilot', 'clova'] as const;

export type AIEngineId = (typeof AI_ENGINE_IDS)[number];

/** Engines that can run a direct live-grounding probe. Display order: ChatGPT → Perplexity → Gemini → Claude. */
export const LIVE_GROUNDING_ENGINE_IDS = ['chatgpt', 'perplexity', 'gemini', 'claude'] as const satisfies readonly AIEngineId[];

/** Engines scored from Bing / Naver index proxies — never presented as live measurements. */
export const PROXY_INDEX_ENGINE_IDS = ['copilot', 'clova'] as const satisfies readonly AIEngineId[];

export type LiveGroundingEngineId = (typeof LIVE_GROUNDING_ENGINE_IDS)[number];
export type ProxyIndexEngineId = (typeof PROXY_INDEX_ENGINE_IDS)[number];

export function isLiveGroundingEngine(id: string): id is LiveGroundingEngineId {
	return (LIVE_GROUNDING_ENGINE_IDS as readonly string[]).includes(id);
}

/** Stable display index for the Direct Live Grounding group. Unknown ids sort last. */
export function liveGroundingOrderIndex(id: string): number {
	const index = (LIVE_GROUNDING_ENGINE_IDS as readonly string[]).indexOf(id);
	return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function isProxyIndexEngine(id: string): id is ProxyIndexEngineId {
	return (PROXY_INDEX_ENGINE_IDS as readonly string[]).includes(id);
}

/**
 * Status badge shown on each engine card.
 * Correlated 1:1 with depth: L3→optimal, L2→moderate, L1→exact_only, none→not_indexed.
 */
export const AI_ENGINE_STATUS_BADGE = {
	OPTIMAL: 'optimal',
	MODERATE: 'moderate',
	EXACT_ONLY: 'exact_only',
	NOT_INDEXED: 'not_indexed',
} as const;

export type AIEngineStatusBadge = (typeof AI_ENGINE_STATUS_BADGE)[keyof typeof AI_ENGINE_STATUS_BADGE];

export interface AIEngineInfo {
	id: AIEngineId;
	name: string;
	provider: string;
}

export const AI_ENGINE_CATALOG: Record<AIEngineId, AIEngineInfo> = {
	chatgpt: { id: 'chatgpt', name: 'ChatGPT', provider: 'OpenAI' },
	gemini: { id: 'gemini', name: 'Gemini', provider: 'Google' },
	claude: { id: 'claude', name: 'Claude', provider: 'Anthropic' },
	perplexity: { id: 'perplexity', name: 'Perplexity', provider: 'Perplexity' },
	copilot: { id: 'copilot', name: 'Copilot', provider: 'Microsoft' },
	clova: { id: 'clova', name: 'Naver Clova', provider: 'Naver' },
};

export const KEYWORD_DEPTH_META: Record<
	KeywordDepthLevel,
	{ label: string; intent: string; statusBadge: Exclude<AIEngineStatusBadge, 'not_indexed'> }
> = {
	1: {
		label: 'Brand',
		intent: 'Brand / exact-match query (e.g. “[brand] location”)',
		statusBadge: 'exact_only',
	},
	2: {
		label: 'Category+Location',
		intent: 'Category + location query (e.g. “[city] [category]”)',
		statusBadge: 'moderate',
	},
	3: {
		label: 'Broad Intent',
		intent: 'Broad unbranded conversational intent (e.g. “recommend a place for [keyword]”)',
		statusBadge: 'optimal',
	},
};

/** Positive (citation lift) vs negative (penalty) chip on an AI engine card. */
export type EngineAnalysisTagPolarity = 'positive' | 'negative';

export interface EngineAnalysisTag {
	id: string;
	label: string;
	polarity: EngineAnalysisTagPolarity;
}

export const AI_CRAWLER_BOT_IDS = ['gptbot', 'perplexitybot', 'claudebot', 'google-extended'] as const;
export type AiCrawlerBotId = (typeof AI_CRAWLER_BOT_IDS)[number];

export interface AiCrawlerBotStatus {
	id: AiCrawlerBotId;
	label: string;
	provider?: string;
	allowed: boolean;
	/** Extra warning shown when this bot is blocked (e.g. Claude exposure drop). */
	warning?: string;
}

export const SCHEMA_PROPERTY_IDS = [
	'entityType',
	'geoCoordinates',
	'openingHours',
	'hasOfferCatalog',
	'sameAs',
] as const;
export type SchemaPropertyId = (typeof SCHEMA_PROPERTY_IDS)[number];

export interface SchemaPropertyCheck {
	id: SchemaPropertyId;
	label: string;
	complete: boolean;
	detail: string;
}

interface AIEngineTestResultBase {
	engine: AIEngineInfo;
	triggerQuery: string;
	simulatedResponse: string;
	improvementTip: string;
	/**
	 * 0–100 AI Readiness Score. Star count and Why & Status badge
	 * are derived from this via `getRatingMeta(score)` — never stored separately.
	 */
	score: number;
	/** Optional citation / penalty chips rendered under the engine-card header. */
	analysisTags?: readonly EngineAnalysisTag[];
	/** Current diagnosis (As-Is) — Level 1–3 from engineScores + isHttps. */
	currentStatus?: EngineCurrentStatus;
	/** Concrete GEO actions to unlock Level 3. */
	optimizationAdvice?: EngineOptimizationAdvice;
	/** Engine-tuned Level 3 query + prescription when the engine is below Level 3. */
	optimizationGuide?: EngineOptimizationGuide;
	/** Post-prescription expanded query + rank-1 simulation (To-Be). */
	postOptimization?: EnginePostOptimization;
	/** True when this card was filled by /api/audit/probe-live (real model call). */
	isLive?: boolean;
	/** Provider label from the live probe, e.g. "ChatGPT (gpt-4o-mini · 실시간)". */
	liveLabel?: string;
}

/** Exposed at Level 1 — brand / exact match only. */
export interface AIEngineExactOnlyResult extends AIEngineTestResultBase {
	statusBadge: 'exact_only';
	depthLevel: 1;
}

/** Exposed at Level 2 — category + location. */
export interface AIEngineModerateResult extends AIEngineTestResultBase {
	statusBadge: 'moderate';
	depthLevel: 2;
}

/** Exposed at Level 3 — broad unbranded intent. */
export interface AIEngineOptimalResult extends AIEngineTestResultBase {
	statusBadge: 'optimal';
	depthLevel: 3;
}

/** Not cited on any trigger query. */
export interface AIEngineNotIndexedResult extends AIEngineTestResultBase {
	statusBadge: 'not_indexed';
	depthLevel: null;
}

/**
 * Per-engine GEO probe result. Status badge and depth level are a
 * discriminated union so an `optimal` badge cannot carry a Level 1 depth.
 */
export type AIEngineTestResult =
	| AIEngineOptimalResult
	| AIEngineModerateResult
	| AIEngineExactOnlyResult
	| AIEngineNotIndexedResult;

export type GeoDiagnosticCaseId = 'high' | 'low';

/** One complete 6-engine diagnostic snapshot (mock Case A / Case B, or live probe). */
export interface GeoDiagnosticReport {
	caseId: GeoDiagnosticCaseId;
	caseLabel: string;
	targetUrl: string;
	domain: string;
	brandName: string;
	generatedAt: string;
	/** Trigger queries used for this probe, keyed by depth. */
	triggerQueries: Record<KeywordDepthLevel, string>;
	engines: AIEngineTestResult[];
	/** Optional Technical GEO crawler-access snapshot (Digital Footprint). */
	aiBots?: readonly AiCrawlerBotStatus[];
	/** Optional Schema.org 5-property completeness (E-E-A-T). */
	schemaProperties?: readonly SchemaPropertyCheck[];
	/** Optional per-engine analysis chips, keyed by engine id. */
	engineAnalysisTags?: Partial<Record<AIEngineId, readonly EngineAnalysisTag[]>>;
}

/** Compile-time: a report must include every engine exactly once. */
export type AIEngineTestResultById = Record<AIEngineId, AIEngineTestResult>;

export function enginesFromMap(map: { readonly [K in AIEngineId]: AIEngineTestResult }): AIEngineTestResult[] {
	return AI_ENGINE_IDS.map((id) => map[id]);
}

export function isIndexedResult(
	result: AIEngineTestResult,
): result is Exclude<AIEngineTestResult, AIEngineNotIndexedResult> {
	return result.depthLevel !== null;
}

export function statusBadgeForDepth(level: KeywordDepthLevel): Exclude<AIEngineStatusBadge, 'not_indexed'> {
	return KEYWORD_DEPTH_META[level].statusBadge;
}

export interface GeoDiagnosticSummary {
	/** Mean trigger depth / 3, scaled to 0–100. Unindexed engines count as depth 0. */
	indexScore: number;
	indexedCount: number;
	totalEngines: number;
	averageDepth: number;
	levelCounts: Record<KeywordDepthLevel, number>;
	unindexedCount: number;
}

export function summarizeGeoDiagnostic(engines: readonly AIEngineTestResult[]): GeoDiagnosticSummary {
	const totalEngines = engines.length || 6;
	const levelCounts: Record<KeywordDepthLevel, number> = { 1: 0, 2: 0, 3: 0 };
	let depthSum = 0;
	let indexedCount = 0;

	for (const engine of engines) {
		if (engine.depthLevel === null) continue;
		levelCounts[engine.depthLevel] += 1;
		depthSum += engine.depthLevel;
		indexedCount += 1;
	}

	const averageDepth = totalEngines > 0 ? Math.round((depthSum / totalEngines) * 10) / 10 : 0;
	const indexScore = Math.min(100, Math.max(0, Math.round((averageDepth / 3) * 100)));

	return {
		indexScore,
		indexedCount,
		totalEngines,
		averageDepth,
		levelCounts,
		unindexedCount: Math.max(0, totalEngines - indexedCount),
	};
}
