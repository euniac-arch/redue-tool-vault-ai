/**
 * Next Best Action runner. Reuses Opportunity / Evidence / Gap analyzers.
 * Provider I/O only through runAsiQueryPlan when the citation store is empty.
 */
import type { AsiRunInput } from '@/lib/ai-search-intelligence/adapters/port';
import { extractAsiAuditBridge, toAsiAuditBind } from '@/lib/ai-search-intelligence/audit-bridge';
import { readAsiCitationStore } from '@/lib/ai-search-intelligence/citations/store';
import { toIntelligenceQuery } from '@/lib/ai-search-intelligence/core/from-asi';
import { buildCompetitorGapSnapshot } from '@/lib/ai-search-intelligence/competitor-gap/analyze';
import { resolveSharedCompetitorNames, syncCompetitorRepository, visibleCompetitorNames } from '@/lib/ai-search-intelligence/competitors/service';
import { auditCompetitorNames, servicesFromAudit } from '@/lib/ai-search-intelligence/target';
import { buildEvidenceExplorerSnapshot } from '@/lib/ai-search-intelligence/evidence-explorer/analyze';
import { buildNextActionSnapshot, coreActionFromNext } from '@/lib/ai-search-intelligence/next-action/analyze';
import { ASI_GUARD } from '@/lib/ai-search-intelligence/guard/limits';
import { resolveAsiMockSite } from '@/lib/ai-search-intelligence/mock/resolve-site';
import { analyzeOpportunityRow, buildOpportunitySnapshot, opportunityFromRow } from '@/lib/ai-search-intelligence/opportunity/analyze';
import { generateOpportunityQueries } from '@/lib/ai-search-intelligence/opportunity/generate-queries';
import { hydrateAsiHistory } from '@/lib/ai-search-intelligence/persist/hydrate';
import { persistAsiCoreSlice } from '@/lib/ai-search-intelligence/persist/repository';
import { recordAsiVisibilitySnapshot } from '@/lib/ai-search-intelligence/visibility/store';
import { flattenAsiQueryPlan, runAsiQueryPlan } from '@/lib/ai-search-intelligence/providers/query-plan';
import type { AIResponse, AsiAuditSignalId, AsiNextActionSnapshot } from '@/lib/ai-search-intelligence/types';

const QUERY_LIMIT = 6;

function aliasesFor(brand: string, domain: string): string[] {
	const host = domain.split('.')[0] || '';
	return [brand, host].filter(Boolean);
}

function storedResponses(domain: string, query?: string): AIResponse[] {
	const rows = readAsiCitationStore(domain).responses;
	if (!query) return rows;
	return rows.filter((item) => item.query.trim().toLowerCase() === query.trim().toLowerCase());
}


function competitorsFromAudit(input: AsiRunInput): string[] {
	return auditCompetitorNames(input.audit, 2, input.url);
}

export async function runAsiNextAction(input: AsiRunInput): Promise<AsiNextActionSnapshot | null> {
	const resolved = resolveAsiMockSite(input);
	if (!resolved) return null;
	const { site, boundFromAudit } = resolved;
	const bridge = extractAsiAuditBridge(input.audit, site.url);
	const gaps = (Object.entries(bridge?.signals ?? {}) as Array<[AsiAuditSignalId, boolean]>)
		.filter(([, gap]) => gap)
		.map(([id]) => id);
	const aliases = aliasesFor(site.brandName, site.domain);
	hydrateAsiHistory(site.domain, { brand: site.brandName, url: site.url, aliases });
	syncCompetitorRepository(site.domain, { brand: site.brandName, aliases, auditNames: competitorsFromAudit(input) });
	const cached = storedResponses(site.domain);
	const limit = Math.min(QUERY_LIMIT, ASI_GUARD.maxQueriesPerRequest);
	const extra = [...(input.queries ?? []), input.query].filter((item): item is string => Boolean(item?.trim()));

	let responses: AIResponse[] = [];
	if (cached.length && extra.length === 0) {
		const liveCached = cached.filter((row) => row.source === 'live' && !row.meta?.error);
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
		if (cached.length) {
			const byKey = new Map<string, AIResponse>();
			for (const row of [...cached, ...responses]) {
				if (row.source !== 'live' || row.meta?.error) continue;
				byKey.set(`${row.provider}::${row.query.trim().toLowerCase()}`, row);
			}
			if (byKey.size) responses = [...byKey.values()];
		}
	}

	const byQuery = new Map<string, AIResponse[]>();
	for (const response of responses) {
		const key = response.query.trim();
		const list = byQuery.get(key) ?? [];
		list.push(response);
		byQuery.set(key, list);
	}
	const opportunityRows = [...byQuery.entries()].map(([query, rows]) =>
		analyzeOpportunityRow({
			query: toIntelligenceQuery({ query }, { location: site.location, service: site.category }),
			responses: rows,
			brand: site.brandName,
			aliases,
			gaps,
			location: site.location,
			service: site.category,
		}),
	);
	const live = responses.some((item) => item.source === 'live');
	const source = live ? 'live' : bridge ? 'derived' : 'mock';
	recordAsiVisibilitySnapshot({
		domain: site.domain,
		brand: site.brandName,
		aliases,
		responses,
		source,
	});
	const opportunity = buildOpportunitySnapshot({
		site,
		rows: opportunityRows,
		source,
		boundFromAudit,
		auditBind: toAsiAuditBind(bridge),
	});
	const evidence = buildEvidenceExplorerSnapshot({
		site,
		responses,
		source,
		boundFromAudit,
		auditBind: toAsiAuditBind(bridge),
		gaps,
		aliases,
	});
	syncCompetitorRepository(site.domain, {
		brand: site.brandName,
		aliases,
		auditNames: competitorsFromAudit(input),
		responses,
	});
	const gap = buildCompetitorGapSnapshot({
		site,
		responses,
		source,
		boundFromAudit,
		auditBind: toAsiAuditBind(bridge),
		gaps,
		aliases,
		knownCompetitors: resolveSharedCompetitorNames({
			domain: site.domain,
			brand: site.brandName,
			aliases,
			responses,
		}),
	});
	const snapshot = buildNextActionSnapshot({
		site,
		source,
		boundFromAudit,
		auditBind: toAsiAuditBind(bridge),
		opportunity,
		evidence,
		gap,
		audit: input.audit,
		gaps,
		aeoWeak: Boolean(bridge?.influence.readiness || bridge?.links.some((link) => link.id === 'aeo_to_readiness' && link.gap)),
	});
	persistAsiCoreSlice(site.domain, {
		opportunities: opportunity.rows.map(opportunityFromRow),
		actions: snapshot.actions.map(coreActionFromNext),
	});
	return snapshot;
}
