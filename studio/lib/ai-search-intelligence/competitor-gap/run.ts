/**
 * Competitor Gap runner. Reuses Opportunity query set + Evidence analyzers.
 * Provider I/O only through runAsiQueryPlan when the citation store is empty.
 */
import type { AsiRunInput } from '@/lib/ai-search-intelligence/adapters/port';
import { extractAsiAuditBridge, toAsiAuditBind } from '@/lib/ai-search-intelligence/audit-bridge';
import { readAsiCitationStore } from '@/lib/ai-search-intelligence/citations/store';
import { brandAliases } from '@/lib/ai-search-intelligence/competitors/normalize';
import { resolveSharedCompetitorNames, syncCompetitorRepository, visibleCompetitorNames } from '@/lib/ai-search-intelligence/competitors/service';
import { auditCompetitorNames, servicesFromAudit } from '@/lib/ai-search-intelligence/target';
import { competitorsFromObservation, toAIObservations } from '@/lib/ai-search-intelligence/core/from-asi';
import { buildCompetitorGapSnapshot } from '@/lib/ai-search-intelligence/competitor-gap/analyze';
import { ASI_GUARD } from '@/lib/ai-search-intelligence/guard/limits';
import { resolveAsiMockSite } from '@/lib/ai-search-intelligence/mock/resolve-site';
import { generateOpportunityQueries } from '@/lib/ai-search-intelligence/opportunity/generate-queries';
import { hydrateAsiHistory } from '@/lib/ai-search-intelligence/persist/hydrate';
import { persistAsiCoreSlice } from '@/lib/ai-search-intelligence/persist/repository';
import { recordAsiVisibilitySnapshot } from '@/lib/ai-search-intelligence/visibility/store';
import { flattenAsiQueryPlan, runAsiQueryPlan } from '@/lib/ai-search-intelligence/providers/query-plan';
import type { AIResponse, AsiAuditSignalId, AsiCompetitorGapSnapshot } from '@/lib/ai-search-intelligence/types';

const QUERY_LIMIT = 6;

function aliasesFor(brand: string, domain: string): string[] {
	return brandAliases(brand, domain);
}

function storedResponses(domain: string, query?: string): AIResponse[] {
	const rows = readAsiCitationStore(domain).responses;
	if (!query) return rows;
	return rows.filter((item) => item.query.trim().toLowerCase() === query.trim().toLowerCase());
}


function competitorsFromAudit(input: AsiRunInput): string[] {
	return auditCompetitorNames(input.audit, 2);
}

function liveResponses(rows: readonly AIResponse[]): AIResponse[] {
	return rows.filter((row) => row.source === 'live' && !row.meta?.error);
}

function mergeLiveResponses(primary: readonly AIResponse[], extra: readonly AIResponse[]): AIResponse[] {
	const byKey = new Map<string, AIResponse>();
	for (const row of [...primary, ...extra]) {
		if (row.source !== 'live' || row.meta?.error) continue;
		byKey.set(`${row.provider}::${row.query.trim().toLowerCase()}`, row);
	}
	return [...byKey.values()];
}

export async function runAsiCompetitorGap(input: AsiRunInput): Promise<AsiCompetitorGapSnapshot | null> {
	const resolved = resolveAsiMockSite(input);
	if (!resolved) return null;
	const { site, boundFromAudit } = resolved;
	const bridge = extractAsiAuditBridge(input.audit, site.url);
	const gaps = (Object.entries(bridge?.signals ?? {}) as Array<[AsiAuditSignalId, boolean]>)
		.filter(([, gap]) => gap)
		.map(([id]) => id);
	const aliases = aliasesFor(site.brandName, site.domain);
	hydrateAsiHistory(site.domain, { brand: site.brandName, url: site.url, aliases });
	syncCompetitorRepository(site.domain, {
		brand: site.brandName,
		aliases,
		auditNames: competitorsFromAudit(input),
	});
	const cached = storedResponses(site.domain);
	const limit = Math.min(QUERY_LIMIT, ASI_GUARD.maxQueriesPerRequest);
	const extra = [...(input.queries ?? []), input.query].filter((item): item is string => Boolean(item?.trim()));

	let responses: AIResponse[] = [];
	if (cached.length && extra.length === 0) {
		const liveCached = liveResponses(cached);
		responses = liveCached.length ? liveCached : cached;
	} else {
		const queries = generateOpportunityQueries({
			site,
			questions: input.questions,
			services: servicesFromAudit(input, site.category),
			competitors: [...visibleCompetitorNames(site.domain), ...competitorsFromAudit(input)],
			extra,
			limit,
		});
		const planned = await runAsiQueryPlan({
			queries: queries.map((item) => item.text),
			url: site.url,
			brand: site.brandName,
			domain: site.domain,
			location: site.location,
			category: site.category,
			limit,
		});
		responses = flattenAsiQueryPlan(planned);
	}

	const analysisResponses = cached.length ? mergeLiveResponses(cached, responses) : responses;
	const live = analysisResponses.some((item) => item.source === 'live');
	recordAsiVisibilitySnapshot({
		domain: site.domain,
		brand: site.brandName,
		aliases,
		responses: analysisResponses,
		source: live ? 'live' : bridge ? 'derived' : 'mock',
	});
	syncCompetitorRepository(site.domain, {
		brand: site.brandName,
		aliases,
		auditNames: competitorsFromAudit(input),
		responses: analysisResponses,
	});
	const snapshot = buildCompetitorGapSnapshot({
		site,
		responses: analysisResponses.length ? analysisResponses : responses,
		source: live ? 'live' : bridge ? 'derived' : 'mock',
		boundFromAudit,
		auditBind: toAsiAuditBind(bridge),
		gaps,
		aliases,
		knownCompetitors: resolveSharedCompetitorNames({
			domain: site.domain,
			brand: site.brandName,
			aliases,
			responses: analysisResponses.length ? analysisResponses : responses,
		}),
	});
	persistAsiCoreSlice(site.domain, {
		competitors: toAIObservations(analysisResponses.length ? analysisResponses : responses, {
			brand: site.brandName,
			aliases,
		}).flatMap((row) => competitorsFromObservation(row)),
	});
	return snapshot;
}
