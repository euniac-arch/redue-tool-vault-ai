/**
 * Separate "no data" / "too few answers" from "analyzed, no competitor".
 * Absence is only claimed after ASI_COMPETITOR_MIN_SAMPLE valid answers.
 */
import type { AsiObservationState } from '@/lib/ai-search-intelligence/types';

/** Valid live answers required before "no competitor observed". */
export const ASI_COMPETITOR_MIN_SAMPLE = 20;

export const ASI_OBSERVATION_STATES = [
	'NO_DATA',
	'INSUFFICIENT_SAMPLE',
	'NO_COMPETITOR_OBSERVED',
	'COMPETITORS_FOUND',
] as const;

export type AsiObservationCoverage = {
	queryCount: number;
	validResponseCount: number;
	minSample: number;
};

export function resolveAsiObservationState(input: {
	analyzed: boolean;
	validResponseCount: number;
	competitorCount: number;
	minSample?: number;
}): AsiObservationState {
	const valid = Math.max(0, input.validResponseCount);
	const competitors = Math.max(0, input.competitorCount);
	const minSample = input.minSample ?? ASI_COMPETITOR_MIN_SAMPLE;
	if (competitors > 0) return 'COMPETITORS_FOUND';
	if (!input.analyzed && valid <= 0) return 'NO_DATA';
	if (valid < minSample) return 'INSUFFICIENT_SAMPLE';
	return 'NO_COMPETITOR_OBSERVED';
}

export function isAsiCompetitorEmptyState(state: AsiObservationState): boolean {
	return state !== 'COMPETITORS_FOUND';
}
