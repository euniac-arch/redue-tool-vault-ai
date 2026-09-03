import { analyzeAsiAnswer } from '@/lib/ai-search-intelligence/core/analysis';
import { evidenceSourceTypeFromUrl, relatedPageFromUrl } from '@/lib/ai-search-intelligence/evidence-explorer/source-type';
import { observedUrlsFromResponse } from '@/lib/ai-search-intelligence/evidence-explorer/urls';
import { buildEvidenceWhy } from '@/lib/ai-search-intelligence/evidence-explorer/why';
import type { AsiAuditSignalId } from '@/lib/ai-search-intelligence/types';
import type { AIResponse, AsiEvidenceAnswerTrace, AsiEvidenceTraceStep } from '@/lib/ai-search-intelligence/types';

export function buildEvidenceTraceSteps(input: {
	urls: readonly string[];
	siteUrl: string;
	brand: string;
	brandMentioned: boolean;
	competitors: readonly string[];
}): AsiEvidenceTraceStep[] {
	if (!input.urls.length) {
		return [
			{
				citation: null,
				sourceType: null,
				relatedPage: null,
				brandEntity: input.brandMentioned ? input.brand : null,
				competitorEntities: [...input.competitors],
				available: false,
			},
		];
	}
	return input.urls.map((url) => ({
		citation: url,
		sourceType: evidenceSourceTypeFromUrl(url, input.siteUrl),
		relatedPage: relatedPageFromUrl(url, input.siteUrl),
		brandEntity: input.brandMentioned ? input.brand : null,
		competitorEntities: [...input.competitors],
		available: true,
	}));
}

export function buildEvidenceAnswerTrace(input: {
	response: AIResponse;
	brand: string;
	siteUrl: string;
	aliases?: readonly string[];
	location?: string;
	gaps: readonly AsiAuditSignalId[];
}): AsiEvidenceAnswerTrace {
	const analysis = analyzeAsiAnswer(input.response, { brand: input.brand, aliases: input.aliases });
	const urls = observedUrlsFromResponse(input.response);
	const why = buildEvidenceWhy({
		analysis,
		urls,
		siteUrl: input.siteUrl,
		query: input.response.query,
		location: input.location,
		gaps: input.gaps,
	});
	const traces = buildEvidenceTraceSteps({
		urls,
		siteUrl: input.siteUrl,
		brand: input.brand,
		brandMentioned: analysis.brandMentioned,
		competitors: analysis.competitors,
	});
	return {
		id: `${input.response.provider}::${input.response.query}`,
		provider: input.response.provider,
		query: input.response.query,
		timestamp: input.response.timestamp,
		answer: input.response.answer || input.response.meta?.error || '',
		source: input.response.source,
		fallback: input.response.meta?.fallback,
		error: input.response.meta?.error,
		brandMentioned: analysis.brandMentioned,
		brandRecommended: analysis.recommended,
		competitors: analysis.competitors,
		citations: urls,
		whyObserved: why.observed,
		whyDerived: why.derived,
		traces,
		evidenceAvailable: urls.length > 0,
	};
}
