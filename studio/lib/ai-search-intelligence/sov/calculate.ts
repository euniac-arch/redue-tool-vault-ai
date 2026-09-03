import type {
	AsiEngineId,
	AsiSovCategory,
	AsiSovMetric,
	AsiSovObservation,
	AsiSovPeriod,
	AsiSovSlice,
	SOVResult,
} from '@/lib/ai-search-intelligence/types';
import { ASI_ENGINES, ASI_SOV_CATEGORIES, ASI_SOV_PERIODS } from '@/lib/ai-search-intelligence/types';

export const ASI_SOV_MIN_SAMPLE = 8;
export const ASI_SOV_MIN_SLICE = 4;

/** Alias of the canonical `SOVResult`. Calculator lives only in this file. */
export type AsiSovReport = SOVResult;

function emptyMetric(sampleSize: number): AsiSovMetric {
	return { value: null, sampleSize, brandCount: 0, universeCount: 0, sufficient: false };
}

function ratioMetric(brandCount: number, universeCount: number, sampleSize: number, minSample: number): AsiSovMetric {
	const sufficient = sampleSize >= minSample;
	if (!sufficient) {
		return { value: null, sampleSize, brandCount, universeCount, sufficient: false };
	}
	const value = universeCount <= 0 ? 0 : Math.round((brandCount / universeCount) * 100);
	return { value, sampleSize, brandCount, universeCount, sufficient: true };
}

function mentionCounts(rows: readonly AsiSovObservation[]) {
	let brand = 0;
	let universe = 0;
	let competitor = 0;
	for (const row of rows) {
		if (row.brandMentioned) brand += 1;
		universe += (row.brandMentioned ? 1 : 0) + row.competitorMentions.length;
		competitor += row.competitorMentions.length;
	}
	return { brand, universe, competitor };
}

function recommendationCounts(rows: readonly AsiSovObservation[]) {
	let brand = 0;
	let universe = 0;
	for (const row of rows) {
		const slots = (row.recommended ? 1 : 0) + Math.min(3, row.competitorMentions.length);
		if (slots === 0) continue;
		universe += slots;
		if (row.recommended) brand += 1;
	}
	return { brand, universe };
}

function sharesFromMentions(rows: readonly AsiSovObservation[], mention: AsiSovMetric) {
	const counts = mentionCounts(rows);
	if (!mention.sufficient || counts.universe <= 0) {
		return { brand: mention.value ?? 0, competitor: 0, other: mention.sufficient ? 100 - (mention.value ?? 0) : 0 };
	}
	const brand = Math.round((counts.brand / counts.universe) * 100);
	const competitor = Math.round((counts.competitor / counts.universe) * 100);
	const other = Math.max(0, 100 - brand - competitor);
	return { brand, competitor, other };
}

function sliceFromRows(rows: readonly AsiSovObservation[], label: string, minSample: number): AsiSovSlice & {
	mention: AsiSovMetric;
	recommendation: AsiSovMetric;
} {
	const mention = ratioMetric(
		mentionCounts(rows).brand,
		mentionCounts(rows).universe,
		rows.length,
		minSample,
	);
	const rec = recommendationCounts(rows);
	const recommendation = ratioMetric(rec.brand, rec.universe, rows.length, minSample);
	const share = sharesFromMentions(rows, mention);
	return {
		label,
		brandShare: mention.value ?? 0,
		competitorShare: share.competitor,
		otherShare: share.other,
		sampleSize: rows.length,
		sufficient: mention.sufficient,
		mention,
		recommendation,
	};
}

function withinPeriod(row: AsiSovObservation, period: AsiSovPeriod, now: number): boolean {
	const ts = Date.parse(row.timestamp);
	if (!Number.isFinite(ts)) return false;
	const days = period === '7d' ? 7 : period === '14d' ? 14 : 30;
	return now - ts <= days * 24 * 60 * 60 * 1000;
}

export function emptyAsiSovMetric(sampleSize = 0): AsiSovMetric {
	return emptyMetric(sampleSize);
}

export function calculateAsiSov(
	observations: readonly AsiSovObservation[],
	now = Date.now(),
): AsiSovReport {
	const rows = observations.filter((row) => row.source === 'live' || row.source === 'mock');
	const mentionCountsAll = mentionCounts(rows);
	const recCounts = recommendationCounts(rows);
	const mention = ratioMetric(mentionCountsAll.brand, mentionCountsAll.universe, rows.length, ASI_SOV_MIN_SAMPLE);
	const recommendation = ratioMetric(recCounts.brand, recCounts.universe, rows.length, ASI_SOV_MIN_SAMPLE);
	const shares = sharesFromMentions(rows, mention);

	const byProvider = ASI_ENGINES.map((engine) => {
		const slice = sliceFromRows(
			rows.filter((row) => row.provider === engine),
			engine,
			ASI_SOV_MIN_SLICE,
		);
		return { ...slice, engine };
	});

	const byCategory = ASI_SOV_CATEGORIES.map((category) => {
		const slice = sliceFromRows(
			rows.filter((row) => row.category === category),
			category,
			ASI_SOV_MIN_SLICE,
		);
		return { ...slice, category };
	});

	const queryLabels = [...new Set(rows.map((row) => row.query))];
	const byQuery = queryLabels.map((query) => sliceFromRows(
		rows.filter((row) => row.query === query),
		query,
		ASI_SOV_MIN_SLICE,
	));

	const byPeriod = ASI_SOV_PERIODS.map((period) => {
		const slice = sliceFromRows(
			rows.filter((row) => withinPeriod(row, period, now)),
			period,
			ASI_SOV_MIN_SLICE,
		);
		return {
			period,
			mention: slice.mention,
			recommendation: slice.recommendation,
			brandShare: slice.brandShare,
			competitorShare: slice.competitorShare,
		};
	});

	return {
		mention,
		recommendation,
		sampleSize: rows.length,
		sufficient: mention.sufficient,
		shares,
		byProvider,
		byCategory,
		byQuery,
		byPeriod,
	};
}
