/**
 * Shared Evidence Explorer runner. Provider I/O goes only through
 * `runAsiQueryPlan` → `queryAsiProviders`. Fake citations are never added.
 */
import type { AsiRunInput } from '@/lib/ai-search-intelligence/adapters/port';
import { extractAsiAuditBridge, toAsiAuditBind } from '@/lib/ai-search-intelligence/audit-bridge';
import { readAsiCitationStore } from '@/lib/ai-search-intelligence/citations/store';
import { getAsiRequestContext } from '@/lib/ai-search-intelligence/guard/context';
import { ASI_GUARD } from '@/lib/ai-search-intelligence/guard/limits';
import { resolveAsiMockSite } from '@/lib/ai-search-intelligence/mock/resolve-site';
import { generateOpportunityQueries } from '@/lib/ai-search-intelligence/opportunity/generate-queries';
import { auditCompetitorNames, servicesFromAudit } from '@/lib/ai-search-intelligence/target';
import { buildEvidenceExplorerSnapshot } from '@/lib/ai-search-intelligence/evidence-explorer/analyze';
import { hydrateAsiHistory } from '@/lib/ai-search-intelligence/persist/hydrate';
import { flattenAsiQueryPlan, runAsiQueryPlan } from '@/lib/ai-search-intelligence/providers/query-plan';
import type { AIResponse, AsiAuditSignalId, AsiEvidenceExplorerSnapshot } from '@/lib/ai-search-intelligence/types';

export const ASI_EVIDENCE_EXPLORER_QUERY_LIMIT = 6;

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
	return auditCompetitorNames(input.audit, 2);
}

export async function runAsiEvidenceExplorer(input: AsiRunInput): Promise<AsiEvidenceExplorerSnapshot | null> {
	const resolved = resolveAsiMockSite(input);
	if (!resolved) return null;
	const { site, boundFromAudit } = resolved;
	const bridge = extractAsiAuditBridge(input.audit, site.url);
	const gaps = (Object.entries(bridge?.signals ?? {}) as Array<[AsiAuditSignalId, boolean]>)
		.filter(([, gap]) => gap)
		.map(([id]) => id);
	const aliases = aliasesFor(site.brandName, site.domain);
	hydrateAsiHistory(site.domain, { brand: site.brandName, url: site.url, aliases });
	const cached = storedResponses(site.domain);
	const limit = Math.min(
		ASI_EVIDENCE_EXPLORER_QUERY_LIMIT,
		getAsiRequestContext()?.limits?.queries ?? ASI_GUARD.maxQueriesPerRequest,
	);
	const extra = [...(input.queries ?? []), input.query].filter((item): item is string => Boolean(item?.trim()));

	let responses: AIResponse[] = [];
	if (cached.length && extra.length === 0) {
		const byQuery = new Map<string, AIResponse[]>();
		for (const row of cached) {
			const key = row.query.trim().toLowerCase();
			const list = byQuery.get(key) ?? [];
			list.push(row);
			byQuery.set(key, list);
		}
		responses = [...byQuery.values()].slice(0, limit).flat();
	} else {
		const queries = generateOpportunityQueries({
			site,
			questions: input.questions,
			services: servicesFromAudit(input, site.category),
			competitors: competitorsFromAudit(input),
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

	const live = responses.some((item) => item.source === 'live');
	return buildEvidenceExplorerSnapshot({
		site,
		responses,
		source: live ? 'live' : bridge ? 'derived' : 'mock',
		boundFromAudit,
		auditBind: toAsiAuditBind(bridge),
		gaps,
		aliases,
	});
}
