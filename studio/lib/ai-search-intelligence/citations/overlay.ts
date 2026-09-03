import { sourceClassFromKind } from '@/lib/ai-search-intelligence/citations/classify';
import { emptyAsiCitationMix, mixAsiCitations } from '@/lib/ai-search-intelligence/citations/mix';
import { citationAvailability } from '@/lib/ai-search-intelligence/citations/normalize';
import { isObservedHttpUrl } from '@/lib/ai-search-intelligence/citations/observed-url';
import { unavailableLiveCitationReport } from '@/lib/ai-search-intelligence/evidence/live-base';
import type {
	AIResponse,
	AsiCitationReport,
	AsiEvidenceCitation,
	AsiEvidenceSnapshot,
	AsiNormalizedCitation,
} from '@/lib/ai-search-intelligence/types';

function ownershipFromClass(sourceType: AsiNormalizedCitation['sourceType']): AsiEvidenceCitation['ownership'] {
	if (sourceType === 'owned') return 'owned';
	if (sourceType === 'social' || sourceType === 'local') return 'brand_earned';
	return 'unbranded_third_party';
}

export function mockCitationReport(citations: readonly AsiEvidenceCitation[], siteUrl: string): AsiCitationReport {
	const mapped: AsiNormalizedCitation[] = citations.map((item) => ({
		id: item.id,
		url: item.url,
		domain: item.domain || '',
		title: item.title || item.source,
		sourceType: item.sourceType || sourceClassFromKind(item.kind, item.url, siteUrl),
		kind: item.kind,
		brandRelevance: item.brandRelevance ?? (item.ownership === 'owned' ? 100 : 50),
		query: item.query || '',
		provider: item.provider || 'chatgpt',
		cited: item.cited ?? false,
	}));
	const { mix, brandSupportCount } = mixAsiCitations(mapped);
	return {
		computedFrom: 'mock',
		available: citations.length > 0,
		responseCount: 0,
		citedResponseCount: 0,
		unavailableProviders: [],
		mix: citations.length ? mix : emptyAsiCitationMix(),
		brandSupportCount,
	};
}

export function toEvidenceCitations(sources: readonly AsiNormalizedCitation[]): AsiEvidenceCitation[] {
	return sources.filter((item) => isObservedHttpUrl(item.url)).map((item) => ({
		id: item.id,
		source: item.title,
		url: item.url,
		kind: item.kind,
		relevance: item.brandRelevance,
		authority: item.brandRelevance,
		relation: item.cited ? `${item.provider} · ${item.query}` : '',
		ownership: ownershipFromClass(item.sourceType),
		sourceType: item.sourceType,
		domain: item.domain,
		title: item.title,
		query: item.query,
		provider: item.provider,
		cited: item.cited,
		brandRelevance: item.brandRelevance,
	}));
}

export function overlayLiveCitations(
	snapshot: AsiEvidenceSnapshot,
	input: { sources: readonly AsiNormalizedCitation[]; responses: readonly AIResponse[] },
): AsiEvidenceSnapshot {
	const live = input.responses.filter((item) => item.source === 'live' && !item.meta?.error);
	if (!live.length) {
		return {
			...snapshot,
			source: snapshot.source === 'mock' ? 'live' : snapshot.source,
			citations: [],
			citationReport: unavailableLiveCitationReport(0, []),
		};
	}

	const availability = citationAvailability(live);
	const observedSources = input.sources.filter((item) => isObservedHttpUrl(item.url));
	const available = availability.citedResponseCount > 0 && observedSources.length > 0;
	const { mix, brandSupportCount } = mixAsiCitations(observedSources);

	return {
		...snapshot,
		source: snapshot.source === 'mock' ? 'live' : snapshot.source,
		citations: available ? toEvidenceCitations(observedSources) : [],
		citationReport: available
			? {
					computedFrom: 'live',
					available: true,
					responseCount: availability.responseCount,
					citedResponseCount: availability.citedResponseCount,
					unavailableProviders: availability.unavailableProviders,
					mix,
					brandSupportCount,
				}
			: unavailableLiveCitationReport(availability.responseCount, availability.unavailableProviders),
	};
}
