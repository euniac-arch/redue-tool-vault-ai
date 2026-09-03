import { extractCitationsFromText } from '@/lib/ai-search-intelligence/providers/normalize';
import { hasAsiProviderKey } from '@/lib/ai-search-intelligence/providers/resolve-mode';
import type { AsiProviderHealth, AsiProviderPort, AsiProviderQuery } from '@/lib/ai-search-intelligence/providers/types';
import type { AIResponse, AsiEngineId } from '@/lib/ai-search-intelligence/types';

const NAMES: Record<AsiEngineId, string> = {
	chatgpt: 'OpenAI',
	gemini: 'Google Gemini',
	perplexity: 'Perplexity',
	claude: 'Anthropic Claude',
};

export function withAsiProviderSurface(
	id: AsiEngineId,
	query: (input: AsiProviderQuery) => Promise<AIResponse>,
	healthCheck: () => Promise<AsiProviderHealth>,
	available: () => boolean = () => hasAsiProviderKey(id),
): AsiProviderPort {
	return {
		id,
		name: NAMES[id],
		isAvailable: available,
		query,
		generateAnswer: query,
		async analyzeRecommendation(input, brand) {
			const { toRecommendationResult } = await import('@/lib/ai-search-intelligence/providers/compose');
			return toRecommendationResult(await query(input), brand);
		},
		extractCitations(answer, extras) {
			return extractCitationsFromText(answer, extras);
		},
		healthCheck,
	};
}
