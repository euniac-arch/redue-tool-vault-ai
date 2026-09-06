/**
 * Browser-safe live SoV overlay helpers.
 * Must not import node:crypto or other server-only modules —
 * CompetitorSovCard is a client component.
 */

import {
	applySovQueryIndex,
	type SovAnalysisResult,
	type SovLeaderboardEntry,
	type SovQueryIntent,
	type SovQuerySlice,
} from '@/lib/audit/sov-analysis';

export type LiveSovPlacement = 'first' | 'mentioned' | 'missing';
export type LiveSovProvider = 'openai' | 'gemini' | 'estimate';
export type SovResultCtaKind = 'defend' | 'recover';

export interface LiveSovRecommendation {
	rank: number;
	name: string;
	reason: string;
	isClient: boolean;
}

export interface LiveSovSlicePayload {
	index: number;
	query: string;
	intent: SovQueryIntent;
	ownRank: 0 | 1 | 2 | 3;
	placement: LiveSovPlacement;
	currentSov: number;
	targetSov: number;
	reclaimPotential: number;
	competitorBloc: number;
	recommendations: LiveSovRecommendation[];
	leaderboard: SovLeaderboardEntry[];
	ownGoalLabel: string;
	summary: string;
	recommendationSnippet: string;
}

export interface LiveSovAnalysisResponse {
	success: true;
	cached: boolean;
	cacheKey: string;
	provider: LiveSovProvider;
	model: string;
	targetBrand: string;
	region: string;
	measuredAt: string;
	slices: LiveSovSlicePayload[];
	/** True when LLM timed out / failed and guide estimates were returned instead of a 5xx. */
	degraded?: boolean;
}

const QUERY_INTENTS: readonly SovQueryIntent[] = ['broad', 'specialty', 'problem'];

function clean(value: unknown, max = 80): string {
	if (typeof value !== 'string') return '';
	return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function fold(value: unknown): string {
	return clean(value).replace(/\s+/g, '').toLowerCase();
}

function intentOfIndex(index: number): SovQueryIntent {
	return QUERY_INTENTS[Math.min(Math.max(index, 0), QUERY_INTENTS.length - 1)] ?? 'broad';
}

export function applyLiveSovMeasurement(
	analysis: SovAnalysisResult,
	payload: Pick<LiveSovAnalysisResponse, 'slices' | 'provider' | 'cached' | 'degraded'>,
): SovAnalysisResult {
	const querySlices: SovQuerySlice[] = analysis.analyzedQueries.map((query, index) => {
		const live =
			payload.slices.find((slice) => fold(slice.query) === fold(query)) ||
			payload.slices[index] ||
			null;
		const fallback = analysis.querySlices[index];
		if (!live) return fallback;
		return {
			index,
			query: live.query || query,
			intent: live.intent || fallback?.intent || intentOfIndex(index),
			currentSov: live.currentSov,
			targetSov: live.targetSov,
			reclaimPotential: live.reclaimPotential,
			competitorBloc: live.competitorBloc,
			leaderboard: live.leaderboard,
			ownGoalLabel: live.ownGoalLabel,
			summary: live.summary,
			ownRank: live.ownRank,
			placement: live.placement,
			recommendationSnippet: live.recommendationSnippet,
		};
	}).filter((slice): slice is SovQuerySlice => Boolean(slice));

	return applySovQueryIndex(
		{
			...analysis,
			querySlices,
			liveMeasured: payload.provider !== 'estimate',
			liveProvider: payload.provider,
			liveCached: payload.cached,
			liveDegraded: payload.provider === 'estimate' || Boolean(payload.degraded),
		},
		analysis.selectedQueryIndex,
	);
}

export function resolveSovResultCta(ownRank: number | undefined, currentSov: number): SovResultCtaKind {
	if (ownRank === 1 && currentSov >= 70) return 'defend';
	return 'recover';
}
