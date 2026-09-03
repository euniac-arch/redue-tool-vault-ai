/**
 * Per-query brand vs competitor rates from OBSERVED answers only.
 */
import { analyzeAsiAnswer } from '@/lib/ai-search-intelligence/core/analysis';
import { competitorKey, pickCompetitorDisplayName } from '@/lib/ai-search-intelligence/competitors/normalize';
import { observedUrlsFromResponse } from '@/lib/ai-search-intelligence/evidence-explorer/urls';
import { isOwnedCitationDomain } from '@/lib/ai-search-intelligence/citations/classify';
import { nameMatchesBrand } from '@/lib/ai-search-intelligence/sov/match';
import type { AIResponse } from '@/lib/ai-search-intelligence/types';

export type CompetitorQueryRates = {
	query: string;
	sample: number;
	brandMention: number;
	brandRecommend: number;
	brandCitations: string[];
	competitorMention: number;
	competitorRecommend: number;
	competitorCitations: string[];
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

export type RankedCompetitor = {
	name: string;
	mentionCount: number;
	recommendCount: number;
};

export function observedCompetitorNames(input: {
	responses: readonly AIResponse[];
	brand: string;
	aliases?: readonly string[];
}): string[] {
	return rankObservedCompetitors(input).map((row) => row.name);
}

/** Frequency-ranked competitors parsed from live answers. Highest mention first. */
export function rankObservedCompetitors(input: {
	responses: readonly AIResponse[];
	brand: string;
	aliases?: readonly string[];
}): RankedCompetitor[] {
	const groups = new Map<string, RankedCompetitor>();
	for (const response of input.responses) {
		if (response.meta?.error) continue;
		const analysis = analyzeAsiAnswer(response, { brand: input.brand, aliases: input.aliases });
		for (const name of analysis.competitors) {
			const key = competitorKey(name);
			if (!key) continue;
			const prev = groups.get(key);
			const recommended = analysis.recommendations.some((item) => nameMatchesBrand(item, name, []));
			if (!prev) {
				groups.set(key, { name, mentionCount: 1, recommendCount: recommended ? 1 : 0 });
				continue;
			}
			groups.set(key, {
				name: pickCompetitorDisplayName(prev.name, name),
				mentionCount: prev.mentionCount + 1,
				recommendCount: prev.recommendCount + (recommended ? 1 : 0),
			});
		}
	}
	return [...groups.values()].sort(
		(a, b) => b.mentionCount - a.mentionCount || b.recommendCount - a.recommendCount || a.name.localeCompare(b.name, 'ko'),
	);
}

export function ratesForCompetitor(input: {
	query: string;
	responses: readonly AIResponse[];
	brand: string;
	competitor: string;
	siteUrl: string;
	aliases?: readonly string[];
}): CompetitorQueryRates {
	const usable = input.responses.filter((item) => !item.meta?.error);
	const sample = Math.max(1, usable.length);
	let brandMention = 0;
	let brandRecommend = 0;
	let competitorMention = 0;
	let competitorRecommend = 0;
	const brandCitations: string[] = [];
	const competitorCitations: string[] = [];

	for (const response of usable) {
		const analysis = analyzeAsiAnswer(response, { brand: input.brand, aliases: input.aliases });
		if (analysis.brandMentioned) brandMention += 1;
		if (analysis.recommended) brandRecommend += 1;
		const hit = analysis.competitors.some((name) => nameMatchesBrand(name, input.competitor, []));
		const recHit = analysis.recommendations.some((name) => nameMatchesBrand(name, input.competitor, []));
		if (hit) competitorMention += 1;
		if (recHit) competitorRecommend += 1;
		for (const url of observedUrlsFromResponse(response)) {
			if (isOwnedCitationDomain(url, input.siteUrl)) brandCitations.push(url);
			else if (hit || recHit) competitorCitations.push(url);
		}
	}

	return {
		query: input.query,
		sample,
		brandMention: brandMention / sample,
		brandRecommend: brandRecommend / sample,
		brandCitations: unique(brandCitations),
		competitorMention: competitorMention / sample,
		competitorRecommend: competitorRecommend / sample,
		competitorCitations: unique(competitorCitations),
	};
}
