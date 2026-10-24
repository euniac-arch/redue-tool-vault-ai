import type { UniversalQuerySov } from '@/lib/audit/universal-sov-engine';

export type LiveCheckEngineId = 'gemini' | 'chatgpt' | 'perplexity' | 'claude' | 'copilot' | 'clova';

export type LiveGroundedEngineId = 'gemini' | 'chatgpt' | 'perplexity' | 'claude';

export type LiveReachLevel = 'Level 1' | 'Level 2' | 'Level 3';

/**
 * Fine-grained verdict from the LLM-as-judge pass:
 * - `none`: target is not mentioned/recommended (covers explicit negations such as
 *   "언급되지 않았습니다" / "not mentioned").
 * - `simple_mention`: target is mentioned but not clearly recommended/cited as an answer.
 * - `recommended`: target is actively recommended/cited as a top answer.
 */
export type MentionType = 'none' | 'simple_mention' | 'recommended';

export type GroundingTier = 'STRONG' | 'NEUTRAL' | 'WEAK' | 'NOT_FOUND';

export type GroundingStatusColor = 'green' | 'blue' | 'yellow' | 'red';

export const LIVE_GROUNDED_ENGINE_IDS = ['chatgpt', 'perplexity', 'gemini', 'claude'] as const satisfies readonly LiveGroundedEngineId[];

export interface LiveCitationMention {
	title: string;
	url: string;
	isTargetMention: boolean;
}

/**
 * Why a live call did not produce an observation. Classified from the provider's
 * error type, code, and message, not from the HTTP status alone (Perplexity returns
 * HTTP 401 for exhausted credits).
 */
export type LiveFailureKind =
	| 'missing_key'
	| 'auth'
	| 'billing'
	| 'rate_limit'
	| 'model_unavailable'
	| 'bad_request'
	| 'timeout'
	| 'network'
	| 'empty_body'
	| 'parse_error'
	| 'provider_error'
	| 'unknown';

/**
 * What one live call actually showed:
 * - `request_failed`: the API call failed (see `failureKind`).
 * - `empty_body`: HTTP success, but no answer text.
 * - `no_search_evidence`: an answer came back, but nothing shows a web search ran.
 * - `brand_mentioned`: search ran and the answer mentions the brand, with no official-domain citation.
 * - `official_cited`: search ran and the answer cites the official domain.
 * - `official_in_results`: the official domain is among retrieved results, but the answer does not cite it.
 * - `not_observed`: search ran and the target was not found in this answer.
 * - `mock`: test data, never a measurement.
 */
export type LiveObservationStatus =
	| 'request_failed'
	| 'empty_body'
	| 'no_search_evidence'
	| 'brand_mentioned'
	| 'official_cited'
	| 'official_in_results'
	| 'not_observed'
	| 'mock';

export interface LiveEngineCheckResult {
	engine: LiveCheckEngineId;
	/** True only when the engine returned a real, non-empty API answer body. */
	isLive?: boolean;
	/** True when the answer text or citations include the target brand or domain. */
	isGrounding?: boolean;
	/**
	 * True only when a real answer came back AND the response shows a web search ran.
	 * The UI shows the live score and exposure verdict only for these rows.
	 */
	isLiveGrounded: boolean;
	isCited: boolean;
	/** Structured judge verdict backing `isCited` (see `MentionType`). */
	mentionType?: MentionType;
	reachLevel: LiveReachLevel;
	liveScore: number;
	evidenceSnippet: string;
	citationUrl?: string;
	/** Unique live citation URLs (Perplexity citations[], evaluator match, parsed URL). */
	citedSources?: string[];
	/** Per-source ownership: official domain or brand-earned 3rd-party mention. */
	citations?: LiveCitationMention[];
	/** True when the live call did not give a measurement and the UI must keep the rule-based score. */
	fallbackToRuleScore?: boolean;
	citedRank?: 1 | 2 | 3 | null;
	error?: string;
	/** 4-tier context/sentiment verdict shared across all live engines. */
	tier?: GroundingTier;
	statusLabel?: string;
	statusColor?: GroundingStatusColor;
	weaknessReasons?: string[];

	/** What this call showed. Drives the badge and wording in the UI. */
	observation?: LiveObservationStatus;
	failureKind?: LiveFailureKind;
	httpStatus?: number;
	providerErrorCode?: string;
	/** Provider request id from the response headers, when the provider sends one. */
	providerRequestId?: string;
	/** ISO time this engine call finished. */
	checkedAt?: string;
	/** True when the response contained web-search evidence (citations, grounding chunks, search tool use). */
	searchEvidence?: boolean;
	searchSourceCount?: number;
	/** The answer text mentions the brand (negation-aware). */
	brandMentioned?: boolean;
	/** The answer cites a URL on the official domain. */
	officialCited?: boolean;
	/** The official domain is among retrieved results but the answer does not cite it. */
	officialInResults?: boolean;
	/** Test data from a MOCK_* flag. Never a measurement and never persisted. */
	isMock?: boolean;
}

/** Latest re-verification stored on the saved audit report. */
export interface LiveEngineChecksSnapshot {
	/** ISO time the last attempt finished. */
	checkedAt: string;
	/** ISO time the request that produced this snapshot started. Orders concurrent writes. */
	startedAt?: string;
	targetQuery: string;
	/** Latest attempt per engine, including failures. */
	results: LiveEngineCheckResult[];
	/** Last grounded result per engine, kept while the latest attempt failed. */
	lastGrounded?: Partial<Record<LiveCheckEngineId, LiveEngineCheckResult>>;
}

export type LiveCheckPersistStatus = 'saved' | 'stale' | 'record_not_found' | 'skipped' | 'error';

export interface LiveCheckRequestBody {
	/** Saved audit id. When present, the results are written back to that record. */
	auditId?: string;
	siteUrl: string;
	siteName: string;
	targetQuery: string;
	location?: string;
	category?: string;
	brandAliases?: string[];
	ruleScores?: Partial<Record<LiveCheckEngineId, number>>;
}

export interface LiveCheckResponse {
	success: boolean;
	targetQuery: string;
	results: LiveEngineCheckResult[];
	querySov?: UniversalQuerySov;
	/** True only when the saved audit record was actually updated. */
	persisted?: boolean;
	persistStatus?: LiveCheckPersistStatus;
	checkedAt?: string;
	startedAt?: string;
	/** Merged with the stored snapshot when persisted, so earlier grounded results are kept. */
	snapshot?: LiveEngineChecksSnapshot;
	error?: string;
}
