/**
 * Adjacent remesasure compare: last snapshot vs the one before it.
 * Monday 51 → Tuesday 57 is +6, independent of the 7d window previous.
 */
import type {
	AsiVisibilityAlert,
	AsiVisibilityCompetitorRow,
	AsiVisibilityDelta,
	AsiVisibilityRecord,
	AsiVisibilityRemeasureComparison,
	AsiVisibilityTrend,
} from '@/lib/ai-search-intelligence/types';
import { generateVisibilityAlerts } from '@/lib/ai-search-intelligence/visibility/alerts';

function delta(current: number | null, previous: number | null): AsiVisibilityDelta {
	if (current == null || previous == null) {
		return { current, previous, change: null, changePct: null, provenance: 'observed' };
	}
	const change = Math.round((current - previous) * 10) / 10;
	const changePct = previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10;
	return { current, previous, change, changePct, provenance: 'observed' };
}

function competitorRows(previous: AsiVisibilityRecord, current: AsiVisibilityRecord): AsiVisibilityCompetitorRow[] {
	const names = [...new Set([...Object.keys(previous.competitorScores), ...Object.keys(current.competitorScores)])];
	return names.map((name) => {
		const now = current.competitorScores[name] ?? null;
		const before = previous.competitorScores[name] ?? null;
		return {
			name,
			kind: 'competitor' as const,
			current: now,
			previous: before,
			change: now != null && before != null ? Math.round((now - before) * 10) / 10 : null,
		};
	});
}

function adjacentTrend(previous: AsiVisibilityRecord, current: AsiVisibilityRecord): AsiVisibilityTrend {
	return {
		window: 'today',
		kpis: {
			visibility: delta(current.visibility, previous.visibility),
			recommendation: delta(current.recommendation, previous.recommendation),
			citation: delta(current.citation, previous.citation),
			sov: delta(current.sov, previous.sov),
		},
		providers: [],
		competitors: competitorRows(previous, current),
		gap: {
			brandCurrent: current.visibility,
			brandPrevious: previous.visibility,
			competitorName: competitorRows(previous, current).sort((a, b) => (b.current ?? 0) - (a.current ?? 0))[0]?.name ?? null,
			competitorCurrent: null,
			competitorPrevious: null,
			widened: false,
		},
		points: [],
		hasPrevious: true,
	};
}

export function compareAdjacentVisibility(
	records: readonly AsiVisibilityRecord[],
): AsiVisibilityRemeasureComparison | null {
	const current = records[records.length - 1];
	const previous = records[records.length - 2];
	if (!current || !previous) return null;

	const trend = adjacentTrend(previous, current);
	const top = trend.gap.competitorName;
	if (top) {
		trend.gap.competitorCurrent = current.competitorScores[top] ?? null;
		trend.gap.competitorPrevious = previous.competitorScores[top] ?? null;
		const gapNow =
			trend.gap.competitorCurrent != null ? trend.gap.competitorCurrent - current.visibility : null;
		const gapPrev =
			trend.gap.competitorPrevious != null ? trend.gap.competitorPrevious - previous.visibility : null;
		trend.gap.widened = gapNow != null && gapPrev != null && gapNow > gapPrev;
	}

	const alerts: AsiVisibilityAlert[] = generateVisibilityAlerts({
		records: [previous, current],
		trend,
		window: 'today',
		previous,
	}).map((row) => ({ ...row, id: `remeasure::${row.id}` }));

	return {
		previousAt: previous.timestamp,
		currentAt: current.timestamp,
		queryCount: current.queryCount,
		visibility: trend.kpis.visibility,
		sov: trend.kpis.sov,
		recommendation: trend.kpis.recommendation,
		citation: trend.kpis.citation,
		competitors: trend.competitors,
		alerts,
	};
}
