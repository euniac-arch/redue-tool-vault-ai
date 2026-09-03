/**
 * WHY RECOMMENDED? facts.
 * OBSERVED = parsed from the provider answer / observed URLs.
 * DERIVED  = REDUE combination. Never present as "the AI said".
 */
import { isOwnedCitationDomain } from '@/lib/ai-search-intelligence/citations/classify';
import type { AsiAnswerAnalysis } from '@/lib/ai-search-intelligence/core/analysis';
import type { AsiAuditSignalId } from '@/lib/ai-search-intelligence/types';
import type { AsiEvidenceWhyFact } from '@/lib/ai-search-intelligence/types';

export function buildEvidenceWhy(input: {
	analysis: AsiAnswerAnalysis;
	urls: readonly string[];
	siteUrl: string;
	query: string;
	location?: string;
	gaps: readonly AsiAuditSignalId[];
}): { observed: AsiEvidenceWhyFact[]; derived: AsiEvidenceWhyFact[] } {
	const officialCited = input.urls.some((url) => isOwnedCitationDomain(url, input.siteUrl));
	const citationPresent = input.urls.length > 0;
	const location = (input.location || '').trim().toLowerCase();
	const localHit = Boolean(location && input.query.toLowerCase().includes(location));
	const coverageStrong = officialCited && input.gaps.length === 0;
	const coverageWeak = input.gaps.includes('citation') || input.gaps.includes('faq');

	const observedCandidates: AsiEvidenceWhyFact[] = [
		{ id: 'brand_mentioned', present: input.analysis.brandMentioned, provenance: 'observed' },
		{ id: 'brand_recommended', present: input.analysis.recommended, provenance: 'observed' },
		{ id: 'official_cited', present: officialCited, provenance: 'observed' },
		{ id: 'citation_present', present: citationPresent, provenance: 'observed' },
		{ id: 'competitor_mentioned', present: input.analysis.competitors.length > 0, provenance: 'observed' },
	];
	const observed = observedCandidates.filter((item) => item.present);

	const derived: AsiEvidenceWhyFact[] = [];
	if (localHit) derived.push({ id: 'local_entity', present: true, provenance: 'derived' });
	if (coverageStrong) derived.push({ id: 'content_coverage', present: true, provenance: 'derived' });
	if (coverageWeak) derived.push({ id: 'weak_coverage', present: true, provenance: 'derived' });
	if (input.analysis.competitors.length > 0 && !input.analysis.recommended) {
		derived.push({ id: 'competitor_leads', present: true, provenance: 'derived' });
	}

	return { observed, derived };
}
