/**
 * Common competitor repository. Intelligence / Gap / SOV / NBA / Opportunity /
 * Visibility read this dataset after sync — never a per-page invented list.
 */
import { observedCompetitorNames } from '@/lib/ai-search-intelligence/competitor-gap/rates';
import { rebuildAsiCompetitorRegistry } from '@/lib/ai-search-intelligence/competitors/ingest';
import { brandAliases } from '@/lib/ai-search-intelligence/competitors/normalize';
import type { AsiDatasetScope } from '@/lib/ai-search-intelligence/competitors/scope';
import { readAsiCompetitorRoster, type AsiCompetitorRecord } from '@/lib/ai-search-intelligence/competitors/store';
import type { CompetitorObservation } from '@/lib/ai-search-intelligence/core/models';
import type { AIResponse } from '@/lib/ai-search-intelligence/types';

function uniqueNames(values: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const value = raw.trim();
		if (!value) continue;
		const key = value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(value);
	}
	return out;
}

export function syncCompetitorRepository(
	scope: string | AsiDatasetScope,
	input: {
		brand: string;
		aliases?: readonly string[];
		auditNames?: readonly string[];
		responses?: readonly AIResponse[];
		observations?: readonly CompetitorObservation[];
		location?: string;
		category?: string;
		industry?: string;
		services?: readonly string[];
	},
): AsiCompetitorRecord[] {
	const domain = typeof scope === 'string' ? scope : scope.domain;
	return rebuildAsiCompetitorRegistry(scope, {
		...input,
		aliases: input.aliases ?? brandAliases(input.brand, domain),
	});
}

/** Observed + confirmed only. Candidates stay off Intelligence and Gap. */
export function visibleCompetitorRecords(scope: string | AsiDatasetScope): AsiCompetitorRecord[] {
	return readAsiCompetitorRoster(scope);
}

export function visibleCompetitorNames(scope: string | AsiDatasetScope): string[] {
	return visibleCompetitorRecords(scope).map((row) => row.competitorName || row.name);
}

export function visibleCompetitorEntities(scope: string | AsiDatasetScope): AsiCompetitorRecord[] {
	return visibleCompetitorRecords(scope);
}

/**
 * Shared name list: repository first, plus any names in the current responses.
 * After sync the two sets match. Union prevents a page-local miss.
 */
export function resolveSharedCompetitorNames(input: {
	domain: string;
	brand: string;
	aliases?: readonly string[];
	responses?: readonly AIResponse[];
	scope?: string | AsiDatasetScope;
}): string[] {
	const scope = input.scope ?? input.domain;
	const aliases = input.aliases ?? brandAliases(input.brand, input.domain);
	const fromResponses = input.responses?.length
		? observedCompetitorNames({
				responses: input.responses,
				brand: input.brand,
				aliases,
			})
		: [];
	return uniqueNames([...visibleCompetitorNames(scope), ...fromResponses]);
}
