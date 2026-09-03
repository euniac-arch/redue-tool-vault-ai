import { classifyAsiThrown } from '@/lib/ai-search-intelligence/api/errors';
import { analyzeAsiAnswer, recommendationFromAnalysis } from '@/lib/ai-search-intelligence/core/analysis';
import { getAsiRequestContext } from '@/lib/ai-search-intelligence/guard/context';
import { errorAsiResponse } from '@/lib/ai-search-intelligence/providers/live-query';
import type { AsiProviderQuery } from '@/lib/ai-search-intelligence/providers/types';
import { createAsiProviders } from '@/lib/ai-search-intelligence/providers/create-providers';
import type { AIResponse, AsiEngineRecommendResult, RecommendationResult } from '@/lib/ai-search-intelligence/types';

export function toRecommendationResult(response: AIResponse, brand: string): RecommendationResult {
	return recommendationFromAnalysis(response, brand);
}

export function toEngineRecommendResult(response: AIResponse, brand: string): AsiEngineRecommendResult {
	const mapped = toRecommendationResult(response, brand);
	const analysis = analyzeAsiAnswer(response, { brand });
	return {
		engine: response.provider,
		rank: mapped.rank,
		mentioned: mapped.mentioned,
		reason: mapped.reason,
		summary: response.answer || response.meta?.error || '',
		mentionType: analysis.recommended ? 'recommended' : mapped.mentioned ? 'simple_mention' : 'none',
		source: response.source,
		fallback: response.meta?.fallback ?? response.source === 'fallback',
		error: response.meta?.error,
		mentions: analysis.mentions,
		recommendations: analysis.recommendations,
		citations: analysis.citations,
		timestamp: response.timestamp,
		query: response.query,
	};
}

/**
 * Overlay live or explicit fallback answers onto a snapshot's test rows.
 * Mock-sourced responses stay ignored so they cannot replace a live run.
 * Live errors and hybrid unavailable rows are overlaid so the UI never keeps dummy text.
 */
export function overlayLiveRecommendations<T extends { testResults: AsiEngineRecommendResult[] }>(
	snapshot: T,
	responses: AIResponse[],
	brand: string,
): T {
	const overlayable = responses.filter((item) => item.source === 'live' || item.source === 'fallback');
	if (!overlayable.length) return snapshot;
	const byProvider = new Map(overlayable.map((item) => [item.provider, toEngineRecommendResult(item, brand)]));
	return {
		...snapshot,
		testResults: snapshot.testResults.map((row) => byProvider.get(row.engine) ?? row),
	};
}

export async function queryAsiProviders(input: AsiProviderQuery): Promise<AIResponse[]> {
	const limit = getAsiRequestContext()?.limits?.providers;
	const providers = createAsiProviders().slice(0, limit && limit > 0 ? limit : undefined);
	return Promise.all(
		providers.map(async (provider) => {
			try {
				return await provider.query(input);
			} catch (err) {
				const classified = classifyAsiThrown(err);
				return errorAsiResponse(provider.id, input, classified.code, classified.code);
			}
		}),
	);
}
