/**
 * Single source of truth for Query Reach (header) + As-Is / To-Be simulation cards.
 * Both surfaces read the same SiteReachState slice — never a hardcoded Level 1 brand query.
 */

import { buildToBeKeywordPack } from '@/lib/geo/as-is-honesty';
import { generateEngineSimulation } from '@/lib/geo/engine-simulation';
import { buildEngineOptimizationGuide } from '@/lib/geo/engine-optimization-guide';
import { liftAfterLevel } from '@/lib/geo/prescription-patches';
import { pickExpandedTriggerQuery, type ToBeKeywordPack } from '@/lib/geo/query-location';
import type { EngineOptimizationGuide } from '@/types/geo-trigger-simulation';
import {
	AI_ENGINE_IDS,
	type AIEngineId,
	type AIEngineTestResult,
	type GeoDiagnosticReport,
	type KeywordDepthLevel,
} from '@/types/geo-diagnostic';
import {
	ENGINE_TYPE_BY_ID,
	type EngineLevelView,
	type EngineQueryLevelView,
	type EngineSimulationData,
	type ReachLevel,
	type ReachSlice,
	type SiteReachState,
} from '@/types/site-reach';

export type SiteReachLang = 'ko' | 'en';

export interface BuildSiteReachStateInput {
	before: GeoDiagnosticReport;
	after?: GeoDiagnosticReport | null;
	isPrescriptionApplied?: boolean;
	lang?: SiteReachLang;
	location?: string;
	specialties?: readonly string[];
	category?: string;
}

const LEVEL_LABEL: Record<SiteReachLang, Record<ReachLevel, string>> = {
	ko: {
		1: 'Level 1 브랜드전용',
		2: 'Level 2 카테고리',
		3: 'Level 3 대화형 추천',
	},
	en: {
		1: 'Level 1 brand-only',
		2: 'Level 2 category',
		3: 'Level 3 conversational recommend',
	},
};

const REACH_BADGE_CLASS: Record<ReachLevel, string> = {
	1: 'bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-400',
	2: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/25 dark:text-indigo-400',
	3: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400',
};

function normalizePhrase(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

export function queryContainsBrand(query: string, brandName: string): boolean {
	const brand = normalizePhrase(brandName);
	const text = normalizePhrase(query);
	if (!brand || brand.length < 2 || !text) return false;
	return text.toLowerCase().includes(brand.toLowerCase());
}

function asReachLevel(level: KeywordDepthLevel | null | undefined): ReachLevel {
	if (level === 2 || level === 3) return level;
	return 1;
}

function brandAsIsQuery(brandName: string, lang: SiteReachLang, fallback: string): string {
	const brand = normalizePhrase(brandName);
	if (fallback && queryContainsBrand(fallback, brand)) return fallback;
	if (!brand) return lang === 'en' ? 'official site' : '위치';
	return lang === 'en' ? `${brand} official site` : `${brand} 위치`;
}

function firstUnbranded(candidates: readonly (string | undefined)[], brandName: string, fallback: string): string {
	for (const raw of candidates) {
		const query = normalizePhrase(raw);
		if (query && !queryContainsBrand(query, brandName)) return query;
	}
	return normalizePhrase(fallback);
}

function packQueries(pack: ToBeKeywordPack): string[] {
	return [...pack.nationwide, ...pack.local, ...pack.metro, ...pack.all];
}

function toBeFallbackQuery(level: 2 | 3, location: string, specialty: string, lang: SiteReachLang): string {
	const loc = normalizePhrase(location);
	const noun = normalizePhrase(specialty) || (lang === 'en' ? 'clinic' : '클리닉');
	if (lang === 'en') {
		if (level === 3) return loc ? `recommend ${noun} in ${loc}` : `recommend ${noun}`;
		return loc ? `${loc} ${noun}` : noun;
	}
	if (level === 3) return loc ? `${loc} ${noun} 추천` : `${noun} 추천`;
	return loc ? `${loc} ${noun}` : noun;
}

function buildToBeQuery(
	engineId: AIEngineId,
	level: 2 | 3,
	pack: ToBeKeywordPack,
	simQueries: readonly string[],
	brandName: string,
	location: string,
	specialty: string,
	lang: SiteReachLang,
	preferred?: string,
): string {
	const picked = pickExpandedTriggerQuery(engineId, pack, preferred || '');
	return firstUnbranded(
		[preferred, picked, ...simQueries, ...packQueries(pack), toBeFallbackQuery(level, location, specialty, lang)],
		brandName,
		toBeFallbackQuery(level, location, specialty, lang),
	);
}

function simulationData(
	engineId: AIEngineId,
	level: ReachLevel,
	triggerQuery: string,
	aiResponseSnippet: string,
	lang: SiteReachLang,
	optimizationGuide?: EngineOptimizationGuide,
	byLevel?: Record<ReachLevel, EngineLevelView>,
): EngineSimulationData {
	return {
		engineId,
		engineName: ENGINE_TYPE_BY_ID[engineId],
		level,
		levelLabel: LEVEL_LABEL[lang][level],
		triggerQuery,
		aiResponseSnippet,
		reachBadgeClass: REACH_BADGE_CLASS[level],
		optimizationGuide,
		byLevel,
	};
}

function fallbackLevelView(engine: EngineSimulationData, level: ReachLevel): EngineLevelView {
	if (engine.byLevel?.[level]) return engine.byLevel[level];
	return { triggerQuery: engine.triggerQuery, aiResponseSnippet: engine.aiResponseSnippet };
}

/**
 * Remap one engine card to the query level the user is verifying.
 * Inherent `level` stays the measured/lifted max reach — never overwritten.
 */
export function projectEngineForQueryLevel(
	engine: EngineSimulationData,
	selectedLevel: ReachLevel,
): EngineQueryLevelView {
	const canReachSelected = selectedLevel <= engine.level;
	const view = fallbackLevelView(engine, selectedLevel);
	const byLevel = engine.byLevel ?? {
		1: fallbackLevelView(engine, 1),
		2: fallbackLevelView(engine, 2),
		3: fallbackLevelView(engine, 3),
	};
	return {
		...engine,
		selectedLevel,
		canReachSelected,
		byLevel,
		triggerQuery: view.triggerQuery,
		aiResponseSnippet: view.aiResponseSnippet,
	};
}

export function projectReachSliceForQueryLevel(
	slice: ReachSlice,
	selectedLevel: ReachLevel,
): ReachSlice {
	const engines = {} as Record<AIEngineId, EngineSimulationData>;
	for (const id of AI_ENGINE_IDS) {
		engines[id] = projectEngineForQueryLevel(slice.engines[id], selectedLevel);
	}
	return { ...slice, engines };
}

export function asSelectedReachLevel(level: KeywordDepthLevel | null | undefined): ReachLevel {
	return asReachLevel(level);
}

function buildLevelViews(input: {
	engineId: AIEngineId;
	reachableLevel: ReachLevel;
	brandName: string;
	location: string;
	specialties: string[];
	domain: string;
	url: string;
	lang: SiteReachLang;
	queries: Record<ReachLevel, string>;
	measured?: Partial<Record<ReachLevel, EngineLevelView>>;
}): Record<ReachLevel, EngineLevelView> {
	const views = {} as Record<ReachLevel, EngineLevelView>;
	for (const level of [1, 2, 3] as const) {
		const query = input.queries[level];
		const measured = input.measured?.[level];
		const reachable = level <= input.reachableLevel;
		if (reachable && measured?.aiResponseSnippet) {
			views[level] = {
				triggerQuery: measured.triggerQuery || query,
				aiResponseSnippet: measured.aiResponseSnippet,
			};
			continue;
		}
		const sim = generateEngineSimulation(
			input.engineId,
			input.brandName,
			input.location,
			input.specialties,
			input.domain,
			{
				url: input.url,
				lang: input.lang,
				asIsQuery: input.queries[1],
				toBeQuery: query,
			},
		);
		views[level] = {
			triggerQuery: query,
			aiResponseSnippet: reachable ? sim.toBeResponse : sim.asIsResponse,
		};
	}
	return views;
}

function countSlice(
	engines: Record<AIEngineId, EngineSimulationData>,
	triggerQueries: Record<ReachLevel, string>,
): ReachSlice {
	let level1Count = 0;
	let level2Count = 0;
	let level3Count = 0;
	for (const id of AI_ENGINE_IDS) {
		const level = engines[id].level;
		if (level === 3) level3Count += 1;
		else if (level === 2) level2Count += 1;
		else level1Count += 1;
	}
	return {
		level1Count,
		level2Count,
		level3Count,
		recommendedCount: level2Count + level3Count,
		triggerQueries,
		engines,
	};
}

function engineById(report: GeoDiagnosticReport | null | undefined): Map<AIEngineId, AIEngineTestResult> {
	const map = new Map<AIEngineId, AIEngineTestResult>();
	for (const engine of report?.engines ?? []) {
		map.set(engine.engine.id, engine);
	}
	return map;
}

export function buildSiteReachState(input: BuildSiteReachStateInput): SiteReachState {
	const lang: SiteReachLang = input.lang === 'en' ? 'en' : 'ko';
	const before = input.before;
	const after = input.after ?? null;
	const brandName = before.brandName;
	const location = normalizePhrase(input.location) || normalizePhrase(after?.triggerQueries?.[2]) || '';
	const specialties = (input.specialties || []).map(normalizePhrase).filter(Boolean).slice(0, 3);
	const category = normalizePhrase(input.category) || specialties[0] || '';
	const specialty = specialties[0] || category || (lang === 'en' ? 'clinic' : '클리닉');

	const pack = buildToBeKeywordPack({
		lang,
		location,
		category: category || specialty,
		primaryKeyword: specialty,
		brandName,
		specialties,
	});

	const beforeById = engineById(before);
	const afterById = engineById(after);

	const asIsEngines = {} as Record<AIEngineId, EngineSimulationData>;
	const toBeEngines = {} as Record<AIEngineId, EngineSimulationData>;

	const asIsBrandQuery = brandAsIsQuery(brandName, lang, before.triggerQueries[1]);
	const toBeL2Fallback = firstUnbranded(
		[before.triggerQueries[2], after?.triggerQueries[2], ...pack.local, ...pack.metro],
		brandName,
		toBeFallbackQuery(2, location, specialty, lang),
	);
	const toBeL3Fallback = firstUnbranded(
		[before.triggerQueries[3], after?.triggerQueries[3], ...pack.nationwide],
		brandName,
		toBeFallbackQuery(3, location, specialty, lang),
	);
	const asIsL2Shared = firstUnbranded(
		[before.triggerQueries[2], toBeL2Fallback],
		brandName,
		toBeL2Fallback,
	);
	const asIsL3Shared = firstUnbranded(
		[before.triggerQueries[3], toBeL3Fallback],
		brandName,
		toBeL3Fallback,
	);

	for (const id of AI_ENGINE_IDS) {
		const current = beforeById.get(id);
		const next = afterById.get(id);
		const asIsLevel = asReachLevel(current?.currentStatus?.level ?? current?.depthLevel);
		const asIsQuery = normalizePhrase(
			asIsLevel === 1
				? current?.currentStatus?.triggerQuery || current?.triggerQuery || asIsBrandQuery
				: current?.currentStatus?.triggerQuery || current?.triggerQuery || before.triggerQueries[asIsLevel],
		) || asIsBrandQuery;
		const asIsResponse =
			current?.currentStatus?.simulationResponse || current?.simulatedResponse || '';

		const asIsByLevel = buildLevelViews({
			engineId: id,
			reachableLevel: asIsLevel,
			brandName,
			location,
			specialties,
			domain: before.domain,
			url: before.targetUrl,
			lang,
			queries: {
				1: asIsBrandQuery,
				2: asIsL2Shared,
				3: asIsL3Shared,
			},
			measured: {
				[asIsLevel]: { triggerQuery: asIsQuery, aiResponseSnippet: asIsResponse },
			},
		});

		asIsEngines[id] = simulationData(
			id,
			asIsLevel,
			asIsByLevel[asIsLevel].triggerQuery || asIsQuery,
			asIsByLevel[asIsLevel].aiResponseSnippet || asIsResponse,
			lang,
			current?.optimizationGuide ??
				buildEngineOptimizationGuide({
					engineId: id,
					currentLevel: asIsLevel,
					lang,
					location,
					category: category || specialty,
					specialties,
					brandName,
				}),
			asIsByLevel,
		);

		const toBeLevel = (next && next.depthLevel === 2) || next?.depthLevel === 3
			? next.depthLevel
			: liftAfterLevel(current?.depthLevel, id);
		const sim = generateEngineSimulation(id, brandName, location, specialties, before.domain, {
			url: before.targetUrl,
			lang,
			asIsQuery,
			toBeQuery: toBeLevel === 3 ? toBeL3Fallback : toBeL2Fallback,
		});
		const toBeL2Query = buildToBeQuery(
			id,
			2,
			pack,
			sim.toBeQueries,
			brandName,
			location,
			specialty,
			lang,
			next?.depthLevel === 2
				? next.postOptimization?.expandedTriggerQuery || next.triggerQuery
				: '',
		);
		const toBeL3Query = buildToBeQuery(
			id,
			3,
			pack,
			sim.toBeQueries,
			brandName,
			location,
			specialty,
			lang,
			next?.depthLevel === 3
				? next.postOptimization?.expandedTriggerQuery || next.triggerQuery
				: '',
		);
		const toBeQuery = toBeLevel === 3 ? toBeL3Query : toBeL2Query;
		const toBeResponse =
			next?.postOptimization?.expectedSimulationResponse ||
			next?.simulatedResponse ||
			sim.toBeResponse;

		const toBeByLevel = buildLevelViews({
			engineId: id,
			reachableLevel: toBeLevel,
			brandName,
			location,
			specialties,
			domain: before.domain,
			url: before.targetUrl,
			lang,
			queries: {
				1: asIsBrandQuery,
				2: toBeL2Query,
				3: toBeL3Query,
			},
			measured: {
				[toBeLevel]: { triggerQuery: toBeQuery, aiResponseSnippet: toBeResponse },
			},
		});

		toBeEngines[id] = simulationData(
			id,
			toBeLevel,
			toBeByLevel[toBeLevel].triggerQuery || toBeQuery,
			toBeByLevel[toBeLevel].aiResponseSnippet || toBeResponse,
			lang,
			next?.optimizationGuide && next.optimizationGuide.currentLevel === toBeLevel
				? next.optimizationGuide
				: buildEngineOptimizationGuide({
						engineId: id,
						currentLevel: toBeLevel,
						lang,
						location,
						category: category || specialty,
						specialties,
						brandName,
					}),
			toBeByLevel,
		);
	}

	const asIsL2 = firstUnbranded(
		[before.triggerQueries[2], ...Object.values(asIsEngines).filter((e) => e.level === 2).map((e) => e.triggerQuery)],
		brandName,
		toBeL2Fallback,
	);
	const asIsL3 = firstUnbranded(
		[before.triggerQueries[3], ...Object.values(asIsEngines).filter((e) => e.level === 3).map((e) => e.triggerQuery)],
		brandName,
		toBeL3Fallback,
	);

	return {
		isPrescriptionApplied: Boolean(input.isPrescriptionApplied),
		asIs: countSlice(asIsEngines, {
			1: asIsBrandQuery,
			2: asIsL2,
			3: asIsL3,
		}),
		toBe: countSlice(toBeEngines, {
			1: asIsBrandQuery,
			2: firstUnbranded(
				[...Object.values(toBeEngines).filter((e) => e.level === 2).map((e) => e.triggerQuery), toBeL2Fallback],
				brandName,
				toBeL2Fallback,
			),
			3: firstUnbranded(
				[...Object.values(toBeEngines).filter((e) => e.level === 3).map((e) => e.triggerQuery), toBeL3Fallback],
				brandName,
				toBeL3Fallback,
			),
		}),
	};
}
