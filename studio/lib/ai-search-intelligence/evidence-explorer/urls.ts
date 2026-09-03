import { observedCitationUrls } from '@/lib/ai-search-intelligence/citations/normalize';
import type { AIResponse } from '@/lib/ai-search-intelligence/types';

/** Observed citation URLs only — never JSON-claimed extras that were not returned. */
export function observedUrlsFromResponse(response: AIResponse): string[] {
	return observedCitationUrls({
		answer: response.answer,
		providerUrls: response.citations.map((item) => item.url).filter(Boolean),
		citations: response.citations,
	});
}
