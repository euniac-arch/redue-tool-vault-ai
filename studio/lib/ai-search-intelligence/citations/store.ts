import { citationAvailability, normalizeAsiCitations } from '@/lib/ai-search-intelligence/citations/normalize';
import type { AIResponse, AsiNormalizedCitation } from '@/lib/ai-search-intelligence/types';

type StoreEntry = {
	sources: AsiNormalizedCitation[];
	responses: AIResponse[];
};

const STORE = new Map<string, StoreEntry>();

function keyFor(domain: string): string {
	return domain.trim().toLowerCase();
}

export function readAsiCitationStore(domain: string): StoreEntry {
	return STORE.get(keyFor(domain)) ?? { sources: [], responses: [] };
}

export function clearAsiCitationStore(domain?: string) {
	if (!domain) {
		STORE.clear();
		return;
	}
	STORE.delete(keyFor(domain));
}

export function appendAsiCitationStore(
	domain: string,
	responses: readonly AIResponse[],
	input: { brand: string; siteUrl: string; aliases?: readonly string[] },
): StoreEntry {
	const current = readAsiCitationStore(domain);
	const live = responses.filter((item) => item.source === 'live');
	if (!live.length) return current;
	const responseKey = (item: AIResponse) => `${item.provider}::${item.query}`;
	const byResponse = new Map(current.responses.map((item) => [responseKey(item), item]));
	for (const item of live) {
		byResponse.set(responseKey(item), item);
	}
	const mergedResponses = [...byResponse.values()];
	const next: StoreEntry = {
		responses: mergedResponses,
		sources: normalizeAsiCitations(mergedResponses, input),
	};
	STORE.set(keyFor(domain), next);
	return next;
}

export function citationStoreAvailability(domain: string) {
	return citationAvailability(readAsiCitationStore(domain).responses);
}
