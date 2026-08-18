import { AI_ENGINE_IDS, type AIEngineId } from '@/types/geo-diagnostic';
import type { EngineOptimizationGuide } from '@/types/geo-trigger-simulation';

export type ReachLevel = 1 | 2 | 3;
export type ReachMode = 'asIs' | 'toBe';

/** Educational copy for how each trigger level is reached and cited. */
export interface ReachLevelGuide {
	level: ReachLevel;
	title: string;
	badgeText: string;
	shortDesc: string;
	/** How the query is approached / recognized. */
	reachMechanism: string;
	/** Who can see the brand at this depth. */
	exposureScope: string;
	/** Representative query pattern. */
	examplePattern: string;
}
export type EngineType = 'ChatGPT' | 'Gemini' | 'Claude' | 'Perplexity' | 'Copilot' | 'Naver Clova';

export const ENGINE_TYPE_BY_ID: Record<AIEngineId, EngineType> = {
	chatgpt: 'ChatGPT',
	gemini: 'Gemini',
	claude: 'Claude',
	perplexity: 'Perplexity',
	copilot: 'Copilot',
	clova: 'Naver Clova',
};

export interface EngineLevelView {
	triggerQuery: string;
	aiResponseSnippet: string;
}

export interface EngineSimulationData {
	engineId: AIEngineId;
	engineName: EngineType;
	/** Inherent max reach in this slice (As-Is measured / To-Be lifted). */
	level: ReachLevel;
	/** 'Level 1 브랜드전용' | 'Level 2 카테고리' | 'Level 3 대화형 추천' */
	levelLabel: string;
	/** Actual search-box trigger query for this engine + mode. */
	triggerQuery: string;
	/** Simulated AI answer (recommendation reason / evidence). */
	aiResponseSnippet: string;
	reachBadgeClass: string;
	/** Level 3 lift packet — shown when this engine is still at Level 2. */
	optimizationGuide?: EngineOptimizationGuide;
	/** Query + response for each verification level (1–3). */
	byLevel?: Record<ReachLevel, EngineLevelView>;
	/** Set by `projectEngineForQueryLevel` — the chip currently being simulated. */
	selectedLevel?: ReachLevel;
	/** True when inherent `level` can answer the selected verification query. */
	canReachSelected?: boolean;
}

/** Engine snapshot remapped to the query level the user is verifying. */
export interface EngineQueryLevelView extends EngineSimulationData {
	selectedLevel: ReachLevel;
	canReachSelected: boolean;
	byLevel: Record<ReachLevel, EngineLevelView>;
}

export interface ReachSlice {
	level1Count: number;
	level2Count: number;
	level3Count: number;
	/** Engines that reach Level 2+ (recommended / cited beyond brand-only). */
	recommendedCount: number;
	triggerQueries: Record<ReachLevel, string>;
	engines: Record<AIEngineId, EngineSimulationData>;
}

export interface SiteReachState {
	isPrescriptionApplied: boolean;
	asIs: ReachSlice;
	toBe: ReachSlice;
}

export const REACH_ENGINE_IDS = AI_ENGINE_IDS;

export function reachEngineList(slice: ReachSlice): EngineSimulationData[] {
	return REACH_ENGINE_IDS.map((id) => slice.engines[id]);
}

export function activeReachSlice(state: SiteReachState, mode: ReachMode): ReachSlice {
	return mode === 'toBe' ? state.toBe : state.asIs;
}
