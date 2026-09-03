import { ASI_GUARD } from '@/lib/ai-search-intelligence/guard/limits';
import { toAsiQueryProbeRecord } from '@/lib/ai-search-intelligence/probe/extract';
import type { AIResponse, AsiQueryRun } from '@/lib/ai-search-intelligence/types';

export const ASI_QUERY_PROBE_MAX = ASI_GUARD.maxQueriesPerRequest;

export function createAsiRunId(now = Date.now()): string {
	return `run_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeProbeQueries(queries: readonly string[], limit = ASI_QUERY_PROBE_MAX): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of queries) {
		const query = raw.trim();
		if (!query) continue;
		const key = query.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(query);
		if (out.length >= limit) break;
	}
	return out;
}

export function buildAsiQueryRun(input: {
	runId?: string;
	siteUrl: string;
	brand: string;
	aliases?: readonly string[];
	queries: readonly string[];
	responses: readonly AIResponse[];
	timestamp?: string;
}): AsiQueryRun {
	const runId = input.runId || createAsiRunId();
	const timestamp = input.timestamp || new Date().toISOString();
	const queries = normalizeProbeQueries(input.queries);
	return {
		runId,
		timestamp,
		siteUrl: input.siteUrl,
		brand: input.brand,
		queries,
		records: input.responses
			.filter((response) => queries.includes(response.query))
			.map((response) => toAsiQueryProbeRecord(response, { runId, brand: input.brand, aliases: input.aliases })),
	};
}
