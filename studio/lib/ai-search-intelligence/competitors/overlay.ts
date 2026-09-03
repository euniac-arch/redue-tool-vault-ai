/**
 * Replace mock competitor lists when live answers exist.
 * Empty roster is the honest result — never keep placeholder mock names once live data exists.
 */
import { brandAliases } from '@/lib/ai-search-intelligence/competitors/normalize';
import { syncCompetitorRepository } from '@/lib/ai-search-intelligence/competitors/service';
import { readAsiCompetitorRoster } from '@/lib/ai-search-intelligence/competitors/store';
import { readAsiCitationStore } from '@/lib/ai-search-intelligence/citations/store';
import { resolveAsiObservationState } from '@/lib/ai-search-intelligence/observation-state';
import { readAsiSovStore } from '@/lib/ai-search-intelligence/sov/store';
import {
	ASI_ENGINES,
	type AsiCompetitorIntensity,
	type AsiCompetitorRow,
	type AsiEngineId,
	type AsiObservationState,
	type AsiRecommendationSnapshot,
	type AsiWarRoomCompetitor,
	type AsiWarRoomSite,
} from '@/lib/ai-search-intelligence/types';

function intensityFor(share: number): AsiCompetitorIntensity {
	if (share >= 28) return 'high';
	if (share >= 12) return 'mid';
	return 'low';
}

export function liveCompetitorUniverse(domain: string): {
	responseCount: number;
	byEngine: Record<AsiEngineId, number>;
} {
	const responses = readAsiCitationStore(domain).responses.filter((row) => row.source === 'live' && !row.meta?.error);
	const sov = readAsiSovStore(domain).filter((row) => row.source === 'live');
	const rows = responses.length ? responses : sov;
	const byEngine = Object.fromEntries(
		ASI_ENGINES.map((engine) => [engine, rows.filter((row) => row.provider === engine).length]),
	) as Record<AsiEngineId, number>;
	return { responseCount: rows.length, byEngine };
}

export function hasLiveCompetitorUniverse(domain: string): boolean {
	return liveCompetitorUniverse(domain).responseCount > 0;
}

export function competitorRowsFromRegistry(
	domain: string,
	extras?: { category?: string; location?: string },
): AsiCompetitorRow[] {
	const universe = liveCompetitorUniverse(domain);
	const total = Math.max(1, universe.responseCount);
	const area = [extras?.location, extras?.category].filter(Boolean).join(' ');
	return readAsiCompetitorRoster(domain)
		.sort((a, b) => b.mentionCount - a.mentionCount || a.name.localeCompare(b.name, 'ko'))
		.slice(0, 8)
		.map((record) => {
			const sharePercent = Math.round((record.mentionCount / total) * 100);
			const engineRate = Object.fromEntries(
				ASI_ENGINES.map((engine) => {
					const denom = universe.byEngine[engine] ?? 0;
					const mentions = record.engineMentions[engine] ?? 0;
					return [engine, denom ? Math.round((mentions / denom) * 100) : 0];
				}),
			) as Record<AsiEngineId, number>;
			return {
				name: record.name,
				coRecommend: Math.round((record.recommendCount / total) * 100),
				intensity: intensityFor(sharePercent),
				sharePercent,
				area: area || record.queries[0] || '',
				engineRate,
			};
		});
}

export function warRoomCompetitorsFromRegistry(domain: string): AsiWarRoomCompetitor[] {
	return competitorRowsFromRegistry(domain).map(({ name, coRecommend, intensity, sharePercent }) => ({
		name,
		coRecommend,
		intensity,
		sharePercent,
	}));
}

export function overlayLiveCompetitors<
	T extends { competitors: AsiCompetitorRow[]; site: AsiWarRoomSite },
>(
	snapshot: T,
	extras?: { auditNames?: readonly string[] },
): T {
	syncCompetitorRepository(snapshot.site.domain, {
		brand: snapshot.site.brandName,
		aliases: brandAliases(snapshot.site.brandName, snapshot.site.domain),
		auditNames: extras?.auditNames,
		location: snapshot.site.location,
		category: snapshot.site.category,
	});
	const competitors = competitorRowsFromRegistry(snapshot.site.domain, {
		category: snapshot.site.category,
		location: snapshot.site.location,
	});
	const withSov = snapshot as T & Partial<AsiRecommendationSnapshot>;
	const observationState: AsiObservationState | undefined = withSov.sov
		? resolveAsiObservationState({
				analyzed: withSov.sov.computedFrom === 'live' || withSov.source === 'live',
				validResponseCount: withSov.sov.coverage?.validResponseCount ?? withSov.sov.sampleSize ?? 0,
				competitorCount: competitors.length,
			})
		: undefined;
	return {
		...snapshot,
		competitors,
		...(observationState ? { observationState } : {}),
	};
}
