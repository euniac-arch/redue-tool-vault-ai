/**
 * Compatibility helpers for ranking surfaces. Official TOP / champion lists
 * are computed from the live catalog (traffic + score) — there is no
 * hardcoded tool-name table.
 */

import type { AiTool, AiToolCategoryId } from '@/lib/admin/ai-tools-management';
import { AI_TOOL_CATEGORIES } from '@/lib/admin/ai-tools-management';
import {
	analyzeDailyRankings,
	computeDailyRankings,
	type RankedLiveAiTool,
} from '@/lib/ai-hub/live-ai-rankings';

export { AI_RANKING_SOURCE_CAPTION } from '@/lib/ai-hub/live-ai-rankings';

export type RankedAiTool = RankedLiveAiTool;

export type ResolvedCategoryChampion = {
	key: string;
	categoryLabel: string;
	tool: RankedLiveAiTool;
};

function isRanked(tools: AiTool[]): tools is RankedLiveAiTool[] {
	const first = tools[0] as RankedLiveAiTool | undefined;
	return Boolean(first && typeof first.currentRank === 'number' && typeof first.globalSharePct === 'number');
}

function asRanked(tools: AiTool[], date: Date = new Date()): RankedLiveAiTool[] {
	if (isRanked(tools)) return tools;
	return computeDailyRankings(tools, new Map(), date.toISOString());
}

/** Overlay live category / global share onto a catalog list for the local day. */
export function applyUnifiedDailyStats(tools: AiTool[], date: Date = new Date()): RankedLiveAiTool[] {
	return asRanked(tools, date);
}

/** Global TOP N by live traffic index — same order as the daily API. */
export function resolveOfficialGlobalTop(tools: AiTool[], limit = 10, date: Date = new Date()): RankedLiveAiTool[] {
	return asRanked(tools, date)
		.slice()
		.sort((a, b) => a.currentRank - b.currentRank)
		.slice(0, limit);
}

/** Per-category #1 by live recommendation score (ties break on traffic). */
export function resolveOfficialCategoryChampions(tools: AiTool[], date: Date = new Date()): ResolvedCategoryChampion[] {
	const ranked = asRanked(tools, date);
	const labels = Object.fromEntries(AI_TOOL_CATEGORIES.map((category) => [category.id, category.label]));
	return analyzeDailyRankings(ranked, labels).categoryChampions;
}

export type { AiToolCategoryId };
