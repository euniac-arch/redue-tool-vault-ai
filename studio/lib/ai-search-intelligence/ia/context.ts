/**
 * IA menu context — status / score / problem / next action.
 * Reads session snapshots only. Never calls providers.
 */
import { readAsiSessionSnapshot, WAR_ROOM_CACHE_KEY } from '@/lib/ai-search-intelligence/asi-bound-url';
import { resolveAsiObservationState } from '@/lib/ai-search-intelligence/observation-state';
import type { AsiIaEntryId } from '@/lib/ai-search-intelligence/routes';
import type {
	AsiAgentReadinessSnapshot,
	AsiCompetitorGapSnapshot,
	AsiEvidenceExplorerSnapshot,
	AsiEvidenceSnapshot,
	AsiNextActionSnapshot,
	AsiOpportunitySnapshot,
	AsiPerceptionSnapshot,
	AsiRecommendationSnapshot,
	AsiVisibilityMonitorSnapshot,
	AsiWarRoomSnapshot,
} from '@/lib/ai-search-intelligence/types';

export type AsiIaStatus = 'empty' | 'ok' | 'watch' | 'problem';

export type AsiToolContext = {
	status: AsiIaStatus;
	score: number | null;
	problem: string | null;
	actionHref: string;
};

const EMPTY: AsiToolContext = { status: 'empty', score: null, problem: null, actionHref: '' };

function clampScore(value: number | null | undefined): number | null {
	if (value == null || !Number.isFinite(value)) return null;
	return Math.max(0, Math.min(100, Math.round(value)));
}

function tone(score: number | null, problem: string | null): AsiIaStatus {
	if (score == null && !problem) return 'empty';
	if (problem) return score != null && score < 40 ? 'problem' : 'watch';
	if (score != null && score < 40) return 'problem';
	if (score != null && score < 70) return 'watch';
	return 'ok';
}

function ctx(score: number | null, problem: string | null, actionHref: string): AsiToolContext {
	return { status: tone(score, problem), score, problem, actionHref };
}

export function emptyAsiToolContext(actionHref: string): AsiToolContext {
	return { ...EMPTY, actionHref };
}

export function composeAsiIaContext(): Record<AsiIaEntryId, AsiToolContext> {
	const war = readAsiSessionSnapshot<AsiWarRoomSnapshot>(WAR_ROOM_CACHE_KEY, (data) => Boolean(data?.site?.url && data.kpis));
	const opportunity = readAsiSessionSnapshot<AsiOpportunitySnapshot>(
		'asi_opportunity_snapshot',
		(data) => Boolean(data?.site?.url && Array.isArray(data.top)),
	);
	const gap = readAsiSessionSnapshot<AsiCompetitorGapSnapshot>(
		'asi_gap_snapshot',
		(data) => Boolean(data?.site?.url && Array.isArray(data.top)),
	);
	const action = readAsiSessionSnapshot<AsiNextActionSnapshot>(
		'asi_action_snapshot',
		(data) => Boolean(data?.site?.url && Array.isArray(data.top)),
	);
	const visibility = readAsiSessionSnapshot<AsiVisibilityMonitorSnapshot>(
		'asi_visibility_snapshot',
		(data) => Boolean(data?.site?.url && data.trends),
	);
	const perception = readAsiSessionSnapshot<AsiPerceptionSnapshot>(
		'asi_perception_snapshot',
		(data) => Boolean(data?.site?.url && typeof data.trustScore === 'number'),
	);
	const recommendation = readAsiSessionSnapshot<AsiRecommendationSnapshot>(
		'asi_recommendation_snapshot',
		(data) => Boolean(data?.site?.url && data.sov),
	);
	const evidence = readAsiSessionSnapshot<AsiEvidenceSnapshot>(
		'asi_evidence_snapshot',
		(data) => Boolean(data?.site?.url && Array.isArray(data.citations)),
	);
	const explorer = readAsiSessionSnapshot<AsiEvidenceExplorerSnapshot>(
		'asi_explorer_snapshot',
		(data) => Boolean(data?.site?.url && Array.isArray(data.answers)),
	);
	const readiness = readAsiSessionSnapshot<AsiAgentReadinessSnapshot>(
		'asi_agent_readiness_snapshot',
		(data) => Boolean(data?.site?.url && typeof data.overall === 'number'),
	);

	const kpis = war?.kpis;
	const topOpportunity = opportunity?.top[0];
	const topGap = gap?.top[0];
	const topAction = action?.top[0];
	const visScore = clampScore(visibility?.trends['7d']?.kpis.visibility.current ?? visibility?.latest?.visibility ?? kpis?.visibility);
	const firstAlert = visibility?.alerts[0]?.title ?? null;
	const recommendHits = recommendation?.testResults.filter((row) => row.mentionType === 'recommended').length ?? 0;
	const recommendTotal = recommendation?.testResults.length ?? 0;
	const recommendScore = recommendTotal ? clampScore((recommendHits / recommendTotal) * 100) : clampScore(kpis?.recommendationRate);
	const questionCount = evidence?.questions.length ?? 0;
	const citationScore = evidence?.citationReport.available
		? clampScore((evidence.citationReport.citedResponseCount / Math.max(1, evidence.citationReport.responseCount)) * 100)
		: null;
	const explorerScore = explorer?.summary.answers
		? clampScore((explorer.summary.withEvidence / explorer.summary.answers) * 100)
		: null;
	const liveSparse = Boolean(
		recommendation &&
			recommendation.sov.computedFrom === 'live' &&
			!(recommendation.sov.coverage?.calculable ?? recommendation.sov.sufficient),
	);
	const sovScore = liveSparse ? null : clampScore(recommendation?.sov.overall ?? kpis?.shareOfVoice);
	const trust = clampScore(perception?.trustScore ?? kpis?.trustScore);
	const readinessScore = clampScore(readiness?.overall ?? kpis?.agentReadiness);
	const blocker = war?.blockers[0]?.title ?? null;
	const competitor = recommendation?.competitors[0];
	const competitorState =
		recommendation?.observationState ??
		(recommendation
			? resolveAsiObservationState({
					analyzed: recommendation.sov.computedFrom === 'live' || recommendation.source === 'live',
					validResponseCount: recommendation.sov.coverage?.validResponseCount ?? recommendation.sov.sampleSize ?? 0,
					competitorCount: recommendation.competitors.length,
				})
			: 'NO_DATA');
	const gapState =
		gap?.summary.observationState ??
		(gap
			? resolveAsiObservationState({
					analyzed: gap.source === 'live' || (gap.summary.validResponseCount ?? 0) > 0,
					validResponseCount: gap.summary.validResponseCount ?? 0,
					competitorCount: gap.summary.competitorsObserved,
				})
			: 'NO_DATA');

	return {
		questions: questionCount
			? ctx(clampScore(Math.min(100, questionCount * 10)), null, '/intelligence/opportunity-finder')
			: emptyAsiToolContext('/intelligence/query-generator'),
		opportunity: topOpportunity
			? ctx(clampScore(topOpportunity.score), topOpportunity.status === 'miss' ? topOpportunity.query : null, '/intelligence/evidence-explorer')
			: emptyAsiToolContext('/intelligence/opportunity-finder'),
		simulator: recommendation
			? ctx(clampScore(recommendation.simulator.potential), recommendation.simulator.penalties[0]?.detail ?? null, '/intelligence/next-best-action')
			: emptyAsiToolContext('/intelligence/recommendation-simulator'),
		visibility: visScore != null || firstAlert
			? ctx(visScore, firstAlert, '/intelligence/visibility-monitor#asi-alerts')
			: emptyAsiToolContext('/intelligence/visibility-monitor'),
		'visibility-trend': visScore != null
			? ctx(visScore, firstAlert, '/intelligence/visibility-monitor#asi-trend')
			: emptyAsiToolContext('/intelligence/visibility-monitor#asi-trend'),
		alert: firstAlert
			? ctx(visScore, firstAlert, '/intelligence/visibility-monitor#asi-alerts')
			: emptyAsiToolContext('/intelligence/visibility-monitor#asi-alerts'),
		brand: trust != null
			? ctx(trust, perception?.gapNotes[0] ?? perception?.unknown[0] ?? null, '/intelligence/evidence-explorer')
			: emptyAsiToolContext('/intelligence/brand-perception'),
		sov: liveSparse
			? ctx(null, 'sample', '/intelligence/competitor-analysis')
			: sovScore != null
				? ctx(sovScore, competitor?.name ?? null, '/intelligence/competitor-analysis')
				: emptyAsiToolContext('/intelligence/share-of-voice'),
		test: recommendScore != null
			? ctx(recommendScore, recommendScore < 50 ? recommendation?.defaultQuery ?? null : null, '/intelligence/recommendation-simulator')
			: emptyAsiToolContext('/intelligence/recommendation-test'),
		explorer: explorerScore != null
			? ctx(explorerScore, explorer?.summary.unavailable ? 'unavailable' : null, '/intelligence/competitor-gap')
			: emptyAsiToolContext('/intelligence/evidence-explorer'),
		citations: citationScore != null
			? ctx(citationScore, evidence?.citationReport.available === false ? 'unavailable' : null, '/intelligence/evidence-explorer')
			: emptyAsiToolContext('/intelligence/citation-explorer'),
		reputation: trust != null
			? ctx(trust, perception?.confused[0] ?? perception?.gapNotes[0] ?? null, '/intelligence/evidence-explorer')
			: emptyAsiToolContext('/intelligence/reputation-radar'),
		competitors: competitor
			? ctx(clampScore(competitor.sharePercent), competitor.name, '/intelligence/competitor-gap')
			: competitorState === 'INSUFFICIENT_SAMPLE'
				? ctx(null, 'sample', '/intelligence/competitor-analysis')
				: competitorState === 'NO_COMPETITOR_OBSERVED'
					? ctx(null, 'noCompetitor', '/intelligence/competitor-analysis')
					: emptyAsiToolContext('/intelligence/competitor-analysis'),
		gap: topGap
			? ctx(clampScore(Math.min(100, topGap.gap)), `${topGap.competitor} · ${topGap.kind}`, '/intelligence/next-best-action')
			: gapState === 'INSUFFICIENT_SAMPLE'
				? ctx(null, 'sample', '/intelligence/competitor-gap')
				: gapState === 'NO_COMPETITOR_OBSERVED'
					? ctx(null, 'noCompetitor', '/intelligence/competitor-gap')
					: emptyAsiToolContext('/intelligence/competitor-gap'),
		action: topAction
			? ctx(clampScore(topAction.estimatedImpact), topAction.title, '/intelligence/visibility-monitor')
			: emptyAsiToolContext('/intelligence/next-best-action'),
		'agent-readiness': readinessScore != null
			? ctx(readinessScore, readiness && readiness.overall < 70 ? 'structure' : null, '/intelligence/next-best-action')
			: emptyAsiToolContext('/intelligence/agent-readiness'),
		snapshot: trust != null
			? ctx(trust, perception?.gapNotes[0] ?? null, '/intelligence/next-best-action')
			: emptyAsiToolContext('/intelligence/brand-snapshot'),
		'war-room': kpis
			? ctx(clampScore(kpis.visibility), blocker, '/intelligence/opportunity-finder')
			: emptyAsiToolContext('/intelligence'),
	};
}
