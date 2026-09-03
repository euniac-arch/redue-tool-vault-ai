/**
 * Search Simulator observation. Built from Provider responses + Target Context.
 * Does not invent citations, competitors, or site-specific strings.
 */
import { analyzeAsiAnswer } from '@/lib/ai-search-intelligence/core/analysis';
import { nameMatchesBrand } from '@/lib/ai-search-intelligence/sov/match';
import type {
	AIResponse,
	AsiEngineId,
	AsiSearchSimulation,
	AsiSimCitation,
	AsiSimEntity,
	AsiSimRunStatus,
	AsiSimWhyItem,
	AsiTargetAppearStatus,
	AsiWarRoomSite,
} from '@/lib/ai-search-intelligence/types';

export type SimulateSearchInput = {
	query: string;
	site: AsiWarRoomSite;
	responses: readonly AIResponse[];
	aliases?: readonly string[];
};

function unique(values: readonly string[]): string[] {
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

function hasToken(text: string, token: string | undefined): boolean {
	const value = (token || '').trim();
	if (!value) return false;
	return text.toLowerCase().includes(value.toLowerCase());
}

function usable(response: AIResponse): boolean {
	return Boolean(response.answer.trim()) && !response.meta?.error;
}

export function buildSearchSimulation(input: SimulateSearchInput): AsiSearchSimulation {
	const query = input.query.trim();
	const aliases = input.aliases ?? [];
	const brand = input.site.brandName;
	const rows = input.responses;
	const live = rows.filter((item) => item.source === 'live' && usable(item));
	const fallback = rows.filter((item) => item.source === 'fallback' && usable(item));
	const mock = rows.filter((item) => item.source === 'mock' && usable(item));
	const failed = rows.filter((item) => Boolean(item.meta?.error) || item.source === 'fallback' && !item.answer.trim());
	const observed = live.length ? live : fallback.length ? fallback : [];
	const pool = observed.length ? observed : mock;

	let runStatus: AsiSimRunStatus = 'idle';
	if (live.length) runStatus = 'observed';
	else if (fallback.length) runStatus = 'fallback';
	else if (mock.length) runStatus = 'mock_preview';
	else if (rows.length && rows.every((item) => item.meta?.error || !item.answer.trim())) runStatus = 'error';
	else if (rows.length) runStatus = 'no_result';
	else if (failed.length) runStatus = 'error';
	else runStatus = query ? 'no_result' : 'idle';

	const analyses = pool.map((item) => analyzeAsiAnswer(item, { brand, aliases }));
	const recommended = analyses.some((item) => item.recommended);
	const mentioned = analyses.some((item) => item.brandMentioned);
	let targetStatus: AsiTargetAppearStatus = 'NO_DATA';
	if (runStatus === 'error' || runStatus === 'idle') targetStatus = 'NO_DATA';
	else if (runStatus === 'no_result') targetStatus = 'NO_DATA';
	else if (recommended) targetStatus = 'RECOMMENDED';
	else if (mentioned) targetStatus = 'MENTIONED';
	else targetStatus = 'NOT_FOUND';

	const mentionNames = unique(analyses.flatMap((item) => item.mentions));
	const recNames = unique(analyses.flatMap((item) => item.recommendations));
	const allNames = unique([...recNames, ...mentionNames]);
	const entities: AsiSimEntity[] = allNames.map((name) => {
		const isTarget = nameMatchesBrand(name, brand, aliases);
		return {
			name,
			role: isTarget ? 'target' : 'competitor',
			mentioned: mentionNames.some((item) => item.toLowerCase() === name.toLowerCase()) || isTarget && mentioned,
			recommended: recNames.some((item) => item.toLowerCase() === name.toLowerCase()),
		};
	});

	const citations: AsiSimCitation[] = unique(
		pool.flatMap((item) => item.citations.map((citation) => citation.url).filter(Boolean)),
	).map((url) => {
		const hit = pool.flatMap((item) => item.citations).find((citation) => citation.url === url);
		return { source: hit?.source || url, url };
	});

	const joined = pool.map((item) => item.answer).join('\n');
	const why: AsiSimWhyItem[] = [
		{ id: 'local', observed: hasToken(joined, input.site.location) },
		{ id: 'service', observed: hasToken(joined, input.site.category) },
		{ id: 'expertise', observed: /전문|expert|specialty|특화/i.test(joined) },
		{ id: 'citation', observed: citations.length > 0 },
		{ id: 'entity', observed: mentioned },
		{ id: 'third_party', observed: entities.some((item) => item.role === 'competitor') },
		{ id: 'intent', observed: /추천|recommend|best|잘하는/i.test(joined) },
	];

	const latest = pool
		.map((item) => item.timestamp)
		.filter(Boolean)
		.sort()
		.at(-1);

	return {
		query,
		runStatus,
		targetStatus,
		observedAt: latest || (pool[0]?.timestamp ?? null),
		providers: unique(pool.map((item) => item.provider)) as AsiEngineId[],
		entities,
		citations,
		citationAvailable: citations.length > 0,
		why,
		observation: {
			query,
			mentionedBrands: allNames.length,
			targetCount: mentioned || recommended ? 1 : 0,
			competitorCount: entities.filter((item) => item.role === 'competitor').length,
		},
		usableResponseCount: pool.length,
	};
}
