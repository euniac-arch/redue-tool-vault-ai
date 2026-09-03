import type { LatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import type {
	AsiAgentReadinessSnapshot,
	AsiEvidenceSnapshot,
	AsiPerceptionSnapshot,
	AsiQuestionInput,
	AsiRecommendationSnapshot,
	AsiOpportunitySnapshot,
	AsiEvidenceExplorerSnapshot,
	AsiCompetitorGapSnapshot,
	AsiNextActionSnapshot,
	AsiVisibilityCadence,
	AsiVisibilityMonitorSnapshot,
	AsiWarRoomSnapshot,
} from '@/lib/ai-search-intelligence/types';

export type AsiRunInput = {
	url: string;
	query?: string;
	queries?: string[];
	expandSov?: boolean;
	expandCitations?: boolean;
	probeQueries?: boolean;
	audit?: LatestAuditPayload | null;
	questions?: Partial<AsiQuestionInput>;
	cadence?: Exclude<AsiVisibilityCadence, 'on_demand'>;
	/** User-initiated re-run. Replaces cache for this query only. */
	refresh?: boolean;
	/** Set only by the scheduler. HTTP must never copy this from the body. */
	remeasure?: boolean;
};

export type AsiServiceAction =
	| 'war-room'
	| 'perception'
	| 'recommendation'
	| 'evidence'
	| 'agent-readiness'
	| 'opportunity'
	| 'explorer'
	| 'gap'
	| 'action'
	| 'visibility';

/** Snapshots only. UI and the HTTP client never import providers. */
export type AsiEnginePort = {
	loadWarRoom(input: AsiRunInput): Promise<AsiWarRoomSnapshot | null>;
	loadPerception(input: AsiRunInput): Promise<AsiPerceptionSnapshot | null>;
	loadRecommendation(input: AsiRunInput): Promise<AsiRecommendationSnapshot | null>;
	loadEvidence(input: AsiRunInput): Promise<AsiEvidenceSnapshot | null>;
	loadAgentReadiness(input: AsiRunInput): Promise<AsiAgentReadinessSnapshot | null>;
	loadOpportunity(input: AsiRunInput): Promise<AsiOpportunitySnapshot | null>;
	loadExplorer(input: AsiRunInput): Promise<AsiEvidenceExplorerSnapshot | null>;
	loadGap(input: AsiRunInput): Promise<AsiCompetitorGapSnapshot | null>;
	loadAction(input: AsiRunInput): Promise<AsiNextActionSnapshot | null>;
	loadVisibility(input: AsiRunInput): Promise<AsiVisibilityMonitorSnapshot | null>;
};
