import { ASI_ENGINES } from '@/lib/ai-search-intelligence/types';
import type {
	AsiMonitorPoint,
	AsiVisibilityDelta,
	AsiVisibilityRecord,
	AsiVisibilityTrend,
	AsiVisibilityWindow,
} from '@/lib/ai-search-intelligence/types';
import { ASI_VISIBILITY_CONFIG } from '@/lib/ai-search-intelligence/visibility/config';

function startOfUtcDay(ms: number): number {
	const date = new Date(ms);
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function windowStartMs(window: AsiVisibilityWindow, now = Date.now()): number {
	if (window === 'today') return startOfUtcDay(now);
	return now - ASI_VISIBILITY_CONFIG.windows[window] * 24 * 60 * 60 * 1000;
}

function parseTs(value: string): number {
	const ms = Date.parse(value);
	return Number.isFinite(ms) ? ms : 0;
}

export function recordsInWindow(
	records: readonly AsiVisibilityRecord[],
	window: AsiVisibilityWindow,
	now = Date.now(),
): AsiVisibilityRecord[] {
	const start = windowStartMs(window, now);
	return records.filter((row) => parseTs(row.timestamp) >= start);
}

export function previousRecord(
	records: readonly AsiVisibilityRecord[],
	window: AsiVisibilityWindow,
	now = Date.now(),
): AsiVisibilityRecord | null {
	const sorted = [...records].sort((a, b) => parseTs(a.timestamp) - parseTs(b.timestamp));
	if (sorted.length < 2) return null;
	const start = windowStartMs(window, now);
	const inWindow = recordsInWindow(sorted, window, now);
	const current = inWindow[inWindow.length - 1] ?? sorted[sorted.length - 1];
	if (!current) return null;
	const currentTs = parseTs(current.timestamp);

	const beforeWindow = sorted.filter((row) => {
		const ts = parseTs(row.timestamp);
		return ts < start && ts < currentTs;
	});
	if (beforeWindow.length) return beforeWindow[beforeWindow.length - 1] ?? null;

	const firstInWindow = inWindow[0];
	if (firstInWindow && parseTs(firstInWindow.timestamp) < currentTs) return firstInWindow;

	const beforeCurrent = sorted.filter((row) => parseTs(row.timestamp) < currentTs);
	return beforeCurrent[beforeCurrent.length - 1] ?? null;
}

function delta(current: number | null, previous: number | null): AsiVisibilityDelta {
	if (current == null || previous == null) {
		return { current, previous, change: null, changePct: null, provenance: 'observed' };
	}
	const change = Math.round((current - previous) * 10) / 10;
	const changePct = previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10;
	return { current, previous, change, changePct, provenance: 'observed' };
}

function labelFor(timestamp: string, window: AsiVisibilityWindow): string {
	const date = new Date(timestamp);
	if (window === 'today') {
		return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
	}
	return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

function toPoint(record: AsiVisibilityRecord, window: AsiVisibilityWindow): AsiMonitorPoint {
	return {
		label: labelFor(record.timestamp, window),
		mention: record.mention,
		recommendationRate: record.recommendation,
		shareOfVoice: record.sov,
		citationCount: record.citation,
		visibilityScore: record.visibility,
	};
}

export function buildVisibilityTrend(input: {
	records: readonly AsiVisibilityRecord[];
	window: AsiVisibilityWindow;
	brand: string;
	now?: number;
}): AsiVisibilityTrend {
	const now = input.now ?? Date.now();
	const inWindow = recordsInWindow(input.records, input.window, now);
	const current = inWindow[inWindow.length - 1] ?? input.records[input.records.length - 1] ?? null;
	const previous = previousRecord(input.records, input.window, now);
	const topCompetitor = (() => {
		const scores = current?.competitorScores ?? previous?.competitorScores ?? {};
		const names = Object.keys(scores);
		if (!names.length) return null;
		return names.sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))[0];
	})();

	const brandCurrent = current?.visibility ?? null;
	const brandPrevious = previous?.visibility ?? null;
	const competitorCurrent = topCompetitor ? (current?.competitorScores[topCompetitor] ?? null) : null;
	const competitorPrevious = topCompetitor ? (previous?.competitorScores[topCompetitor] ?? null) : null;
	const gapNow = brandCurrent != null && competitorCurrent != null ? competitorCurrent - brandCurrent : null;
	const gapPrev =
		brandPrevious != null && competitorPrevious != null ? competitorPrevious - brandPrevious : null;

	return {
		window: input.window,
		kpis: {
			visibility: delta(current?.visibility ?? null, previous?.visibility ?? null),
			recommendation: delta(current?.recommendation ?? null, previous?.recommendation ?? null),
			citation: delta(current?.citation ?? null, previous?.citation ?? null),
			sov: delta(current?.sov ?? null, previous?.sov ?? null),
		},
		providers: ASI_ENGINES.map((engine) => ({
			engine,
			current: current?.providerScores[engine] ?? null,
			previous: previous?.providerScores[engine] ?? null,
			change:
				current?.providerScores[engine] != null && previous?.providerScores[engine] != null
					? Math.round(((current.providerScores[engine] ?? 0) - (previous.providerScores[engine] ?? 0)) * 10) / 10
					: null,
		})),
		competitors: [
			{
				name: input.brand,
				kind: 'brand' as const,
				current: brandCurrent,
				previous: brandPrevious,
				change: brandCurrent != null && brandPrevious != null ? brandCurrent - brandPrevious : null,
			},
			...Object.keys({ ...(current?.competitorScores ?? {}), ...(previous?.competitorScores ?? {}) }).map((name) => ({
				name,
				kind: 'competitor' as const,
				current: current?.competitorScores[name] ?? null,
				previous: previous?.competitorScores[name] ?? null,
				change:
					current?.competitorScores[name] != null && previous?.competitorScores[name] != null
						? (current.competitorScores[name] ?? 0) - (previous.competitorScores[name] ?? 0)
						: null,
			})),
		],
		gap: {
			brandCurrent,
			brandPrevious,
			competitorName: topCompetitor,
			competitorCurrent,
			competitorPrevious,
			widened: gapNow != null && gapPrev != null && gapNow > gapPrev,
		},
		points: [
			...(previous && !inWindow.some((row) => row.timestamp === previous.timestamp) ? [toPoint(previous, input.window)] : []),
			...inWindow.map((row) => toPoint(row, input.window)),
		],
		hasPrevious: Boolean(previous),
	};
}
