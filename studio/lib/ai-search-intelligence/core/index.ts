/**
 * AI Intelligence Core — the only public entry for shared contracts.
 *
 * 12 tools are views over this engine. Do not add per-page:
 * API calls, data models, analysis, mock shapes, or card/chart primitives.
 *
 * The 5 additive features consume `Query` / `AIObservation` / … from
 * `core/models.ts` and map existing snapshots through `core/from-asi.ts`.
 * They must not call OpenAI / Gemini / Perplexity / Anthropic adapters.
 *
 * Q1  OpenAI call sites: providers/openai-provider.ts (via providers/http.ts)
 * Q2  Gemini call sites: providers/gemini-provider.ts (via providers/http.ts)
 * Q3  SOV calculator: sov/calculate.ts
 * Q4  Citation URL parse: citations/classify.ts + citations/normalize.ts
 *     (providers/normalize.ts delegates kind classification)
 * Q5  Recommendation parse: core/analysis.ts → providers/compose.ts
 * Q6  AIQuery: types.ts (one definition — provider transport)
 * Q7  AIResponse: types.ts (one definition)
 * Q8  UI: components/ai-search-intelligence/primitives
 */
export {
	analyzeAsiAnswer,
	citationsFromResponse,
	recommendationFromAnalysis,
} from '@/lib/ai-search-intelligence/core/analysis';
export type { AsiAnswerAnalysis } from '@/lib/ai-search-intelligence/core/analysis';
export { aggregateAsiWarRoom } from '@/lib/ai-search-intelligence/core/aggregate-war-room';
export {
	aiQueriesToIntelligenceQueries,
	extraStringsToQueries,
	generatedQuestionsToQueries,
	intelligenceQueryToAIQuery,
	toAsiProviderQuery,
	toAsiProviderQueryFromIntelligence,
	toAsiSovQuery,
} from '@/lib/ai-search-intelligence/core/query-pipeline';
export {
	actionFromOpportunity,
	alertFromDelta,
	buildIntelligenceCore,
	competitorsFromObservation,
	competitorsFromResponse,
	derivedQueryPriority,
	evidenceFromCitationResult,
	evidenceFromExplorerRow,
	evidenceFromNormalized,
	opportunitiesFromWarRoom,
	opportunityFromRow,
	toAIObservation,
	toAIObservations,
	toAIQuery,
	toIntelligenceQuery,
	visibilityFromObservations,
} from '@/lib/ai-search-intelligence/core/from-asi';
export {
	derivedOf,
	emptyIntelligenceCore,
	INTELLIGENCE_CORE_PROVENANCE,
	observedOf,
} from '@/lib/ai-search-intelligence/core/models';
export type {
	Action,
	AIObservation,
	Alert,
	CompetitorObservation,
	DerivedValue,
	Evidence,
	IntelligenceActionCategory,
	IntelligenceAlertSeverity,
	IntelligenceAlertType,
	IntelligenceCoreBundle,
	IntelligenceQueryCategory,
	IntelligenceQueryIntent,
	ObservedValue,
	Opportunity,
	Query,
	VisibilitySnapshot,
} from '@/lib/ai-search-intelligence/core/models';

export type {
	AIQuery,
	AIResponse,
	AgentReadinessResult,
	BrandPerceptionResult,
	CitationResult,
	CompetitorResult,
	RecommendationResult,
	ReputationResult,
	SOVResult,
	VisibilityResult,
} from '@/lib/ai-search-intelligence/types';
