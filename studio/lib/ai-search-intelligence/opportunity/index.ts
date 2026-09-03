export { classifyOpportunityStatus } from '@/lib/ai-search-intelligence/opportunity/classify';
export { generateOpportunityQueries, ASI_OPPORTUNITY_QUERY_LIMIT } from '@/lib/ai-search-intelligence/opportunity/generate-queries';
export { analyzeOpportunityRow, buildOpportunitySnapshot, opportunityFromRow } from '@/lib/ai-search-intelligence/opportunity/analyze';
export {
	ASI_OPPORTUNITY_SCORE_THRESHOLD,
	ASI_OPPORTUNITY_WEIGHTS,
	isOpportunityCandidate,
	opportunityReason,
	opportunityScoreFromSignals,
	scoreOpportunitySignals,
} from '@/lib/ai-search-intelligence/opportunity/score';
export { runAsiOpportunity } from '@/lib/ai-search-intelligence/opportunity/run';
