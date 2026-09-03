import type { AsiToolId } from '@/lib/ai-search-intelligence/routes';
import type { AsiSource } from '@/lib/ai-search-intelligence/types';

/** Semantic origin of a number or answer — independent of mock/live runtime. */
export type AsiProvenance = 'observed' | 'derived';

export type AsiProvenanceBadgeId =
	| 'observed'
	| 'live_result'
	| 'actual_response'
	| 'redue_analysis'
	| 'estimated'
	| 'derived_score';

/**
 * Score / field ids that carry a required tooltip.
 * Observed ids describe Provider answers. Derived ids are REDUE model output.
 */
export type AsiMetricId =
	| 'trustScore'
	| 'recommendationPotential'
	| 'agentReadiness'
	| 'readinessItem'
	| 'citationRelevance'
	| 'citationAuthority'
	| 'opportunityScore'
	| 'visibilityScore'
	| 'engineVisibility'
	| 'shareOfVoice'
	| 'recommendationRate'
	| 'perceptionAxis'
	| 'perceptionGap'
	| 'mentionRate'
	| 'citationCount'
	| 'coRecommend'
	| 'competitorIntensity'
	| 'penalty'
	| 'actualRank'
	| 'actualMention'
	| 'actualAnswer'
	| 'actualCitation'
	| 'generatedQuestions'
	| 'gapScore'
	| 'estimatedImpact';

export type AsiMetricDef = {
	id: AsiMetricId;
	provenance: AsiProvenance;
	badge: AsiProvenanceBadgeId;
};

export const ASI_METRICS: Record<AsiMetricId, AsiMetricDef> = {
	actualRank: { id: 'actualRank', provenance: 'observed', badge: 'observed' },
	actualMention: { id: 'actualMention', provenance: 'observed', badge: 'observed' },
	actualAnswer: { id: 'actualAnswer', provenance: 'observed', badge: 'actual_response' },
	actualCitation: { id: 'actualCitation', provenance: 'observed', badge: 'observed' },
	mentionRate: { id: 'mentionRate', provenance: 'observed', badge: 'observed' },
	citationCount: { id: 'citationCount', provenance: 'observed', badge: 'observed' },
	trustScore: { id: 'trustScore', provenance: 'derived', badge: 'derived_score' },
	recommendationPotential: { id: 'recommendationPotential', provenance: 'derived', badge: 'derived_score' },
	agentReadiness: { id: 'agentReadiness', provenance: 'derived', badge: 'derived_score' },
	readinessItem: { id: 'readinessItem', provenance: 'derived', badge: 'derived_score' },
	citationRelevance: { id: 'citationRelevance', provenance: 'derived', badge: 'derived_score' },
	citationAuthority: { id: 'citationAuthority', provenance: 'derived', badge: 'derived_score' },
	opportunityScore: { id: 'opportunityScore', provenance: 'derived', badge: 'estimated' },
	visibilityScore: { id: 'visibilityScore', provenance: 'derived', badge: 'derived_score' },
	engineVisibility: { id: 'engineVisibility', provenance: 'derived', badge: 'derived_score' },
	shareOfVoice: { id: 'shareOfVoice', provenance: 'derived', badge: 'estimated' },
	recommendationRate: { id: 'recommendationRate', provenance: 'derived', badge: 'derived_score' },
	perceptionAxis: { id: 'perceptionAxis', provenance: 'derived', badge: 'derived_score' },
	perceptionGap: { id: 'perceptionGap', provenance: 'derived', badge: 'derived_score' },
	coRecommend: { id: 'coRecommend', provenance: 'derived', badge: 'estimated' },
	competitorIntensity: { id: 'competitorIntensity', provenance: 'derived', badge: 'estimated' },
	penalty: { id: 'penalty', provenance: 'derived', badge: 'redue_analysis' },
	generatedQuestions: { id: 'generatedQuestions', provenance: 'derived', badge: 'redue_analysis' },
	gapScore: { id: 'gapScore', provenance: 'derived', badge: 'estimated' },
	estimatedImpact: { id: 'estimatedImpact', provenance: 'derived', badge: 'estimated' },
};

/** Every feature must surface at least these metrics so OBSERVED vs DERIVED never mix. */
export const ASI_FEATURE_METRICS: Record<AsiToolId, readonly AsiMetricId[]> = {
	'war-room': [
		'visibilityScore',
		'recommendationRate',
		'shareOfVoice',
		'trustScore',
		'agentReadiness',
		'engineVisibility',
		'opportunityScore',
		'actualMention',
		'actualRank',
		'actualCitation',
	],
	brand: ['perceptionAxis', 'actualAnswer', 'actualMention'],
	reputation: ['trustScore', 'perceptionAxis'],
	snapshot: ['perceptionGap', 'actualAnswer'],
	test: ['actualRank', 'actualMention', 'actualAnswer'],
	simulator: ['recommendationPotential', 'penalty', 'actualAnswer', 'actualMention', 'actualCitation'],
	sov: ['shareOfVoice'],
	competitors: ['coRecommend', 'competitorIntensity'],
	citations: ['actualCitation', 'citationRelevance', 'citationAuthority'],
	questions: ['generatedQuestions', 'actualAnswer', 'actualMention', 'actualRank'],
	visibility: ['mentionRate', 'recommendationRate', 'shareOfVoice', 'citationCount', 'visibilityScore'],
	'agent-readiness': ['agentReadiness', 'readinessItem'],
	opportunity: ['opportunityScore', 'actualMention', 'actualAnswer', 'actualRank', 'generatedQuestions'],
	explorer: ['actualAnswer', 'actualMention', 'actualCitation', 'citationRelevance', 'citationCount'],
	gap: ['gapScore', 'mentionRate', 'citationCount', 'competitorIntensity', 'actualMention'],
	action: ['estimatedImpact', 'opportunityScore', 'gapScore', 'citationCount', 'generatedQuestions'],
};

export function getAsiMetric(id: AsiMetricId): AsiMetricDef {
	return ASI_METRICS[id];
}

export function isLiveObserved(source?: AsiSource, fallback?: boolean): boolean {
	return source === 'live' && !fallback;
}

export function observedBadgeForSource(
	source?: AsiSource,
	fallback?: boolean,
	variant: 'default' | 'answer' = 'default',
): AsiProvenanceBadgeId {
	if (isLiveObserved(source, fallback)) {
		return variant === 'answer' ? 'actual_response' : 'live_result';
	}
	return variant === 'answer' ? 'actual_response' : 'observed';
}

export function defaultBadgeForProvenance(kind: AsiProvenance): AsiProvenanceBadgeId {
	return kind === 'observed' ? 'observed' : 'redue_analysis';
}
