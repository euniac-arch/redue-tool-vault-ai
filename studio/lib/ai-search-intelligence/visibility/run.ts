/**
 * Visibility Monitor runner.
 * On-demand reuses inside minInterval. Scheduler remesasure always
 * Query → Deduplicate → (no citation cache) → Provider → Store → Compare → Alert.
 */
import type { AsiRunInput } from '@/lib/ai-search-intelligence/adapters/port';
import { extractAsiAuditBridge, toAsiAuditBind } from '@/lib/ai-search-intelligence/audit-bridge';
import { AsiServiceError } from '@/lib/ai-search-intelligence/api/errors';
import { canAccessFeature } from '@/lib/ai-search-intelligence/entitlement/can-access';
import { getAsiRequestContext } from '@/lib/ai-search-intelligence/guard/context';
import { ASI_GUARD } from '@/lib/ai-search-intelligence/guard/limits';
import { resolveAsiMockSite } from '@/lib/ai-search-intelligence/mock/resolve-site';
import { generateOpportunityQueries } from '@/lib/ai-search-intelligence/opportunity/generate-queries';
import { syncCompetitorRepository, visibleCompetitorNames } from '@/lib/ai-search-intelligence/competitors/service';
import { servicesFromAudit } from '@/lib/ai-search-intelligence/target';
import { hydrateAsiHistory } from '@/lib/ai-search-intelligence/persist/hydrate';
import { persistAsiCoreSlice } from '@/lib/ai-search-intelligence/persist/repository';
import { flattenAsiQueryPlan, runAsiQueryPlan } from '@/lib/ai-search-intelligence/providers/query-plan';
import type { AsiVisibilityCadence, AsiVisibilityMonitorSnapshot } from '@/lib/ai-search-intelligence/types';
import { buildVisibilityMonitorSnapshot, coreAlertsFromMonitor } from '@/lib/ai-search-intelligence/visibility/analyze';
import { ASI_VISIBILITY_CONFIG, type AsiVisibilityCadence as ConfigCadence } from '@/lib/ai-search-intelligence/visibility/config';
import {
	enrollVisibilityJob,
	readVisibilityJob,
	readVisibilityPanel,
	writeVisibilityPanel,
} from '@/lib/ai-search-intelligence/visibility/schedule';
import { buildVisibilityRecord } from '@/lib/ai-search-intelligence/visibility/score';
import {
	appendAsiVisibilityStore,
	latestAsiVisibilityRecord,
	readAsiVisibilityStore,
	recordAsiVisibilitySnapshot,
} from '@/lib/ai-search-intelligence/visibility/store';

function aliasesFor(brand: string, domain: string): string[] {
	const host = domain.split('.')[0] || '';
	return [brand, host].filter(Boolean);
}


function isScheduleCadence(value: AsiVisibilityCadence | undefined): value is ConfigCadence {
	return value === 'daily' || value === 'weekly' || value === 'monthly';
}

function resolvePanelQueries(input: {
	site: Parameters<typeof generateOpportunityQueries>[0]['site'];
	questions?: AsiRunInput['questions'];
	services: string[];
	extra: string[];
	limit: number;
}): string[] {
	const pinned = readVisibilityPanel(input.site.domain);
	if (pinned.length) return pinned.slice(0, input.limit);
	const generated = generateOpportunityQueries({
		site: input.site,
		questions: input.questions,
		services: input.services,
		extra: input.extra,
		limit: input.limit,
	}).map((item) => item.text);
	return writeVisibilityPanel(input.site.domain, generated);
}

export async function runAsiVisibility(input: AsiRunInput): Promise<AsiVisibilityMonitorSnapshot | null> {
	const resolved = resolveAsiMockSite(input);
	if (!resolved) return null;
	const { site, boundFromAudit } = resolved;
	const bridge = extractAsiAuditBridge(input.audit, site.url);
	const aliases = aliasesFor(site.brandName, site.domain);
	hydrateAsiHistory(site.domain, { brand: site.brandName, url: site.url, aliases });
	const cadence = isScheduleCadence(input.cadence) ? input.cadence : undefined;
	const remeasure = input.remeasure === true;
	const tier = getAsiRequestContext()?.tier ?? 'pro';
	if (cadence) {
		if (!canAccessFeature({ tier }, 'visibility.schedule')) {
			throw new AsiServiceError('entitlement');
		}
		enrollVisibilityJob({ url: site.url, domain: site.domain, cadence });
	}

	const last = latestAsiVisibilityRecord(site.domain);
	const now = Date.now();
	const lastMs = last ? Date.parse(last.timestamp) : 0;
	const insideInterval = Boolean(last && Number.isFinite(lastMs) && now - lastMs < ASI_VISIBILITY_CONFIG.minIntervalMs);
	if (!remeasure && insideInterval && last) {
		return buildVisibilityMonitorSnapshot({
			site,
			source: last.source,
			boundFromAudit,
			auditBind: toAsiAuditBind(bridge),
			records: readAsiVisibilityStore(site.domain),
			reused: true,
			remeasured: false,
			nextEligibleAt: new Date(lastMs + ASI_VISIBILITY_CONFIG.minIntervalMs).toISOString(),
			enrolled: readVisibilityJob(site.domain)?.cadence ?? cadence ?? null,
		});
	}

	const extra = [...(input.queries ?? []), input.query].filter((item): item is string => Boolean(item?.trim()));
	const limit = Math.min(ASI_VISIBILITY_CONFIG.queryLimit, ASI_GUARD.maxQueriesPerRequest);
	const queries = resolvePanelQueries({
		site,
		questions: input.questions,
		services: servicesFromAudit(input, site.category),
		extra,
		limit,
	});
	const planned = await runAsiQueryPlan({
		queries,
		url: site.url,
		brand: site.brandName,
		domain: site.domain,
		location: site.location,
		category: site.category,
		limit,
		refresh: remeasure || Boolean(last),
	});
	const responses = flattenAsiQueryPlan(planned);

	const live = responses.some((item) => item.source === 'live');
	const source = live ? 'live' : bridge ? 'derived' : 'mock';
	syncCompetitorRepository(site.domain, {
		brand: site.brandName,
		aliases,
		responses,
		location: site.location,
		category: site.category,
	});
	const recordCadence = cadence ?? readVisibilityJob(site.domain)?.cadence ?? 'on_demand';
	const recorded = recordAsiVisibilitySnapshot({
		domain: site.domain,
		brand: site.brandName,
		aliases,
		responses,
		source,
		cadence: recordCadence,
	});
	const record =
		recorded ??
		buildVisibilityRecord({
			responses,
			brand: site.brandName,
			aliases,
			cadence: recordCadence,
			source,
			competitorNames: visibleCompetitorNames(site.domain),
		});
	const records = recorded ? readAsiVisibilityStore(site.domain) : appendAsiVisibilityStore(site.domain, record);
	const snapshot = buildVisibilityMonitorSnapshot({
		site,
		source,
		boundFromAudit,
		auditBind: toAsiAuditBind(bridge),
		records,
		reused: false,
		remeasured: remeasure,
		nextEligibleAt: new Date(Date.parse(record.timestamp) + ASI_VISIBILITY_CONFIG.minIntervalMs).toISOString(),
		enrolled: readVisibilityJob(site.domain)?.cadence ?? cadence ?? null,
	});
	persistAsiCoreSlice(site.domain, { alerts: coreAlertsFromMonitor(snapshot) });
	return snapshot;
}
