/**
 * War Room is a dashboard over AI Intelligence Core data.
 * It must not call providers or recompute scores from raw answers.
 */
import { brandAliases } from '@/lib/ai-search-intelligence/competitors/normalize';
import { warRoomCompetitorsFromRegistry } from '@/lib/ai-search-intelligence/competitors/overlay';
import { syncCompetitorRepository } from '@/lib/ai-search-intelligence/competitors/service';
import { attachAsiLoop } from '@/lib/ai-search-intelligence/loop/compose';
import { resolveAsiObservationState } from '@/lib/ai-search-intelligence/observation-state';
import { calculateAsiSov } from '@/lib/ai-search-intelligence/sov/calculate';
import { readAsiSovStore } from '@/lib/ai-search-intelligence/sov/store';
import { readAsiCitationStore } from '@/lib/ai-search-intelligence/citations/store';
import { latestAsiQueryProbeReport } from '@/lib/ai-search-intelligence/probe/store';
import { ASI_ENGINES } from '@/lib/ai-search-intelligence/types';
import type {
	AsiCitationOwnership,
	AsiEngineVisibility,
	AsiMentionType,
	AsiSovObservation,
	AsiWarRoomCitation,
	AsiWarRoomQuery,
	AsiWarRoomSnapshot,
} from '@/lib/ai-search-intelligence/types';

function mentionTypeFromRow(row: Pick<AsiSovObservation, 'recommended' | 'brandMentioned'>): AsiMentionType {
	if (row.recommended) return 'recommended';
	if (row.brandMentioned) return 'simple_mention';
	return 'none';
}

function visibilityFromObservations(rows: readonly AsiSovObservation[]): AsiEngineVisibility[] {
	return ASI_ENGINES.map((engine) => {
		const subset = rows.filter((row) => row.provider === engine);
		if (!subset.length) return null;
		const mentioned = subset.filter((row) => row.brandMentioned).length;
		const recommended = subset.filter((row) => row.recommended).length;
		const score = Math.round((mentioned / subset.length) * 70 + (recommended / subset.length) * 30);
		return {
			engine,
			score,
			mentionType: mentionTypeFromRow({
				recommended: recommended > 0,
				brandMentioned: mentioned > 0,
			}),
		};
	}).filter((row): row is AsiEngineVisibility => Boolean(row));
}

function overlayQueries(brand: string, domain: string): AsiWarRoomQuery[] | null {
	const report = latestAsiQueryProbeReport(domain);
	const current = report.current;
	if (!current?.records.length) return null;
	const byQuery = new Map<string, AsiWarRoomQuery>();
	for (const record of current.records) {
		const prev = byQuery.get(record.query);
		const recommended = record.extracted.recommended || Boolean(prev?.recommended);
		byQuery.set(record.query, {
			query: record.query,
			recommended,
			winner: recommended ? brand : record.extracted.competitors[0] || prev?.winner || '제3자 매체',
		});
	}
	return [...byQuery.values()];
}

function overlayCitations(domain: string): AsiWarRoomCitation[] | null {
	const stored = readAsiCitationStore(domain);
	if (!stored.sources.length) return null;
	return stored.sources.slice(0, 6).map((item) => {
		const ownership: AsiCitationOwnership =
			item.sourceType === 'owned' ? 'owned' : item.brandRelevance >= 80 ? 'brand_earned' : 'unbranded_third_party';
		return {
			title: item.title || item.domain,
			url: item.url,
			ownership,
		};
	});
}

/** Patch a War Room snapshot from already-computed Core stores. No provider I/O. */
export function aggregateAsiWarRoom(base: AsiWarRoomSnapshot): AsiWarRoomSnapshot {
	const live = readAsiSovStore(base.site.domain).filter((row) => row.source === 'live');
	const kpis = { ...base.kpis };
	let visibility = base.visibility;
	let queries = base.queries;
	let citations = base.citations;

	syncCompetitorRepository(base.site.domain, {
		brand: base.site.brandName,
		aliases: brandAliases(base.site.brandName, base.site.domain),
	});
	const competitors = warRoomCompetitorsFromRegistry(base.site.domain);

	if (live.length) {
		const report = calculateAsiSov(live);
		kpis.shareOfVoice = report.sufficient && report.mention.value != null ? report.mention.value : 0;
		kpis.recommendationRate =
			report.sufficient && report.recommendation.value != null ? report.recommendation.value : 0;
		const liveVisibility = visibilityFromObservations(live);
		const byLive = new Map(liveVisibility.map((row) => [row.engine, row]));
		const engines = ASI_ENGINES.map(
			(engine) => byLive.get(engine) ?? { engine, score: 0, mentionType: 'none' as const },
		);
		visibility = {
			overall: Math.round(engines.reduce((sum, row) => sum + row.score, 0) / Math.max(1, engines.length)),
			engines,
		};
		kpis.visibility = visibility.overall;
	}

	const liveQueries = overlayQueries(base.site.brandName, base.site.domain);
	if (liveQueries?.length) queries = liveQueries;
	const liveCitations = overlayCitations(base.site.domain);
	if (liveCitations?.length) citations = liveCitations;

	const validResponseCount = live.length;
	const queryCount = new Set(live.map((row) => row.query.trim().toLowerCase()).filter(Boolean)).size;
	const observationState = resolveAsiObservationState({
		analyzed: base.source === 'live' || validResponseCount > 0,
		validResponseCount,
		competitorCount: competitors.length,
	});
	return attachAsiLoop({
		...base,
		kpis,
		visibility,
		competitors,
		queries,
		citations,
		validResponseCount,
		queryCount,
		observationState,
	});
}
