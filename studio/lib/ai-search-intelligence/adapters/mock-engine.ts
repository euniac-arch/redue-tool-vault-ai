import { overlayLiveCompetitors, warRoomCompetitorsFromRegistry } from '@/lib/ai-search-intelligence/competitors/overlay';
import { syncCompetitorRepository } from '@/lib/ai-search-intelligence/competitors/service';
import { runAsiCompetitorGap } from '@/lib/ai-search-intelligence/competitor-gap/run';
import { runAsiNextAction } from '@/lib/ai-search-intelligence/next-action/run';
import { runAsiVisibility } from '@/lib/ai-search-intelligence/visibility/run';
import { runAsiEvidenceExplorer } from '@/lib/ai-search-intelligence/evidence-explorer/run';
import { runAsiOpportunity } from '@/lib/ai-search-intelligence/opportunity/run';
import { buildMockAgentReadinessSnapshot } from '@/lib/ai-search-intelligence/mock/build-mock-agent-readiness';
import { buildMockEvidenceSnapshot } from '@/lib/ai-search-intelligence/mock/build-mock-evidence';
import { buildMockPerceptionSnapshot } from '@/lib/ai-search-intelligence/mock/build-mock-perception';
import { buildMockRecommendationSnapshot } from '@/lib/ai-search-intelligence/mock/build-mock-recommendation';
import { attachAsiLoop } from '@/lib/ai-search-intelligence/loop/compose';
import { buildMockWarRoomSnapshot } from '@/lib/ai-search-intelligence/mock/build-mock-war-room';
import { attachAsiQueryProbe } from '@/lib/ai-search-intelligence/probe/overlay';
import { runMockAsiQueryResponses } from '@/lib/ai-search-intelligence/probe/mock-responses';
import type { AsiEnginePort } from '@/lib/ai-search-intelligence/adapters/port';

export const mockAsiEngine: AsiEnginePort = {
	async loadWarRoom(input) {
		const snapshot = buildMockWarRoomSnapshot(input);
		if (!snapshot) return null;
		syncCompetitorRepository(snapshot.site.domain, { brand: snapshot.site.brandName });
		return attachAsiLoop({
			...snapshot,
			competitors: warRoomCompetitorsFromRegistry(snapshot.site.domain),
		});
	},
	async loadPerception(input) {
		return buildMockPerceptionSnapshot(input);
	},
	async loadRecommendation(input) {
		const snapshot = buildMockRecommendationSnapshot(input);
		return snapshot ? overlayLiveCompetitors(snapshot) : null;
	},
	async loadEvidence(input) {
		const snapshot = buildMockEvidenceSnapshot(input);
		if (!snapshot) return null;
		return attachAsiQueryProbe(snapshot, input, (queries) =>
			runMockAsiQueryResponses({
				queries,
				url: snapshot.site.url,
				brand: snapshot.site.brandName,
				location: snapshot.site.location,
				category: snapshot.site.category,
			}),
		);
	},
	async loadAgentReadiness(input) {
		return buildMockAgentReadinessSnapshot(input);
	},
	async loadOpportunity(input) {
		return runAsiOpportunity(input);
	},
	async loadExplorer(input) {
		return runAsiEvidenceExplorer(input);
	},
	async loadGap(input) {
		return runAsiCompetitorGap(input);
	},
	async loadAction(input) {
		return runAsiNextAction(input);
	},
	async loadVisibility(input) {
		return runAsiVisibility(input);
	},
};
