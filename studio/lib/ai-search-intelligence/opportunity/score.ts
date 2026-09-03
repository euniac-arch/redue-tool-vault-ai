/**
 * Opportunity Score — DERIVED only. Never labeled as an AI-stated score.
 *
 * weighted average of 8 signals (each 0–100), weights sum to 100.
 */
import type { AsiAuditSignalId } from '@/lib/ai-search-intelligence/types';
import type { IntelligenceQueryIntent } from '@/lib/ai-search-intelligence/core/models';
import type { AsiOpportunitySignalId, AsiOpportunitySignals, AsiOpportunityStatus } from '@/lib/ai-search-intelligence/types';

export const ASI_OPPORTUNITY_WEIGHTS: Record<AsiOpportunitySignalId, number> = {
	searchIntent: 14,
	businessRelevance: 14,
	competitorPresence: 16,
	brandAbsence: 16,
	citationAvailability: 10,
	contentCoverage: 10,
	localRelevance: 10,
	improvementPotential: 10,
};

export const ASI_OPPORTUNITY_SCORE_THRESHOLD = 58;

const INTENT_SIGNAL: Record<IntelligenceQueryIntent, number> = {
	recommend: 100,
	compare: 86,
	purchase: 80,
	solve: 76,
	local: 64,
	discovery: 48,
	natural: 36,
};

function clamp(value: number): number {
	return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreOpportunitySignals(input: {
	intent: IntelligenceQueryIntent;
	query: string;
	location?: string;
	service?: string;
	status: AsiOpportunityStatus;
	mentionRate: number;
	recommendationRate: number;
	competitorCount: number;
	citationCount: number;
	ownedCitation: boolean;
	gaps: readonly AsiAuditSignalId[];
}): AsiOpportunitySignals {
	const q = input.query.toLowerCase();
	const locationHit = Boolean(input.location && q.includes(input.location.toLowerCase()));
	const serviceHit = Boolean(input.service && q.includes(input.service.toLowerCase()));
	const gapBoost = Math.min(100, input.gaps.length * 22);

	return {
		searchIntent: INTENT_SIGNAL[input.intent],
		businessRelevance: clamp((locationHit ? 50 : 20) + (serviceHit ? 50 : 20)),
		competitorPresence: input.competitorCount > 0 ? 100 : input.status === 'compete' ? 62 : 24,
		brandAbsence: clamp((1 - input.mentionRate) * 70 + (1 - input.recommendationRate) * 30),
		citationAvailability: input.ownedCitation ? 18 : input.citationCount > 0 ? 64 : 86,
		contentCoverage: gapBoost || 28,
		localRelevance: input.intent === 'local' || locationHit ? 100 : input.intent === 'recommend' ? 70 : 36,
		improvementPotential:
			input.status === 'win' ? 12 : input.status === 'miss' ? clamp(70 + gapBoost * 0.3) : clamp(58 + gapBoost * 0.2),
	};
}

export function opportunityScoreFromSignals(signals: AsiOpportunitySignals): number {
	let sum = 0;
	for (const id of Object.keys(ASI_OPPORTUNITY_WEIGHTS) as AsiOpportunitySignalId[]) {
		sum += signals[id] * ASI_OPPORTUNITY_WEIGHTS[id];
	}
	return clamp(sum / 100);
}

export function isOpportunityCandidate(status: AsiOpportunityStatus, score: number): boolean {
	return status !== 'win' && score >= ASI_OPPORTUNITY_SCORE_THRESHOLD;
}

export function opportunityReason(input: {
	status: AsiOpportunityStatus;
	intent: IntelligenceQueryIntent;
	competitor?: string;
	gaps: readonly AsiAuditSignalId[];
}): string {
	if (input.status === 'win') {
		return '이 질문에서는 브랜드가 이미 충분히 노출됩니다. 우선순위가 낮은 구간입니다.';
	}
	const competitor = input.competitor ? ` ${input.competitor} 등이 먼저 보입니다.` : ' 경쟁 후보가 답변을 선점합니다.';
	const gap = input.gaps[0]
		? ` 사이트 ${input.gaps[0]} 신호가 약해 개선 여지가 있습니다.`
		: ' FAQ·출처·엔티티 정합을 보강하면 추천 가능성이 커집니다.';
	if (input.status === 'miss') {
		return `현재 AI가 이 질문에서 브랜드를 거의 언급하지 않습니다.${competitor}${gap}`;
	}
	return `브랜드는 보이지만 추천 경쟁에서 밀립니다.${competitor}${gap}`;
}
