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

export interface LiveEngineCheckResult {
	engine: LiveCheckEngineId;
	isLiveGrounded: boolean;
	isCited: boolean;
	/** Structured judge verdict backing `isCited` (see `MentionType`). */
	mentionType?: MentionType;
	reachLevel: LiveReachLevel;
	liveScore: number;
	evidenceSnippet: string;
	citationUrl?: string;
	/** True when the live call failed and the UI must keep the rule-based score. */
	fallbackToRuleScore?: boolean;
	citedRank?: 1 | 2 | 3 | null;
	error?: string;
	/** 4-tier context/sentiment verdict shared across all live engines. */
	tier?: GroundingTier;
	statusLabel?: string;
	statusColor?: GroundingStatusColor;
	weaknessReasons?: string[];
}

export interface LiveCheckRequestBody {
	siteUrl: string;
	siteName: string;
	targetQuery: string;
	location?: string;
	category?: string;
	ruleScores?: Partial<Record<LiveCheckEngineId, number>>;
}

export interface LiveCheckResponse {
	success: boolean;
	targetQuery: string;
	results: LiveEngineCheckResult[];
	error?: string;
}
