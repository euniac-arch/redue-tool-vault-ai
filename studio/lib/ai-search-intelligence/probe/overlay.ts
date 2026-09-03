import type { AsiRunInput } from '@/lib/ai-search-intelligence/adapters/port';
import { buildAsiQueryRun, normalizeProbeQueries } from '@/lib/ai-search-intelligence/probe/run';
import { appendAsiQueryRun, latestAsiQueryProbeReport } from '@/lib/ai-search-intelligence/probe/store';
import type { AIResponse, AsiEvidenceSnapshot } from '@/lib/ai-search-intelligence/types';

function aliasesFor(brand: string, domain: string): string[] {
	const host = domain.split('.')[0] || '';
	return [brand, host].filter(Boolean);
}

export async function attachAsiQueryProbe(
	snapshot: AsiEvidenceSnapshot,
	input: AsiRunInput,
	runResponses: (queries: string[]) => Promise<AIResponse[]>,
): Promise<AsiEvidenceSnapshot> {
	if (!input.probeQueries || !input.queries?.length) {
		return { ...snapshot, queryProbe: latestAsiQueryProbeReport(snapshot.site.domain) };
	}
	const queries = normalizeProbeQueries(input.queries);
	const responses = await runResponses(queries);
	const run = buildAsiQueryRun({
		siteUrl: snapshot.site.url,
		brand: snapshot.site.brandName,
		aliases: aliasesFor(snapshot.site.brandName, snapshot.site.domain),
		queries,
		responses,
	});
	return { ...snapshot, queryProbe: appendAsiQueryRun(snapshot.site.domain, run) };
}
