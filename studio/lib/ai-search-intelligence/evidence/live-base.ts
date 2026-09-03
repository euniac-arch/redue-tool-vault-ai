import type { LatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import { extractAsiAuditBridge, toAsiAuditBind } from '@/lib/ai-search-intelligence/audit-bridge';
import { emptyAsiCitationMix } from '@/lib/ai-search-intelligence/citations/mix';
import { resolveAsiMockSite } from '@/lib/ai-search-intelligence/mock/resolve-site';
import { emptyAsiQueryProbeReport } from '@/lib/ai-search-intelligence/probe/store';
import {
	generateUniversalQueries,
	questionInputsFromContext,
	toQueryGeneration,
	universalQueriesToQuestions,
} from '@/lib/ai-search-intelligence/query-intelligence/generate';
import { resolveAsiTargetContext } from '@/lib/ai-search-intelligence/target/context';
import { syncAsiQueryPool } from '@/lib/ai-search-intelligence/target/query-pool';
import type { AsiCitationReport, AsiEvidenceSnapshot, AsiMonitorRange, AsiQuestionInput } from '@/lib/ai-search-intelligence/types';

export function unavailableLiveCitationReport(
	responseCount = 0,
	unavailableProviders: AsiCitationReport['unavailableProviders'] = [],
): AsiCitationReport {
	return {
		computedFrom: 'live',
		available: false,
		responseCount,
		citedResponseCount: 0,
		unavailableProviders,
		mix: emptyAsiCitationMix(),
		brandSupportCount: 0,
	};
}

const EMPTY_MONITOR: Record<AsiMonitorRange, AsiEvidenceSnapshot['monitor']['today']> = {
	today: [],
	'7d': [],
	'14d': [],
	'30d': [],
};

/** Live Evidence shell: site + query intel only. Never seeds dummy citations. */
export function buildEmptyLiveEvidenceSnapshot(input: {
	url: string;
	audit?: LatestAuditPayload | null;
	questions?: Partial<AsiQuestionInput>;
}): AsiEvidenceSnapshot | null {
	const resolved = resolveAsiMockSite(input);
	if (!resolved) return null;
	const { site, boundFromAudit } = resolved;
	const target = resolveAsiTargetContext(input) ?? {
		siteUrl: site.url,
		brandName: site.brandName,
		domain: site.domain,
		location: site.location,
		category: site.category,
		industry: site.category,
		services: site.category ? [site.category] : [],
		aliases: [],
		boundFromAudit,
	};
	const hasQuestionOverrides = Boolean(
		input.questions?.industry || input.questions?.location || input.questions?.service || input.questions?.target,
	);
	const generated = generateUniversalQueries(target, { limit: 16, hasQuestionOverrides });
	syncAsiQueryPool(target, { limit: 16, hasQuestionOverrides });
	const bridge = extractAsiAuditBridge(input.audit, site.url);

	return {
		source: 'live',
		analyzedAt: new Date().toISOString(),
		boundFromAudit,
		auditBind: toAsiAuditBind(bridge),
		site,
		citations: [],
		citationReport: unavailableLiveCitationReport(),
		questions: universalQueriesToQuestions(generated.items),
		questionInputs: questionInputsFromContext(target),
		queryGeneration: toQueryGeneration(generated),
		queryProbe: emptyAsiQueryProbeReport(),
		monitor: EMPTY_MONITOR,
		monitorLatest: {
			mention: 0,
			recommendationRate: 0,
			shareOfVoice: 0,
			citationCount: 0,
			visibilityScore: 0,
		},
	};
}
