/**
 * Shared Opportunity Finder runner. Reuses audit site context + citation store.
 * Never re-crawls. Provider I/O only for queries missing from the store.
 */
import type { AsiRunInput } from '@/lib/ai-search-intelligence/adapters/port';
import { extractAsiAuditBridge, toAsiAuditBind } from '@/lib/ai-search-intelligence/audit-bridge';
import { readAsiCitationStore } from '@/lib/ai-search-intelligence/citations/store';
import { getAsiRequestContext } from '@/lib/ai-search-intelligence/guard/context';
import { ASI_GUARD } from '@/lib/ai-search-intelligence/guard/limits';
import { resolveAsiMockSite } from '@/lib/ai-search-intelligence/mock/resolve-site';
import { visibleCompetitorNames, syncCompetitorRepository } from '@/lib/ai-search-intelligence/competitors/service';
import { auditCompetitorNames, servicesFromAudit } from '@/lib/ai-search-intelligence/target';
import { analyzeOpportunityRow, buildOpportunitySnapshot, opportunityFromRow } from '@/lib/ai-search-intelligence/opportunity/analyze';
import { ASI_OPPORTUNITY_QUERY_LIMIT, generateOpportunityQueries } from '@/lib/ai-search-intelligence/opportunity/generate-queries';
import { hydrateAsiHistory } from '@/lib/ai-search-intelligence/persist/hydrate';
import { persistAsiCoreSlice } from '@/lib/ai-search-intelligence/persist/repository';
import { recordAsiVisibilitySnapshot } from '@/lib/ai-search-intelligence/visibility/store';
import { runAsiQueryPlan } from '@/lib/ai-search-intelligence/providers/query-plan';
import type { AIResponse, AsiAuditSignalId, AsiOpportunitySnapshot } from '@/lib/ai-search-intelligence/types';

function aliasesFor(brand: string, domain: string): string[] {
	const host = domain.split('.')[0] || '';
	return [brand, host].filter(Boolean);
}

function competitorsFromAudit(input: AsiRunInput): string[] {
	return auditCompetitorNames(input.audit, 2);
}

function storedForQuery(domain: string, query: string): AIResponse[] {
	const needle = query.trim().toLowerCase();
	return readAsiCitationStore(domain).responses.filter((item) => item.query.trim().toLowerCase() === needle);
}

export async function runAsiOpportunity(input: AsiRunInput): Promise<AsiOpportunitySnapshot | null> {
	const resolved = resolveAsiMockSite(input);
	if (!resolved) return null;
	const { site, boundFromAudit } = resolved;
	const bridge = extractAsiAuditBridge(input.audit, site.url);
	const gaps = (Object.entries(bridge?.signals ?? {}) as Array<[AsiAuditSignalId, boolean]>)
		.filter(([, gap]) => gap)
		.map(([id]) => id);
	const services = servicesFromAudit(input, site.category);
	const aliases = aliasesFor(site.brandName, site.domain);
	hydrateAsiHistory(site.domain, { brand: site.brandName, url: site.url, aliases });
	syncCompetitorRepository(site.domain, { brand: site.brandName, aliases, auditNames: competitorsFromAudit(input) });
	const queries = generateOpportunityQueries({
		site,
		questions: input.questions,
		services,
		competitors: [...visibleCompetitorNames(site.domain), ...competitorsFromAudit(input)],
		extra: input.queries,
		limit: Math.min(
			ASI_OPPORTUNITY_QUERY_LIMIT,
			getAsiRequestContext()?.limits?.queries ?? ASI_GUARD.maxQueriesPerRequest,
		),
	});

	const queryLimit = Math.min(
		ASI_OPPORTUNITY_QUERY_LIMIT,
		getAsiRequestContext()?.limits?.queries ?? ASI_GUARD.maxQueriesPerRequest,
	);
	const responsesByQuery = new Map<string, AIResponse[]>();
	const missing: string[] = [];
	for (const item of queries) {
		const cached = input.refresh ? [] : storedForQuery(site.domain, item.text);
		if (cached.length) {
			responsesByQuery.set(item.text, cached);
			continue;
		}
		missing.push(item.text);
	}
	if (missing.length) {
		const planned = await runAsiQueryPlan({
			queries: missing,
			url: site.url,
			brand: site.brandName,
			domain: site.domain,
			location: site.location,
			category: site.category,
			limit: queryLimit,
			refresh: input.refresh,
		});
		for (const row of planned) responsesByQuery.set(row.query, row.responses);
	}
	const plannedResponses = [...responsesByQuery.values()].flat();

	const rows = queries.map((query) =>
		analyzeOpportunityRow({
			query,
			responses: responsesByQuery.get(query.text) ?? [],
			brand: site.brandName,
			aliases,
			gaps,
			location: query.location || site.location,
			service: query.service || site.category,
		}),
	);
	const live = plannedResponses.some((item) => item.source === 'live');
	recordAsiVisibilitySnapshot({
		domain: site.domain,
		brand: site.brandName,
		aliases,
		responses: plannedResponses,
		source: live ? 'live' : bridge ? 'derived' : 'mock',
	});
	const snapshot = buildOpportunitySnapshot({
		site,
		rows,
		source: live ? 'live' : bridge ? 'derived' : 'mock',
		boundFromAudit,
		auditBind: toAsiAuditBind(bridge),
	});
	persistAsiCoreSlice(site.domain, { opportunities: snapshot.rows.map(opportunityFromRow) });
	return snapshot;
}
