/**
 * Trigger Keyword Depth — single source of truth for As-Is conversation
 * simulation. Levels, queries, and security hashtags are derived from the
 * central score packet (`engineScores` + `isHttps`) so GEO cards never drift
 * from the diagnosis snapshot.
 *
 *   Level 3  score ≥ 80 AND HTTPS
 *   Level 2  score 60–79 AND HTTPS
 *   Level 1  score ≤ 59 OR HTTPS missing (security lock)
 *
 * Answer Center 5 prescriptions (SSL + JSON-LD + /llms.txt) lift every
 * engine to Level 3 (unbranded recommend queries) on the To-Be side.
 */

import { generateQueryMatrix } from '@/lib/geo/query-matrix';

export type TriggerDepthLevel = 1 | 2 | 3;

export interface EngineTriggerSim {
	engine: string;
	name: string;
	currentLevel: TriggerDepthLevel;
	targetLevel: 3;
	currentQuery: string;
	targetQuery: string;
	tags: string[];
	isLockedBySecurity: boolean;
}

export const HTTPS_SECURITY_TAGS = ['#HTTPS보안미적용', '#비보안출처_추천제한'] as const;

export const TRIGGER_ENGINE_DEFAULT_TAGS = {
	chatgpt: '#BingPlaces신호',
	gemini: '#구글맵신호',
	perplexity: '#FAQ구조화신호',
	claude: '#EEAT문서신호',
	copilot: '#Bing인덱스',
	clova: '#네이버플레이스',
} as const;

const TRIGGER_ENGINES = [
	{ key: 'chatgpt', name: 'ChatGPT', defaultTag: TRIGGER_ENGINE_DEFAULT_TAGS.chatgpt },
	{ key: 'gemini', name: 'Gemini', defaultTag: TRIGGER_ENGINE_DEFAULT_TAGS.gemini },
	{ key: 'perplexity', name: 'Perplexity', defaultTag: TRIGGER_ENGINE_DEFAULT_TAGS.perplexity },
	{ key: 'claude', name: 'Claude', defaultTag: TRIGGER_ENGINE_DEFAULT_TAGS.claude },
	{ key: 'copilot', name: 'Copilot', defaultTag: TRIGGER_ENGINE_DEFAULT_TAGS.copilot },
	{ key: 'clova', name: 'Naver Clova', defaultTag: TRIGGER_ENGINE_DEFAULT_TAGS.clova },
] as const;

export type TriggerEngineScoreValue = number | { score: number };

export type TriggerEngineScoreMap = Record<string, TriggerEngineScoreValue>;

const DEFAULT_ENGINE_SCORE = 50;

export function readEngineScore(raw: TriggerEngineScoreValue | undefined, fallback = DEFAULT_ENGINE_SCORE): number {
	if (typeof raw === 'number') return Number.isFinite(raw) ? raw : fallback;
	if (raw && typeof raw === 'object' && Number.isFinite(raw.score)) return raw.score;
	return fallback;
}

export function toTriggerScoreMap(engineScores?: TriggerEngineScoreMap | null): Record<string, { score: number }> {
	const next: Record<string, { score: number }> = {};
	if (!engineScores) return next;
	for (const [key, value] of Object.entries(engineScores)) {
		next[key] = { score: readEngineScore(value) };
	}
	return next;
}

/** Security defect always forces Level 1. Otherwise score bands 80 / 60. */
export function resolveTriggerLevel(score: number, isHttps: boolean): TriggerDepthLevel {
	if (!isHttps) return 1;
	const n = Number.isFinite(score) ? score : DEFAULT_ENGINE_SCORE;
	if (n >= 80) return 3;
	if (n >= 60) return 2;
	return 1;
}

export function mergeUniqueTags(...groups: Array<readonly string[] | undefined>): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const group of groups) {
		for (const tag of group ?? []) {
			const next = tag.trim();
			if (!next || seen.has(next)) continue;
			seen.add(next);
			out.push(next);
		}
	}
	return out;
}

export function calculateTriggerDepths(
	brandName: string,
	region: string,
	mainService: string,
	engineScores: TriggerEngineScoreMap,
	isHttps: boolean,
): Record<string, EngineTriggerSim> {
	const result: Record<string, EngineTriggerSim> = {};
	const matrix = generateQueryMatrix({
		brandName,
		location: region,
		primaryKeyword: mainService,
		category: mainService,
		coreSpecialties: [mainService],
	});
	const brand = matrix.slots.brandName || brandName.trim() || '브랜드';
	const queries = matrix.triggerQueries;
	const targetQuery = matrix.sovPresets[0] || queries.level3 || queries.level2;

	TRIGGER_ENGINES.forEach(({ key, name, defaultTag }) => {
		const score = readEngineScore(engineScores[key]);

		// 1. 보안 결함 시 무조건 Level 1 고정, 정상 보안 시 점수 비례
		const currentLevel = resolveTriggerLevel(score, isHttps);

		// 2. 질의 텍스트 구성 — shared query matrix (never intent-only)
		let currentQuery = queries.level1 || brand;
		if (currentLevel === 2) currentQuery = queries.level2 || currentQuery;
		if (currentLevel === 3) currentQuery = queries.level3 || targetQuery || currentQuery;

		// 3. 동적 해시태그 구성
		const tags: string[] = [];
		if (!isHttps) {
			tags.push(...HTTPS_SECURITY_TAGS);
		}
		tags.push(defaultTag);
		if (currentLevel === 1) tags.push('#브랜드전용트리거');
		if (currentLevel >= 2) tags.push('#세부서비스인용가능');

		result[key] = {
			engine: key,
			name,
			currentLevel,
			targetLevel: 3,
			currentQuery,
			targetQuery,
			tags,
			isLockedBySecurity: !isHttps,
		};
	});

	return result;
}
