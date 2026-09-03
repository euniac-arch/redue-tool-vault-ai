import { extractAsiSovObservations } from '@/lib/ai-search-intelligence/sov/extract';
import { nameMatchesBrand } from '@/lib/ai-search-intelligence/sov/match';
import { ASI_ENGINES } from '@/lib/ai-search-intelligence/types';
import type {
	AIResponse,
	AsiEngineId,
	AsiSource,
	AsiVisibilityCadence,
	AsiVisibilityQueryMetric,
	AsiVisibilityRecord,
} from '@/lib/ai-search-intelligence/types';

function clamp(value: number): number {
	return Math.max(0, Math.min(100, Math.round(value)));
}

function rate(hits: number, total: number): number {
	if (total <= 0) return 0;
	return clamp((hits / total) * 100);
}

function mix(mention: number, recommendation: number): number {
	return clamp(mention * 0.7 + recommendation * 0.3);
}

function entityHit(
	response: AIResponse,
	name: string,
	aliases: readonly string[],
): { mentioned: boolean; recommended: boolean } {
	const names = [...response.mentions, ...response.recommendations];
	const mentioned =
		names.some((item) => nameMatchesBrand(item, name, aliases)) ||
		nameMatchesBrand(response.answer.slice(0, 200), name, aliases);
	const recommended = response.recommendations.some((item) => nameMatchesBrand(item, name, aliases));
	return { mentioned, recommended };
}

export function buildVisibilityRecord(input: {
	responses: readonly AIResponse[];
	brand: string;
	aliases?: readonly string[];
	timestamp?: string;
	cadence?: AsiVisibilityCadence;
	source: AsiSource;
	competitorNames?: readonly string[];
}): AsiVisibilityRecord {
	const aliases = input.aliases ?? [];
	const rows = extractAsiSovObservations(input.responses, { brand: input.brand, aliases });
	const sample = rows.length;
	const mentioned = rows.filter((row) => row.brandMentioned).length;
	const recommended = rows.filter((row) => row.recommended).length;
	const cited = rows.filter((row) => row.citations.length > 0).length;
	const mention = rate(mentioned, sample);
	const recommendation = rate(recommended, sample);
	const citation = rate(cited, sample);
	const universe = rows.reduce((sum, row) => sum + (row.brandMentioned ? 1 : 0) + row.competitorMentions.length, 0);
	const sov = universe > 0 ? clamp((mentioned / universe) * 100) : 0;

	const providerScores: Partial<Record<AsiEngineId, number>> = {};
	for (const engine of ASI_ENGINES) {
		const slice = rows.filter((row) => row.provider === engine);
		if (!slice.length) continue;
		providerScores[engine] = mix(
			rate(slice.filter((row) => row.brandMentioned).length, slice.length),
			rate(slice.filter((row) => row.recommended).length, slice.length),
		);
	}

	const fromAnswers = [...new Set(rows.flatMap((row) => row.competitorMentions))].filter(
		(name) => !nameMatchesBrand(name, input.brand, aliases),
	);
	const competitorNames = [
		...new Set([...(input.competitorNames ?? []), ...fromAnswers].map((name) => name.trim()).filter(Boolean)),
	].filter((name) => !nameMatchesBrand(name, input.brand, aliases));
	const competitorScores: Record<string, number> = {};
	for (const name of competitorNames) {
		let hit = 0;
		let rec = 0;
		for (const response of input.responses) {
			const found = entityHit(response, name, []);
			if (found.mentioned) hit += 1;
			if (found.recommended) rec += 1;
		}
		competitorScores[name] = mix(rate(hit, input.responses.length), rate(rec, input.responses.length));
	}

	const byQuery = new Map<string, AsiVisibilityQueryMetric>();
	for (const query of [...new Set(rows.map((row) => row.query))]) {
		const slice = rows.filter((row) => row.query === query);
		byQuery.set(query, {
			query,
			mentionRate: rate(slice.filter((row) => row.brandMentioned).length, slice.length),
			recommendationRate: rate(slice.filter((row) => row.recommended).length, slice.length),
			citationRate: rate(slice.filter((row) => row.citations.length > 0).length, slice.length),
		});
	}

	return {
		timestamp: input.timestamp || new Date().toISOString(),
		cadence: input.cadence ?? 'on_demand',
		queryCount: new Set(rows.map((row) => row.query)).size,
		mention,
		visibility: mix(mention, recommendation),
		recommendation,
		citation,
		sov,
		providerScores,
		competitorScores,
		queries: [...byQuery.values()],
		source: input.source,
	};
}
