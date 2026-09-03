/**
 * Honest SOV sample inventory. Counts shared Query / valid answers /
 * competitor names. Does not invent a share when the sample is too small.
 */
import { readAsiCitationStore } from '@/lib/ai-search-intelligence/citations/store';
import { visibleCompetitorNames } from '@/lib/ai-search-intelligence/competitors/service';
import { isUsableAsiResponse } from '@/lib/ai-search-intelligence/sov/extract';
import { ASI_SOV_MIN_SAMPLE } from '@/lib/ai-search-intelligence/sov/calculate';
import { appendAsiSovStore, readAsiSovStore } from '@/lib/ai-search-intelligence/sov/store';
import type { AIResponse, AsiSovCoverage, AsiSovObservation } from '@/lib/ai-search-intelligence/types';

export const EMPTY_ASI_SOV_COVERAGE: AsiSovCoverage = {
	queryCount: 0,
	validResponseCount: 0,
	competitorObservationCount: 0,
	calculable: false,
};

function uniqueTexts(values: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const value = raw.trim();
		if (!value) continue;
		const key = value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(value);
	}
	return out;
}

export function buildAsiSovCoverage(input: {
	observations: readonly AsiSovObservation[];
	responses?: readonly AIResponse[];
	competitorNames?: readonly string[];
}): AsiSovCoverage {
	const live = input.observations.filter((row) => row.source === 'live');
	const responses = input.responses ?? [];
	const queryCount = uniqueTexts([
		...responses.map((row) => row.query),
		...live.map((row) => row.query),
	]).length;
	const validResponseCount = live.length;
	const fromMentions = uniqueTexts(live.flatMap((row) => row.competitorMentions));
	const competitorObservationCount = uniqueTexts([...(input.competitorNames ?? []), ...fromMentions]).length;
	return {
		queryCount,
		validResponseCount,
		competitorObservationCount,
		calculable: validResponseCount >= ASI_SOV_MIN_SAMPLE,
	};
}

/** Fold Gap / Opportunity live answers into the SOV store before scoring. */
export function mergeCitationResponsesIntoSovStore(
	domain: string,
	input: { brand: string; aliases?: readonly string[] },
) {
	const responses = readAsiCitationStore(domain).responses;
	if (responses.length) appendAsiSovStore(domain, responses, input);
}

export function collectLiveSovObservations(
	domain: string,
	input: { brand: string; aliases?: readonly string[] },
): AsiSovObservation[] {
	mergeCitationResponsesIntoSovStore(domain, input);
	return readAsiSovStore(domain).filter((row) => row.source === 'live');
}

export function sovCoverageForDomain(
	domain: string,
	observations: readonly AsiSovObservation[],
): AsiSovCoverage {
	return buildAsiSovCoverage({
		observations: observations.filter((row) => row.source === 'live'),
		responses: readAsiCitationStore(domain).responses.filter(
			(row) => row.source === 'live' || Boolean(row.meta?.error),
		),
		competitorNames: visibleCompetitorNames(domain),
	});
}

export function isUsableLiveResponse(response: AIResponse): boolean {
	return response.source === 'live' && isUsableAsiResponse(response);
}
