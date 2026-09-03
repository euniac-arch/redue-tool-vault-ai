import { citationDomain, isOwnedCitationDomain } from '@/lib/ai-search-intelligence/citations/classify';
import { evidenceSourceTypeFromUrl, relatedPageFromUrl } from '@/lib/ai-search-intelligence/evidence-explorer/source-type';
import { observedUrlsFromResponse } from '@/lib/ai-search-intelligence/evidence-explorer/urls';
import type {
	AIResponse,
	AsiEngineId,
	AsiEvidenceAnswerTrace,
	AsiEvidenceEntityCompare,
	AsiEvidenceSourceRow,
} from '@/lib/ai-search-intelligence/types';

function hostMentionsName(url: string, name: string): boolean {
	const slug = name.toLowerCase().replace(/\s+/g, '');
	if (slug.length < 2) return false;
	const hay = `${citationDomain(url)} ${url}`.toLowerCase().replace(/\s+/g, '');
	return hay.includes(slug);
}

function unique(values: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const value = raw.trim();
		if (!value) continue;
		const key = value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(value);
	}
	return out;
}

export function attributeEvidenceSource(input: {
	url: string;
	siteUrl: string;
	brand: string;
	competitors: readonly string[];
}): { relatedTo: AsiEvidenceSourceRow['relatedTo']; entity?: string } {
	if (isOwnedCitationDomain(input.url, input.siteUrl) || hostMentionsName(input.url, input.brand)) {
		return { relatedTo: 'brand', entity: input.brand };
	}
	for (const name of input.competitors) {
		if (hostMentionsName(input.url, name)) return { relatedTo: 'competitor', entity: name };
	}
	return { relatedTo: 'unknown' };
}

export function collectEvidenceSources(input: {
	responses: readonly AIResponse[];
	siteUrl: string;
	brand: string;
	competitors: readonly string[];
}): AsiEvidenceSourceRow[] {
	const rows = new Map<string, AsiEvidenceSourceRow>();
	for (const response of input.responses) {
		for (const url of observedUrlsFromResponse(response)) {
			const type = evidenceSourceTypeFromUrl(url, input.siteUrl);
			if (!type) continue;
			const attr = attributeEvidenceSource({
				url,
				siteUrl: input.siteUrl,
				brand: input.brand,
				competitors: input.competitors,
			});
			const existing = rows.get(url);
			const citedBy = unique([...(existing?.citedBy ?? []), response.provider]) as AsiEngineId[];
			rows.set(url, {
				url,
				sourceType: type,
				citedBy,
				query: existing?.query || response.query,
				relatedTo: attr.relatedTo,
				entity: attr.entity,
				relatedPage: relatedPageFromUrl(url, input.siteUrl),
			});
		}
	}
	return [...rows.values()];
}

function countForEntity(input: {
	name: string;
	kind: 'brand' | 'competitor';
	siteUrl: string;
	sources: readonly AsiEvidenceSourceRow[];
	answers: readonly AsiEvidenceAnswerTrace[];
}): AsiEvidenceEntityCompare {
	const attributed = input.sources.filter((row) => {
		if (row.entity && row.entity.toLowerCase() === input.name.toLowerCase()) return true;
		if (input.kind === 'brand' && row.relatedTo === 'brand') return true;
		return false;
	});
	const mentionUrls =
		input.kind === 'competitor'
			? unique(
					input.answers
						.filter((answer) => answer.competitors.some((name) => name.toLowerCase() === input.name.toLowerCase()))
						.flatMap((answer) => answer.traces.map((step) => step.citation).filter((url): url is string => Boolean(url)))
						.filter((url) => !isOwnedCitationDomain(url, input.siteUrl)),
				)
			: [];
	const citationSet = unique([...attributed.map((row) => row.url), ...mentionUrls]);
	const relevantPages = unique(
		input.kind === 'brand'
			? attributed.map((row) => row.relatedPage).filter((url): url is string => Boolean(url))
			: citationSet.filter((url) => hostMentionsName(url, input.name)),
	);
	const external = citationSet.filter((url) => !isOwnedCitationDomain(url, input.siteUrl));
	return {
		name: input.name,
		kind: input.kind,
		citations: citationSet.length,
		relevantPages: relevantPages.length,
		externalSources: external.length,
	};
}

export function compareEvidenceEntities(input: {
	brand: string;
	competitors: readonly string[];
	siteUrl: string;
	sources: readonly AsiEvidenceSourceRow[];
	answers: readonly AsiEvidenceAnswerTrace[];
}): { brand: AsiEvidenceEntityCompare; competitors: AsiEvidenceEntityCompare[] } {
	return {
		brand: countForEntity({
			name: input.brand,
			kind: 'brand',
			siteUrl: input.siteUrl,
			sources: input.sources,
			answers: input.answers,
		}),
		competitors: unique(input.competitors).map((name) =>
			countForEntity({
				name,
				kind: 'competitor',
				siteUrl: input.siteUrl,
				sources: input.sources,
				answers: input.answers,
			}),
		),
	};
}
