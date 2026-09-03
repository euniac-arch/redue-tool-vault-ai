import type {
	AsiCitationMix,
	AsiCitationSourceClass,
	AsiNormalizedCitation,
} from '@/lib/ai-search-intelligence/types';
import { ASI_CITATION_SOURCE_CLASSES } from '@/lib/ai-search-intelligence/types';

export function emptyAsiCitationMix(): AsiCitationMix {
	return Object.fromEntries(ASI_CITATION_SOURCE_CLASSES.map((key) => [key, { count: 0, percent: 0 }])) as AsiCitationMix;
}

export function mixAsiCitations(sources: readonly AsiNormalizedCitation[]): {
	mix: AsiCitationMix;
	brandSupportCount: number;
} {
	const supporting = sources.filter((item) => item.brandRelevance > 0);
	const mix = emptyAsiCitationMix();
	if (!supporting.length) return { mix, brandSupportCount: 0 };
	const counts: Record<AsiCitationSourceClass, number> = {
		owned: 0,
		local: 0,
		third_party: 0,
		social: 0,
		unknown: 0,
	};
	for (const item of supporting) {
		counts[item.sourceType] += 1;
	}
	const total = supporting.length;
	for (const key of ASI_CITATION_SOURCE_CLASSES) {
		mix[key] = {
			count: counts[key],
			percent: Math.round((counts[key] / total) * 100),
		};
	}
	const drift = 100 - ASI_CITATION_SOURCE_CLASSES.reduce((sum, key) => sum + mix[key].percent, 0);
	const top = ASI_CITATION_SOURCE_CLASSES.filter((key) => mix[key].count > 0).sort(
		(a, b) => mix[b].percent - mix[a].percent,
	)[0];
	if (top && drift) mix[top].percent += drift;
	return { mix, brandSupportCount: total };
}
