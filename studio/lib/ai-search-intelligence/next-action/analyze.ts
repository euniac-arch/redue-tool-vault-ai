import { derivedOf } from '@/lib/ai-search-intelligence/core/models';
import type { Action } from '@/lib/ai-search-intelligence/core/models';
import { generateNextActions } from '@/lib/ai-search-intelligence/next-action/generate';
import type { LatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import type {
	AsiAgentReadinessSnapshot,
	AsiAuditBind,
	AsiAuditSignalId,
	AsiCompetitorGapSnapshot,
	AsiEvidenceExplorerSnapshot,
	AsiNextAction,
	AsiNextActionSnapshot,
	AsiOpportunitySnapshot,
	AsiSource,
	AsiWarRoomSite,
} from '@/lib/ai-search-intelligence/types';

export function coreActionFromNext(row: AsiNextAction): Action {
	return {
		id: row.id,
		title: row.title,
		reason: row.why,
		priority: derivedOf(row.priority),
		category: row.kind === 'internal_link' ? 'internal_link' : row.kind === 'youtube' ? 'youtube' : row.kind === 'external_mention' ? 'external_mention' : row.kind,
		affectedQueries: row.affectedQueries,
		expectedImpact: derivedOf(row.estimatedImpact),
		relatedPages: row.relatedPages,
	};
}

export function buildNextActionSnapshot(input: {
	site: AsiWarRoomSite;
	source: AsiSource;
	boundFromAudit: boolean;
	auditBind?: AsiAuditBind | null;
	opportunity: AsiOpportunitySnapshot | null;
	evidence: AsiEvidenceExplorerSnapshot | null;
	gap: AsiCompetitorGapSnapshot | null;
	audit: LatestAuditPayload | null | undefined;
	gaps: readonly AsiAuditSignalId[];
	readiness?: AsiAgentReadinessSnapshot | null;
	aeoWeak?: boolean;
}): AsiNextActionSnapshot {
	const actions = generateNextActions({
		opportunity: input.opportunity,
		evidence: input.evidence,
		gap: input.gap,
		audit: input.audit,
		gaps: input.gaps,
		boundFromAudit: input.boundFromAudit,
		siteUrl: input.site.url,
		site: input.site,
		readiness: input.readiness,
		aeoWeak: input.aeoWeak,
	});
	return {
		source: input.source,
		analyzedAt: new Date().toISOString(),
		boundFromAudit: input.boundFromAudit,
		auditBind: input.auditBind,
		site: input.site,
		actions,
		top: actions.slice(0, 5),
		summary: {
			total: actions.length,
			highImpact: actions.filter((item) => item.impactTier === 'high').length,
			lowEffort: actions.filter((item) => item.effortTier === 'low').length,
			ruleSet: 'v2',
		},
	};
}
