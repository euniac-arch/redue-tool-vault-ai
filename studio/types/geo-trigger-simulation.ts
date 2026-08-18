/**
 * As-Is / Advice / To-Be contract for per-engine GEO trigger simulation.
 *
 * As-Is level is derived from the central score packet:
 *   Level 3 — engine score ≥ 80 AND HTTPS
 *   Level 2 — engine score 60–79 AND HTTPS
 *   Level 1 — engine score ≤ 59 OR HTTPS missing (security lock)
 *
 * To-Be is always Level 3 after Answer Center 5 prescriptions
 * (SSL + JSON-LD + /llms.txt).
 */

import type { AIEngineId } from '@/types/geo-diagnostic';

export type AsIsTriggerLevel = 1 | 2 | 3;

export interface EngineCurrentStatus {
	level: AsIsTriggerLevel;
	/** "Level 1" | "Level 2" | "Level 3" */
	levelLabel: string;
	triggerQuery: string;
	simulationResponse: string;
	/** Hash tags derived from crawl/NAP/schema/HTTPS signals, e.g. #HTTPS보안미적용 */
	statusTags: string[];
	/** True when HTTPS is missing — As-Is is forced to Level 1. */
	isLockedBySecurity?: boolean;
}

export interface EngineOptimizationAdvice {
	actionItems: string[];
}

export type EngineOptimizationName =
	| 'ChatGPT'
	| 'Gemini'
	| 'Claude'
	| 'Perplexity'
	| 'Copilot'
	| 'Naver Clova';

export type EngineLevel3QueryPattern = 'local' | 'metro' | 'nationwide';

/** One engine-tuned token combo that can trigger a Level 3 unbranded recommend. */
export interface EngineLevel3KeywordCombo {
	id: string;
	tokens: string[];
	query: string;
	intent: string;
}

/**
 * Per-engine Level 3 lift packet.
 * Used when an engine is stuck at Level 2 (category) and needs an
 * engine-specific conversational query + on-page/schema prescription.
 */
export interface EngineOptimizationGuide {
	engineName: EngineOptimizationName;
	engineId: AIEngineId;
	currentLevel: 1 | 2 | 3;
	targetLevel: 3;
	/** Gemini 등 Level 2인 엔진을 Level 3로 트리거시키는 특화 질의 */
	level3OptimizedQuery: string;
	/** Token combinations that match the engine's Level 3 query pattern. */
	level3KeywordCombos: EngineLevel3KeywordCombo[];
	/** Level 3 도달을 위한 사이트 개선 처방 팁 */
	prescriptionTips: string[];
	/** 엔진별 가중치 특성 설명 */
	engineCharacteristics: string;
	/** local = Gemini/Clova · metro = Claude/Copilot · nationwide = ChatGPT/Perplexity */
	queryPattern: EngineLevel3QueryPattern;
}

export interface EnginePostOptimization {
	targetLevel: 3;
	/** "Level 3 우수 (비브랜드 추천 질의) — Answer Center 5대 처방" */
	targetLevelLabel: string;
	expandedTriggerQuery: string;
	expectedSimulationResponse: string;
	/** Broad category keywords reachable only after the prescription (To-Be). */
	expandedCategoryQueries?: string[];
}

/** Wire format requested by the GEO trigger-simulation spec. */
export interface EngineTriggerSimulationJson {
	engine: string;
	engineId: AIEngineId;
	current_status: {
		level: 'Level 1' | 'Level 2' | 'Level 3';
		trigger_query: string;
		simulation_response: string;
		status_tags: string[];
	};
	optimization_advice: {
		action_items: string[];
	};
	post_optimization: {
		target_level: string;
		expanded_trigger_query: string;
		expected_simulation_response: string;
	};
}
