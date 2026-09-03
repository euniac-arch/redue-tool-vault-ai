import type { AsiOperation } from '@/lib/ai-search-intelligence/api/operations';
import { canAccessFeature } from '@/lib/ai-search-intelligence/entitlement/can-access';
import type { AsiActor } from '@/lib/ai-search-intelligence/entitlement/actor-model';
import type {
	AsiEvidenceExplorerSnapshot,
	AsiEvidenceSnapshot,
	AsiOpportunitySnapshot,
	AsiVisibilityMonitorSnapshot,
} from '@/lib/ai-search-intelligence/types';

function emptyWindow(current: number | null) {
	return {
		current,
		previous: null,
		change: null,
		changePct: null,
		provenance: 'observed' as const,
	};
}

export function clipAsiSnapshot<T>(operation: AsiOperation, snapshot: T, actor: AsiActor): T {
	if (operation === 'opportunity-finder' && snapshot && typeof snapshot === 'object' && 'top' in snapshot) {
		const data = snapshot as unknown as AsiOpportunitySnapshot;
		const limit = canAccessFeature(actor, 'opportunity.basic') ? actor.limits.opportunityRows : Math.min(1, actor.limits.opportunityRows);
		return {
			...data,
			top: data.top.slice(0, limit),
			rows: data.rows.slice(0, limit),
		} as T;
	}

	if (operation === 'evidence-explorer' && snapshot && typeof snapshot === 'object' && 'answers' in snapshot) {
		const data = snapshot as unknown as AsiEvidenceExplorerSnapshot;
		const limit = canAccessFeature(actor, 'evidence.explorer')
			? actor.limits.evidenceAnswers
			: canAccessFeature(actor, 'evidence.basic')
				? actor.limits.evidenceAnswers
				: Math.min(1, actor.limits.evidenceAnswers);
		const answers = data.answers.slice(0, limit);
		return {
			...data,
			answers,
			summary: {
				...data.summary,
				answers: answers.length,
				withEvidence: answers.filter((row) => row.evidenceAvailable).length,
				unavailable: answers.filter((row) => !row.evidenceAvailable).length,
			},
		} as T;
	}

	if (operation === 'citation-explorer' && snapshot && typeof snapshot === 'object' && 'citations' in snapshot) {
		const data = snapshot as unknown as AsiEvidenceSnapshot;
		if (canAccessFeature(actor, 'evidence.basic')) return snapshot;
		return { ...data, citations: data.citations.slice(0, 1) } as T;
	}

	if (operation === 'visibility-monitor' && snapshot && typeof snapshot === 'object' && 'trends' in snapshot) {
		const data = snapshot as unknown as AsiVisibilityMonitorSnapshot;
		if (canAccessFeature(actor, 'visibility.monitor')) return snapshot;
		const current = data.latest?.visibility ?? data.trends.today?.kpis.visibility.current ?? null;
		const blank = emptyWindow(current);
		return {
			...data,
			alerts: canAccessFeature(actor, 'visibility.alert') ? data.alerts : [],
			enrolled: canAccessFeature(actor, 'visibility.schedule') ? data.enrolled : null,
			comparison: null,
			trends: {
				today: data.trends.today,
				'7d': { ...data.trends['7d'], kpis: { ...data.trends['7d'].kpis, visibility: blank }, points: data.trends.today.points.slice(-1), hasPrevious: false },
				'30d': { ...data.trends['30d'], kpis: { ...data.trends['30d'].kpis, visibility: blank }, points: data.trends.today.points.slice(-1), hasPrevious: false },
			},
		} as T;
	}

	return snapshot;
}
