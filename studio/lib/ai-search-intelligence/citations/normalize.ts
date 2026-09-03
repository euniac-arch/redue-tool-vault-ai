import {
	citationDomain,
	citationKindFromObservedUrl,
	classifyCitationSource,
	isOwnedCitationDomain,
} from '@/lib/ai-search-intelligence/citations/classify';
import { isObservedHttpUrl, sanitizeObservedUrl } from '@/lib/ai-search-intelligence/citations/observed-url';
import { nameMatchesBrand } from '@/lib/ai-search-intelligence/sov/match';
import type { AIResponse, AsiNormalizedCitation } from '@/lib/ai-search-intelligence/types';

const URL_RE = /https?:\/\/[^\s)"']+/g;

export function observedCitationUrls(input: {
	answer?: string;
	providerUrls?: readonly string[];
	citations?: Array<{ url?: string }>;
}): string[] {
	const fromAnswer = Array.from((input.answer || '').matchAll(URL_RE)).map((match) => sanitizeObservedUrl(match[0]));
	const fromProvider = (input.providerUrls || []).map((url) => sanitizeObservedUrl(url));
	const allowed = new Set([...fromProvider, ...fromAnswer].filter((url) => isObservedHttpUrl(url)));
	const claimed = (input.citations || [])
		.map((item) => sanitizeObservedUrl(item.url || ''))
		.filter((url) => allowed.has(url));
	return [...new Set([...fromProvider, ...fromAnswer, ...claimed].filter((url) => allowed.has(url)))];
}

export function brandRelevanceForCitation(input: {
	url: string;
	title: string;
	siteUrl: string;
	brand: string;
	aliases?: readonly string[];
}): number {
	if (isOwnedCitationDomain(input.url, input.siteUrl)) return 100;
	const host = citationDomain(input.url);
	if (nameMatchesBrand(host, input.brand, input.aliases) || nameMatchesBrand(input.title, input.brand, input.aliases)) {
		return 80;
	}
	return 0;
}

export function normalizeAsiCitations(
	responses: readonly AIResponse[],
	input: { brand: string; siteUrl: string; aliases?: readonly string[] },
): AsiNormalizedCitation[] {
	const rows: AsiNormalizedCitation[] = [];
	const seen = new Set<string>();
	for (const response of responses) {
		if (response.source !== 'live' || response.meta?.error) continue;
		const providerUrls = response.citations.map((item) => item.url).filter(Boolean);
		const urls = observedCitationUrls({
			answer: response.answer,
			providerUrls,
			citations: response.citations,
		});
		for (const url of urls) {
			const key = `${response.provider}::${url}`;
			if (seen.has(key)) continue;
			seen.add(key);
			const domain = citationDomain(url);
			if (!domain) continue;
			const title = response.citations.find((item) => item.url === url)?.source || domain;
			rows.push({
				id: key,
				url,
				domain,
				title,
				sourceType: classifyCitationSource(url, input.siteUrl),
				kind: citationKindFromObservedUrl(url),
				brandRelevance: brandRelevanceForCitation({
					url,
					title,
					siteUrl: input.siteUrl,
					brand: input.brand,
					aliases: input.aliases,
				}),
				query: response.query,
				provider: response.provider,
				cited: true,
			});
		}
	}
	return rows;
}

export function citationAvailability(responses: readonly AIResponse[]): {
	responseCount: number;
	citedResponseCount: number;
	unavailableProviders: AsiNormalizedCitation['provider'][];
} {
	const live = responses.filter((item) => item.source === 'live' && !item.meta?.error);
	const cited = live.filter((item) =>
		observedCitationUrls({
			answer: item.answer,
			providerUrls: item.citations.map((citation) => citation.url),
			citations: item.citations,
		}).length > 0,
	);
	const unavailable = live
		.filter((item) => !cited.some((row) => row.provider === item.provider && row.query === item.query))
		.map((item) => item.provider);
	return {
		responseCount: live.length,
		citedResponseCount: cited.length,
		unavailableProviders: [...new Set(unavailable)],
	};
}
