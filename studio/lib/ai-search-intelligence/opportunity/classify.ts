import type { AsiOpportunityStatus } from '@/lib/ai-search-intelligence/types';

/**
 * DERIVED status from OBSERVED mention / recommendation / competitor facts.
 * WIN / COMPETE / MISS are mutually exclusive. OPPORTUNITY is a score flag.
 */
export function classifyOpportunityStatus(input: {
	mentionRate: number;
	recommendationRate: number;
	competitorCount: number;
}): AsiOpportunityStatus {
	const mentioned = input.mentionRate >= 0.25;
	const recommended = input.recommendationRate >= 0.25;
	const crowded = input.competitorCount > 0;

	if (mentioned && recommended && input.mentionRate >= 0.5) return 'win';
	if (mentioned && (crowded || input.recommendationRate < 0.25 || input.mentionRate < 0.75)) return 'compete';
	if (mentioned) return 'compete';
	return 'miss';
}
