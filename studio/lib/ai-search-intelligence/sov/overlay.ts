import { calculateAsiSov, emptyAsiSovMetric, type AsiSovReport } from '@/lib/ai-search-intelligence/sov/calculate';
import {
	EMPTY_ASI_SOV_COVERAGE,
	buildAsiSovCoverage,
	sovCoverageForDomain,
} from '@/lib/ai-search-intelligence/sov/coverage';
import type {
	AsiRecommendationSnapshot,
	AsiSovCoverage,
	AsiSovMetric,
	AsiSovObservation,
	AsiSovSlice,
} from '@/lib/ai-search-intelligence/types';

function mockMetric(value: number, sampleSize = 0): AsiSovMetric {
	return {
		value,
		sampleSize,
		brandCount: 0,
		universeCount: 0,
		sufficient: false,
	};
}

function emptyLiveSlices(): Pick<
	AsiRecommendationSnapshot['sov'],
	'byQuery' | 'byEngine' | 'byCategory' | 'byPeriod' | 'timeline'
> {
	return {
		byQuery: [],
		byEngine: [],
		byCategory: [],
		byPeriod: [],
		timeline: [],
	};
}

export function withMockSovFields(
	sov: Pick<AsiRecommendationSnapshot['sov'], 'overall' | 'byQuery' | 'byEngine' | 'timeline'>,
): AsiRecommendationSnapshot['sov'] {
	return {
		...sov,
		mention: mockMetric(sov.overall),
		recommendation: mockMetric(sov.overall),
		sampleSize: 0,
		sufficient: false,
		coverage: EMPTY_ASI_SOV_COVERAGE,
		computedFrom: 'mock',
		byCategory: [],
		byPeriod: [],
	};
}

function liveSlices(report: AsiSovReport): AsiSovSlice[] {
	return report.byQuery.map((row) => ({
		label: row.label,
		brandShare: row.brandShare,
		competitorShare: row.competitorShare,
		otherShare: row.otherShare,
		sampleSize: row.sampleSize,
		sufficient: row.sufficient,
	}));
}

function coverageFor(
	snapshot: AsiRecommendationSnapshot,
	live: readonly AsiSovObservation[],
): AsiSovCoverage {
	const domain = snapshot.site.domain;
	if (domain) return sovCoverageForDomain(domain, live);
	return buildAsiSovCoverage({ observations: live });
}

function honestEmptySov(
	snapshot: AsiRecommendationSnapshot,
	coverage: AsiSovCoverage,
): AsiRecommendationSnapshot['sov'] {
	return {
		...emptyLiveSlices(),
		overall: 0,
		mention: emptyAsiSovMetric(coverage.validResponseCount),
		recommendation: emptyAsiSovMetric(coverage.validResponseCount),
		sampleSize: coverage.validResponseCount,
		sufficient: false,
		coverage,
		computedFrom: 'live',
	};
}

export function overlayLiveSov(
	snapshot: AsiRecommendationSnapshot,
	observations: readonly AsiSovObservation[],
	extras?: { honestLive?: boolean },
): AsiRecommendationSnapshot {
	const live = observations.filter((row) => row.source === 'live');
	const coverage = coverageFor(snapshot, live);
	const honestLive = Boolean(extras?.honestLive);

	if (!live.length) {
		if (honestLive) {
			return { ...snapshot, sov: honestEmptySov(snapshot, coverage) };
		}
		return {
			...snapshot,
			sov: {
				...withMockSovFields(snapshot.sov),
				mention: snapshot.sov.mention ?? mockMetric(snapshot.sov.overall),
				recommendation: snapshot.sov.recommendation ?? mockMetric(snapshot.sov.overall),
				coverage,
			},
		};
	}

	const report = calculateAsiSov(live);
	const mention = report.mention;
	const recommendation = report.recommendation;
	const calculable = coverage.calculable && report.sufficient;

	if (!calculable && honestLive) {
		return {
			...snapshot,
			source: snapshot.source === 'mock' ? 'live' : snapshot.source,
			sov: honestEmptySov(snapshot, { ...coverage, calculable: false }),
		};
	}

	return {
		...snapshot,
		source: snapshot.source === 'mock' ? 'live' : snapshot.source,
		sov: {
			...snapshot.sov,
			overall: mention.sufficient && mention.value != null ? mention.value : snapshot.sov.overall,
			mention,
			recommendation,
			sampleSize: report.sampleSize,
			sufficient: report.sufficient,
			coverage: { ...coverage, calculable },
			computedFrom: 'live',
			byQuery: report.sufficient ? liveSlices(report) : snapshot.sov.byQuery,
			byEngine: report.sufficient
				? report.byProvider.map((row) => ({
						engine: row.engine,
						label: row.engine,
						brandShare: row.mention.value ?? 0,
						competitorShare: row.competitorShare,
						otherShare: row.otherShare,
						sampleSize: row.sampleSize,
						sufficient: row.sufficient,
					}))
				: snapshot.sov.byEngine,
			byCategory: report.byCategory.map((row) => ({
				category: row.category,
				label: row.category,
				brandShare: row.mention.value ?? 0,
				competitorShare: row.competitorShare,
				otherShare: row.otherShare,
				sampleSize: row.sampleSize,
				sufficient: row.sufficient,
			})),
			byPeriod: report.byPeriod,
			timeline: report.sufficient
				? report.byPeriod.map((row) => ({
						period: row.period,
						brandShare: row.mention.value ?? 0,
						competitorShare: row.competitorShare,
						sampleSize: row.mention.sampleSize,
					}))
				: snapshot.sov.timeline,
		},
	};
}

export function emptyLiveSovMetric(): AsiSovMetric {
	return emptyAsiSovMetric(0);
}
