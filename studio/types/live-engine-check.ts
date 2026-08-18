export type LiveCheckEngineId = 'gemini' | 'chatgpt' | 'perplexity' | 'claude' | 'copilot' | 'clova';

export type LiveGroundedEngineId = 'gemini' | 'chatgpt' | 'perplexity' | 'claude';

export type LiveReachLevel = 'Level 1' | 'Level 2' | 'Level 3';

export const LIVE_GROUNDED_ENGINE_IDS = ['chatgpt', 'perplexity', 'gemini', 'claude'] as const satisfies readonly LiveGroundedEngineId[];

export interface LiveEngineCheckResult {
	engine: LiveCheckEngineId;
	isLiveGrounded: boolean;
	isCited: boolean;
	reachLevel: LiveReachLevel;
	liveScore: number;
	evidenceSnippet: string;
	citationUrl?: string;
	/** True when the live call failed and the UI must keep the rule-based score. */
	fallbackToRuleScore?: boolean;
	citedRank?: 1 | 2 | 3 | null;
	error?: string;
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
