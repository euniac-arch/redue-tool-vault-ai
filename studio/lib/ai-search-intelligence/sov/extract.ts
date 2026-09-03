import { analyzeAsiAnswer } from '@/lib/ai-search-intelligence/core/analysis';
import { isIncompleteAsiJsonAnswer, unwrapAsiAnswerText } from '@/lib/ai-search-intelligence/providers/normalize';
import { classifyAsiSovQuery } from '@/lib/ai-search-intelligence/sov/classify';
import type { AIResponse, AsiSovCategory, AsiSovObservation } from '@/lib/ai-search-intelligence/types';

export function isUsableAsiResponse(response: AIResponse): boolean {
	if (response.meta?.error) return false;
	if (response.source === 'fallback') return false;
	if (isIncompleteAsiJsonAnswer(response.answer || '')) {
		return response.mentions.length > 0 || response.recommendations.length > 0;
	}
	const text = unwrapAsiAnswerText(response.answer || '');
	return text.length > 0 || response.mentions.length > 0 || response.recommendations.length > 0;
}

export function extractAsiSovObservation(
	response: AIResponse,
	input: {
		brand: string;
		aliases?: readonly string[];
		category?: AsiSovCategory;
	},
): AsiSovObservation | null {
	if (!isUsableAsiResponse(response)) return null;
	const analysis = analyzeAsiAnswer(response, input);
	return {
		query: response.query,
		category: input.category ?? classifyAsiSovQuery(response.query),
		provider: response.provider,
		brandMentioned: analysis.brandMentioned,
		competitorMentions: analysis.competitors,
		recommended: analysis.recommended,
		rank: analysis.rank,
		position: analysis.position,
		citations: analysis.citations,
		timestamp: response.timestamp || new Date().toISOString(),
		source: response.source,
	};
}

export function extractAsiSovObservations(
	responses: readonly AIResponse[],
	input: { brand: string; aliases?: readonly string[]; category?: AsiSovCategory },
): AsiSovObservation[] {
	return responses
		.map((response) => extractAsiSovObservation(response, input))
		.filter((item): item is AsiSovObservation => Boolean(item));
}
