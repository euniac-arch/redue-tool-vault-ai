/**
 * Competitor Discovery → Candidate → Observed → Confirmed.
 * Stages are derived from live mention evidence only. Audit names stay candidates.
 */

export type AsiCompetitorStage = 'candidate' | 'observed' | 'confirmed';

export const ASI_COMPETITOR_CONFIRMED_MIN_QUERIES = 2;
export const ASI_COMPETITOR_CONFIRMED_MIN_PROVIDERS = 2;

export function stageAsiCompetitor(input: {
	mentionCount: number;
	queryCount: number;
	providerCount: number;
}): AsiCompetitorStage {
	if (input.mentionCount <= 0) return 'candidate';
	if (
		input.queryCount >= ASI_COMPETITOR_CONFIRMED_MIN_QUERIES ||
		input.providerCount >= ASI_COMPETITOR_CONFIRMED_MIN_PROVIDERS
	) {
		return 'confirmed';
	}
	return 'observed';
}

export function isAsiCompetitorVisible(stage: AsiCompetitorStage): boolean {
	return stage === 'observed' || stage === 'confirmed';
}
