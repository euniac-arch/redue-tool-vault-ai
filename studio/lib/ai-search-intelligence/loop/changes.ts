/**
 * WHAT CHANGED — last measurement vs previous stored record only.
 * Never invent query / citation / competitor movement.
 */
import type { AsiLoopChanges, AsiVisibilityRecord, AsiVisibilityTrend } from '@/lib/ai-search-intelligence/types';

export function emptyAsiLoopChanges(): AsiLoopChanges {
	return {
		hasPrevious: false,
		queryExposure: null,
		citation: null,
		competitorName: null,
		competitorChangePct: null,
		competitorChange: null,
	};
}

function round1(value: number): number {
	return Math.round(value * 10) / 10;
}

function queryExposureGain(latest: AsiVisibilityRecord, previous: AsiVisibilityRecord): number | null {
	if (!latest.queries.length && !previous.queries.length) return null;
	const prevByQuery = new Map(previous.queries.map((row) => [row.query.trim().toLowerCase(), row]));
	let gained = 0;
	for (const row of latest.queries) {
		const prior = prevByQuery.get(row.query.trim().toLowerCase());
		if ((prior?.mentionRate ?? 0) < row.mentionRate) gained += 1;
	}
	return gained;
}

function citationDelta(latest: AsiVisibilityRecord, previous: AsiVisibilityRecord): number {
	if (latest.queries.length || previous.queries.length) {
		const citedNow = latest.queries.filter((row) => row.citationRate > 0).length;
		const citedPrev = previous.queries.filter((row) => row.citationRate > 0).length;
		return citedNow - citedPrev;
	}
	return round1(latest.citation - previous.citation);
}

function risingCompetitor(latest: AsiVisibilityRecord, previous: AsiVisibilityRecord) {
	const names = new Set([...Object.keys(latest.competitorScores), ...Object.keys(previous.competitorScores)]);
	let best: { name: string; change: number; changePct: number | null } | null = null;
	for (const name of names) {
		const current = latest.competitorScores[name];
		const prior = previous.competitorScores[name];
		if (current == null || prior == null) continue;
		const change = round1(current - prior);
		if (change <= 0) continue;
		if (!best || change > best.change) {
			best = {
				name,
				change,
				changePct: prior === 0 ? null : round1((change / prior) * 100),
			};
		}
	}
	return best;
}

export function composeAsiLoopChanges(
	latest: AsiVisibilityRecord | null,
	previous: AsiVisibilityRecord | null,
): AsiLoopChanges {
	if (!latest || !previous) return emptyAsiLoopChanges();
	const rising = risingCompetitor(latest, previous);
	return {
		hasPrevious: true,
		queryExposure: queryExposureGain(latest, previous),
		citation: citationDelta(latest, previous),
		competitorName: rising?.name ?? null,
		competitorChangePct: rising?.changePct ?? null,
		competitorChange: rising?.change ?? null,
	};
}

export function changesFromVisibilityTrend(trend: AsiVisibilityTrend | null | undefined): AsiLoopChanges {
	if (!trend?.hasPrevious) return emptyAsiLoopChanges();
	const rising = [...trend.competitors]
		.filter((row) => row.kind === 'competitor' && row.change != null && row.change > 0)
		.sort((a, b) => (b.change ?? 0) - (a.change ?? 0))[0];
	const prior = rising?.previous;
	return {
		hasPrevious: true,
		queryExposure: null,
		citation: trend.kpis.citation.change,
		competitorName: rising?.name ?? null,
		competitorChange: rising?.change ?? null,
		competitorChangePct:
			rising && prior != null && prior !== 0 && rising.change != null
				? round1((rising.change / prior) * 100)
				: null,
	};
}
