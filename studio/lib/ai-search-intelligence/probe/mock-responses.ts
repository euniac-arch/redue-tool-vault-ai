import { createMockAsiProvider } from '@/lib/ai-search-intelligence/providers/mock-provider';
import { ASI_ENGINES, type AIResponse } from '@/lib/ai-search-intelligence/types';

export async function runMockAsiQueryResponses(input: {
	queries: readonly string[];
	url: string;
	brand: string;
	location?: string;
	category?: string;
}): Promise<AIResponse[]> {
	const providers = ASI_ENGINES.map((id) => createMockAsiProvider(id));
	const rows: AIResponse[] = [];
	for (const query of input.queries) {
		for (const provider of providers) {
			rows.push(
				await provider.query({
					query,
					url: input.url,
					brand: input.brand,
					location: input.location,
					category: input.category,
				}),
			);
		}
	}
	return rows;
}
