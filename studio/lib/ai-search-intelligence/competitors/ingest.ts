/**
 * Rebuild the competitor registry from live answers + optional audit candidates.
 * Pages must not invent names — they read this roster.
 */
import { analyzeAsiAnswer } from '@/lib/ai-search-intelligence/core/analysis';
import { toCompetitorEntity } from '@/lib/ai-search-intelligence/competitors/entity';
import { stageAsiCompetitor } from '@/lib/ai-search-intelligence/competitors/lifecycle';
import {
	competitorKey,
	isOwnBrandName,
	pickCompetitorDisplayName,
} from '@/lib/ai-search-intelligence/competitors/normalize';
import { asiDatasetScopeKey, type AsiDatasetScope } from '@/lib/ai-search-intelligence/competitors/scope';
import {
	readAsiCompetitorStore,
	writeAsiCompetitorStore,
	type AsiCompetitorRecord,
} from '@/lib/ai-search-intelligence/competitors/store';
import { readAsiCitationStore } from '@/lib/ai-search-intelligence/citations/store';
import { nameMatchesBrand } from '@/lib/ai-search-intelligence/sov/match';
import { readAsiSovStore } from '@/lib/ai-search-intelligence/sov/store';
import type { CompetitorObservation } from '@/lib/ai-search-intelligence/core/models';
import type { AIResponse, AsiEngineId, AsiSovObservation } from '@/lib/ai-search-intelligence/types';

type MentionEvent = {
	name: string;
	query: string;
	provider: AsiEngineId;
	recommended: boolean;
	timestamp: string;
};

function eventKey(event: MentionEvent): string {
	return `${event.provider}::${event.query.trim().toLowerCase()}::${competitorKey(event.name)}`;
}

function eventsFromResponses(
	responses: readonly AIResponse[],
	input: {
		brand: string;
		aliases?: readonly string[];
		category?: string;
		industry?: string;
		services?: readonly string[];
	},
): MentionEvent[] {
	const out: MentionEvent[] = [];
	for (const response of responses) {
		if (response.source !== 'live' || response.meta?.error) continue;
		const analysis = analyzeAsiAnswer(response, {
			brand: input.brand,
			aliases: input.aliases,
			category: input.category,
			industry: input.industry,
			services: input.services,
		});
		for (const name of analysis.competitors) {
			if (isOwnBrandName(name, input.brand, input.aliases)) continue;
			out.push({
				name,
				query: response.query,
				provider: response.provider,
				recommended: analysis.recommendations.some((item) => nameMatchesBrand(item, name, [])),
				timestamp: response.timestamp || new Date().toISOString(),
			});
		}
	}
	return out;
}

function eventsFromSov(
	rows: readonly AsiSovObservation[],
	input: { brand: string; aliases?: readonly string[] },
): MentionEvent[] {
	const out: MentionEvent[] = [];
	for (const row of rows) {
		if (row.source !== 'live') continue;
		for (const name of row.competitorMentions) {
			if (isOwnBrandName(name, input.brand, input.aliases)) continue;
			out.push({
				name,
				query: row.query,
				provider: row.provider,
				recommended: row.recommended && row.competitorMentions.some((item) => nameMatchesBrand(item, name, [])),
				timestamp: row.timestamp,
			});
		}
	}
	return out;
}

function eventsFromObservations(
	rows: readonly CompetitorObservation[],
	input: { brand: string; aliases?: readonly string[] },
): MentionEvent[] {
	const out: MentionEvent[] = [];
	for (const row of rows) {
		if (row.competitor.provenance !== 'observed') continue;
		const name = row.competitor.value.trim();
		if (!name || isOwnBrandName(name, input.brand, input.aliases)) continue;
		out.push({
			name,
			query: row.query,
			provider: row.provider,
			recommended: row.recommendation.provenance === 'observed' && row.recommendation.value,
			timestamp: new Date().toISOString(),
		});
	}
	return out;
}

function mergeEvents(events: readonly MentionEvent[]): MentionEvent[] {
	const byKey = new Map<string, MentionEvent>();
	for (const event of events) {
		const key = eventKey(event);
		const prev = byKey.get(key);
		if (!prev) {
			byKey.set(key, event);
			continue;
		}
		byKey.set(key, {
			...prev,
			name: pickCompetitorDisplayName(prev.name, event.name),
			recommended: prev.recommended || event.recommended,
			timestamp: event.timestamp > prev.timestamp ? event.timestamp : prev.timestamp,
		});
	}
	return [...byKey.values()];
}

function entityFields(
	name: string,
	input: {
		scope: string;
		location?: string;
		category?: string;
	},
): Pick<
	AsiCompetitorRecord,
	'competitorId' | 'competitorName' | 'domain' | 'location' | 'category' | 'normalizedName' | 'entityKey' | 'aliases'
> {
	const entity = toCompetitorEntity(name, {
		scope: input.scope,
		location: input.location,
		category: input.category,
	});
	return {
		competitorId: entity?.competitorId || `${input.scope}::${competitorKey(name)}`,
		competitorName: entity?.competitorName || name,
		domain: entity?.domain,
		location: entity?.location,
		category: entity?.category,
		normalizedName: entity?.normalizedName || name,
		entityKey: entity?.entityKey || competitorKey(name),
		aliases: entity?.aliases ?? [name],
	};
}

function recordsFromEvents(
	events: readonly MentionEvent[],
	candidates: readonly string[],
	input: { brand: string; aliases?: readonly string[]; scope: string; location?: string; category?: string },
): AsiCompetitorRecord[] {
	const groups = new Map<string, MentionEvent[]>();
	for (const event of events) {
		const key = competitorKey(event.name);
		if (!key) continue;
		const list = groups.get(key) ?? [];
		list.push(event);
		groups.set(key, list);
	}

	const records: AsiCompetitorRecord[] = [];
	for (const [key, list] of groups) {
		const queries = [...new Set(list.map((item) => item.query.trim()).filter(Boolean))];
		const providers = [...new Set(list.map((item) => item.provider))];
		const engineMentions: AsiCompetitorRecord['engineMentions'] = {};
		const engineRecommends: AsiCompetitorRecord['engineRecommends'] = {};
		let recommendCount = 0;
		let name = '';
		let firstSeen = list[0]!.timestamp;
		let lastSeen = list[0]!.timestamp;
		for (const event of list) {
			name = pickCompetitorDisplayName(name, event.name);
			engineMentions[event.provider] = (engineMentions[event.provider] ?? 0) + 1;
			if (event.recommended) {
				recommendCount += 1;
				engineRecommends[event.provider] = (engineRecommends[event.provider] ?? 0) + 1;
			}
			if (event.timestamp < firstSeen) firstSeen = event.timestamp;
			if (event.timestamp > lastSeen) lastSeen = event.timestamp;
		}
		records.push({
			key,
			name,
			...entityFields(name, input),
			stage: stageAsiCompetitor({
				mentionCount: list.length,
				queryCount: queries.length,
				providerCount: providers.length,
			}),
			mentionCount: list.length,
			recommendCount,
			queries,
			providers,
			engineMentions,
			engineRecommends,
			firstSeen,
			lastSeen,
			origin: 'live',
		});
	}

	for (const raw of candidates) {
		const name = raw.trim();
		if (!name || isOwnBrandName(name, input.brand, input.aliases)) continue;
		const key = competitorKey(name);
		if (!key || records.some((row) => row.key === key)) continue;
		const now = new Date().toISOString();
		records.push({
			key,
			name,
			...entityFields(name, input),
			stage: 'candidate',
			mentionCount: 0,
			recommendCount: 0,
			queries: [],
			providers: [],
			engineMentions: {},
			engineRecommends: {},
			firstSeen: now,
			lastSeen: now,
			origin: 'audit',
		});
	}

	return records.sort((a, b) => b.mentionCount - a.mentionCount || a.name.localeCompare(b.name, 'ko'));
}

export function rebuildAsiCompetitorRegistry(
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
	const key = asiDatasetScopeKey(scope);
	const stored = readAsiCitationStore(typeof scope === 'string' ? scope : scope.domain).responses;
	const responses = input.responses ?? stored;
	const fromResponses = eventsFromResponses(responses, input);
	const events = mergeEvents([
		...fromResponses,
		...(fromResponses.length ? [] : eventsFromSov(readAsiSovStore(typeof scope === 'string' ? scope : scope.domain), input)),
		...eventsFromObservations(input.observations ?? [], input),
	]);
	const records = recordsFromEvents(events, input.auditNames ?? [], {
		...input,
		scope: key,
	});
	writeAsiCompetitorStore(scope, records);
	return records;
}

export function ingestAsiCompetitorResponses(
	scope: string | AsiDatasetScope,
	responses: readonly AIResponse[],
	input: { brand: string; aliases?: readonly string[]; auditNames?: readonly string[] },
): AsiCompetitorRecord[] {
	const domain = typeof scope === 'string' ? scope : scope.domain;
	const byKey = new Map(
		readAsiCitationStore(domain).responses.map((row) => [`${row.provider}::${row.query}`, row] as const),
	);
	for (const row of responses) {
		byKey.set(`${row.provider}::${row.query}`, row);
	}
	return rebuildAsiCompetitorRegistry(scope, {
		...input,
		responses: [...byKey.values()],
	});
}

export function observedCompetitorRosterNames(scope: string | AsiDatasetScope): string[] {
	return readAsiCompetitorStore(scope)
		.filter((row) => row.stage === 'observed' || row.stage === 'confirmed')
		.map((row) => row.name);
}

export function candidateCompetitorNames(scope: string | AsiDatasetScope): string[] {
	return readAsiCompetitorStore(scope)
		.filter((row) => row.stage === 'candidate')
		.map((row) => row.name);
}
