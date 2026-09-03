import { hashSeed, mockScore } from '@/lib/ai-search-intelligence/mock/seed';
import { asiProviderVendor, resolveAsiMode } from '@/lib/ai-search-intelligence/providers/resolve-mode';
import { withAsiProviderSurface } from '@/lib/ai-search-intelligence/providers/surface';
import type { AsiProviderPort, AsiProviderQuery } from '@/lib/ai-search-intelligence/providers/types';
import type { AIResponse, AsiEngineId, CitationResult } from '@/lib/ai-search-intelligence/types';

function citationsFor(brand: string, url: string, seed: number): CitationResult[] {
	if (!/^https?:\/\//i.test(url)) return [];
	return [
		{ source: `${brand} 공식 홈`, url, type: 'official', relevance: mockScore(seed, 1, 50, 92), authority: mockScore(seed, 2, 48, 90) },
	];
}

export function createMockAsiProvider(id: AsiEngineId): AsiProviderPort {
	return withAsiProviderSurface(
		id,
		async (input: AsiProviderQuery): Promise<AIResponse> => {
			const brand = input.brand || '브랜드';
			const location = input.location || '지역';
			const category = input.category || '서비스';
			const seed = hashSeed(`${id}:${input.url}:${input.query}`);
			const mentioned = mockScore(seed, 5, 0, 100) >= 42;
			const rankish = mockScore(seed, 6, 1, 4);
			const answer = mentioned
				? `${location} ${category} 맥락에서 ${brand}가 언급되는 추정 답변입니다.`
				: `${location} ${category} 질문에서 ${brand}보다 다른 후보가 먼저 나오는 추정 답변입니다.`;
			return {
				provider: id,
				query: input.query,
				answer,
				mentions: mentioned ? [brand] : [],
				recommendations: mentioned && rankish <= 3 ? [brand] : [],
				citations: citationsFor(brand, input.url, seed),
				confidence: mockScore(seed, 7, 35, 86) / 100,
				timestamp: new Date().toISOString(),
				source: 'mock',
				meta: {
					mode: resolveAsiMode(),
					provider: asiProviderVendor(id),
					engine: id,
					fallback: false,
				},
			};
		},
		async () => ({
			ok: true,
			provider: id,
			vendor: asiProviderVendor(id),
			available: true,
			code: 'ok',
		}),
		() => true,
	);
}
