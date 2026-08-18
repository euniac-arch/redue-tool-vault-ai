/**
 * Single scoring pipeline:
 *   Collector checks → Rule evaluator → 5-category aggregate → 100-point normalize
 *
 * Every surface (live engine, on-page cards, history, GEO headline) must
 * read totals from `runScorePipeline` / `clampEarned` so NaN / overflow
 * cannot leak into the UI.
 */

import {
	calculate5CategoryScores,
	earnedScoreForItem,
	type CategoryAggregateResult,
	type CategoryChecklistItem,
	type RadarAxisScores,
} from '@/lib/audit/categoryAggregator';
import { CHECKLIST_TOTAL_MAX } from '@/lib/audit/checklistDefinitions';
import { normalizeTo100, roundRawPoints } from '@/lib/audit/auditScoreCalculator';

export { earnedScoreForItem, normalizeTo100, roundRawPoints };

export interface EvaluatedRule {
	id: string;
	verdict: 'pass' | 'warning' | 'fail';
	earned: number;
	max: number;
}

export interface ScorePipelineResult {
	categories: CategoryAggregateResult[];
	radarScores: RadarAxisScores;
	totalEarned: number;
	totalMax: number;
	normalizedTotalScore: number;
	defectCount: number;
	warningCount: number;
}

function finiteNumber(n: unknown, fallback = 0): number {
	const value = typeof n === 'number' ? n : Number(n);
	return Number.isFinite(value) ? value : fallback;
}

/** Clamp earned points into `[0, maxScore]`. Non-finite → 0. */
export function clampEarned(earned: unknown, maxScore: unknown): number {
	const max = finiteNumber(maxScore, 0);
	const raw = finiteNumber(earned, 0);
	if (max <= 0) return 0;
	return roundRawPoints(Math.min(max, Math.max(0, raw)));
}

export function ruleVerdict(item: CategoryChecklistItem): 'pass' | 'warning' | 'fail' {
	if (item.status === 'pass' || item.status === 'warning' || item.status === 'fail') return item.status;
	return item.passed ? 'pass' : 'fail';
}

export function evaluateRule(item: CategoryChecklistItem): EvaluatedRule {
	const max = Math.max(0, finiteNumber(item.maxScore ?? item.weight, 0));
	const earned = clampEarned(earnedScoreForItem(item), max);
	return {
		id: (item.id || '').trim(),
		verdict: ruleVerdict(item),
		earned,
		max,
	};
}

export function sumRuleScores(items: readonly CategoryChecklistItem[]): { earned: number; max: number } {
	let earned = 0;
	let max = 0;
	for (const item of items) {
		const rule = evaluateRule(item);
		earned += rule.earned;
		max += rule.max;
	}
	return { earned: clampEarned(earned, max || earned), max: Math.max(0, max) };
}

/**
 * Rule Engine → category cards → `totalEarned / totalMax` → `normalizedTotalScore`.
 * Fail-safe: never returns NaN / null; earned never exceeds max or goes negative.
 */
export function runScorePipeline(
	checklist: readonly CategoryChecklistItem[] = [],
	isHttps = true,
): ScorePipelineResult {
	const safeItems = Array.isArray(checklist) ? checklist : [];
	const agg = calculate5CategoryScores(safeItems, isHttps !== false);
	const totalMax = finiteNumber(agg.totalMax, 0) > 0 ? agg.totalMax : CHECKLIST_TOTAL_MAX;
	const totalEarned = clampEarned(agg.totalEarned, totalMax);
	const defectCount = agg.categories.reduce((sum, cat) => sum + Math.max(0, finiteNumber(cat.defectCount)), 0);
	const warningCount = agg.categories.reduce((sum, cat) => sum + Math.max(0, finiteNumber(cat.warningCount)), 0);

	return {
		categories: agg.categories,
		radarScores: agg.radarScores,
		totalEarned,
		totalMax,
		normalizedTotalScore: normalizeTo100(totalEarned, totalMax),
		defectCount,
		warningCount,
	};
}
