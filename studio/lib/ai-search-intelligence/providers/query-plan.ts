/**
 * Query → Deduplicate → Cache → Provider → Store → Score inputs.
 * One provider failure stays on that engine. The batch still succeeds.
 */
import { appendAsiCitationStore, readAsiCitationStore } from '@/lib/ai-search-intelligence/citations/store';
import { ingestAsiCompetitorResponses } from '@/lib/ai-search-intelligence/competitors/ingest';
import { brandAliases } from '@/lib/ai-search-intelligence/competitors/normalize';
import { competitorsFromObservation, toAIObservations } from '@/lib/ai-search-intelligence/core/from-asi';
import { capAsiQueries, runAsiBatches } from '@/lib/ai-search-intelligence/guard/batch';
import { getAsiRequestContext } from '@/lib/ai-search-intelligence/guard/context';
import { ASI_GUARD } from '@/lib/ai-search-intelligence/guard/limits';
import { hydrateAsiHistory } from '@/lib/ai-search-intelligence/persist/hydrate';
import { persistAsiCoreSlice, persistAsiObservations } from '@/lib/ai-search-intelligence/persist/repository';
import { queryAsiProviders } from '@/lib/ai-search-intelligence/providers/compose';
import { appendAsiSovStore } from '@/lib/ai-search-intelligence/sov/store';
import type { AIResponse, AsiEngineId } from '@/lib/ai-search-intelligence/types';

export type AsiUnavailableProvider = {
	provider: AsiEngineId;
	error: string;
};

export type AsiQueryPlanRow = {
	query: string;
	responses: AIResponse[];
	available: AsiEngineId[];
	unavailable: AsiUnavailableProvider[];
	cacheHit: boolean;
};

export function dedupeAsiQueryTexts(queries: readonly string[], limit?: number): string[] {
	return capAsiQueries(queries, limit ?? ASI_GUARD.maxQueriesPerRequest);
}

export function asiProviderAvailability(responses: readonly AIResponse[]): {
	available: AsiEngineId[];
	unavailable: AsiUnavailableProvider[];
} {
	const available: AsiEngineId[] = [];
	const unavailable: AsiUnavailableProvider[] = [];
	for (const row of responses) {
		if (row.meta?.error) {
			unavailable.push({ provider: row.provider, error: row.meta.error });
			continue;
		}
		available.push(row.provider);
	}
	return { available, unavailable };
}

function aliasesFor(brand: string, domain: string): string[] {
	return brandAliases(brand, domain);
}

function storedForQuery(domain: string, query: string): AIResponse[] {
	const needle = query.trim().toLowerCase();
	return readAsiCitationStore(domain).responses.filter((item) => item.query.trim().toLowerCase() === needle);
}

export function flattenAsiQueryPlan(rows: readonly AsiQueryPlanRow[]): AIResponse[] {
	return rows.flatMap((row) => row.responses);
}

export async function runAsiQueryPlan(input: {
	queries: readonly string[];
	url: string;
	brand: string;
	domain: string;
	location?: string;
	category?: string;
	limit?: number;
	refresh?: boolean;
}): Promise<AsiQueryPlanRow[]> {
	hydrateAsiHistory(input.domain, { brand: input.brand, url: input.url, aliases: aliasesFor(input.brand, input.domain) });
	const queries = dedupeAsiQueryTexts(input.queries, input.limit ?? ASI_GUARD.maxQueriesPerRequest);
	const aliases = aliasesFor(input.brand, input.domain);
	const rows: AsiQueryPlanRow[] = [];

	await runAsiBatches(
		queries,
		async (query) => {
			const cached = input.refresh ? [] : storedForQuery(input.domain, query);
			if (cached.length) {
				rows.push({ query, responses: cached, cacheHit: true, ...asiProviderAvailability(cached) });
				return;
			}
			const responses = await queryAsiProviders({
				query,
				url: input.url,
				brand: input.brand,
				location: input.location,
				category: input.category,
			});
			appendAsiSovStore(input.domain, responses, { brand: input.brand, aliases });
			appendAsiCitationStore(input.domain, responses, {
				brand: input.brand,
				siteUrl: input.url,
				aliases,
			});
			const observations = toAIObservations(responses, { brand: input.brand, aliases });
			ingestAsiCompetitorResponses(input.domain, responses, { brand: input.brand, aliases });
			persistAsiObservations(input.domain, responses);
			persistAsiCoreSlice(input.domain, {
				observations,
				competitors: observations.flatMap((row) => competitorsFromObservation(row)),
			});
			rows.push({ query, responses, cacheHit: false, ...asiProviderAvailability(responses) });
		},
		{ concurrency: ASI_GUARD.queryConcurrency, signal: getAsiRequestContext()?.signal },
	);

	return rows;
}
