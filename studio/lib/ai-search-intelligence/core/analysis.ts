/**
 * Central AI Intelligence analysis engine.
 * Mention / recommendation / competitor / citation extraction happen here only.
 * Pages and snapshots must call these functions — never re-parse provider answers.
 */
import { isObservedHttpUrl, sanitizeObservedUrl } from '@/lib/ai-search-intelligence/citations/observed-url';
import { splitCompetitorEntities, type AsiEntityContext } from '@/lib/ai-search-intelligence/core/entity-role';
import { parseAsiAnswerText } from '@/lib/ai-search-intelligence/core/parse-text';
import { unwrapAsiAnswerText } from '@/lib/ai-search-intelligence/providers/normalize';
import { nameMatchesBrand, textMentionsBrand } from '@/lib/ai-search-intelligence/sov/match';
import type {
	AIResponse,
	AsiRecommendRank,
	CitationResult,
	RecommendationResult,
} from '@/lib/ai-search-intelligence/types';

export type AsiAnswerAnalysis = {
	mentions: string[];
	recommendations: string[];
	brandMentioned: boolean;
	recommended: boolean;
	/** Alias of brandMentioned — OBSERVED fact from the answer text. */
	brandMention: boolean;
	/** Alias of recommended — OBSERVED recommend/priority, not a mere listing. */
	recommendation: boolean;
	rank: AsiRecommendRank;
	position: number | null;
	competitors: string[];
	landmarks: string[];
	citations: string[];
};

function uniqueNames(names: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of names) {
		const name = raw.trim();
		if (!name) continue;
		const key = name.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(name);
	}
	return out;
}

function rankFromList(recommendations: readonly string[], brand: string, aliases: readonly string[]): AsiRecommendRank {
	const index = recommendations.findIndex((item) => nameMatchesBrand(item, brand, aliases));
	if (index === 0) return 1;
	if (index === 1) return 2;
	if (index === 2) return 3;
	return null;
}

function observedCitationUrlsFromResponse(response: AIResponse): string[] {
	const fromAnswer = Array.from(unwrapAsiAnswerText(response.answer || '').matchAll(/https?:\/\/[^\s)"']+/g)).map(
		(match) => sanitizeObservedUrl(match[0]),
	);
	const fromProvider = response.citations.map((item) => sanitizeObservedUrl(item.url || '')).filter(Boolean);
	return [...new Set([...fromProvider, ...fromAnswer].filter((url) => isObservedHttpUrl(url)))];
}

/** Single mention / recommendation / competitor parse for every feature. */
export function analyzeAsiAnswer(
	response: AIResponse,
	input: AsiEntityContext & { brand: string; aliases?: readonly string[] },
): AsiAnswerAnalysis {
	const aliases = input.aliases ?? [];
	const answer = unwrapAsiAnswerText(response.answer || '');
	const fromText = parseAsiAnswerText(answer, input);
	const mentions = uniqueNames([...response.mentions, ...fromText.mentions]);
	const recs = uniqueNames([...response.recommendations, ...fromText.recommendations]);
	const brandMentioned =
		mentions.some((item) => nameMatchesBrand(item, input.brand, aliases)) ||
		textMentionsBrand(answer, input.brand, aliases) ||
		fromText.brandMention;
	const recommendedFromList = recs.some((item) => nameMatchesBrand(item, input.brand, aliases));
	const rank = rankFromList(recs, input.brand, aliases) ?? fromText.rank;
	const recommended = recommendedFromList || fromText.recommendation || rank === 1;
	const mentionIndex = mentions.findIndex((item) => nameMatchesBrand(item, input.brand, aliases));
	const position = mentionIndex >= 0 ? mentionIndex + 1 : rank;
	const rawCompetitors = uniqueNames([
		...mentions.filter((item) => !nameMatchesBrand(item, input.brand, aliases)),
		...recs.filter((item) => !nameMatchesBrand(item, input.brand, aliases)),
		...fromText.competitors,
	]);
	const split = splitCompetitorEntities(rawCompetitors, answer, input);
	return {
		mentions,
		recommendations: recs,
		brandMentioned,
		recommended,
		brandMention: brandMentioned,
		recommendation: recommended,
		rank,
		position,
		competitors: split.competitors,
		landmarks: uniqueNames([...fromText.landmarks, ...split.landmarks]),
		citations: observedCitationUrlsFromResponse(response),
	};
}

export function recommendationFromAnalysis(
	response: AIResponse,
	brand: string,
	analysis: AsiAnswerAnalysis = analyzeAsiAnswer(response, { brand }),
): RecommendationResult {
	return {
		brand,
		mentioned: analysis.brandMentioned,
		rank: analysis.rank,
		reason: response.answer || response.meta?.error || '',
		provider: response.provider,
		query: response.query,
	};
}

export function citationsFromResponse(response: AIResponse): CitationResult[] {
	return response.citations.filter((item) => isObservedHttpUrl(item.url || ''));
}
