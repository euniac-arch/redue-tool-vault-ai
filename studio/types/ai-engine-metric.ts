/**
 * Shared shape for "global AI engine" ranking widgets (오늘자 순위 분석보기 /
 * 글로벌 점유율 프리뷰 TOP 8 / 아래 정렬된 AI 들). Kept independent from the
 * catalog/live-ranking types so it can be reused by any ranking surface
 * (AI Hub cards, GEO audit panels, etc.) without a circular import.
 */

/** Direction of a rank move since the previous snapshot. */
export type RankTrend = 'up' | 'down' | 'same';

/** How far (and which way) an engine's rank moved since the previous snapshot. */
export interface RankChange {
	direction: RankTrend;
	/** Always >= 0. Number of positions moved (0 when `direction === 'same'`). */
	diff: number;
}

/**
 * Per-engine benchmark metrics. Every field is a finite, defensively-clamped
 * number — never `undefined`/`NaN` — so UI can render it directly.
 */
export interface AiEngineMetric {
	id: string;
	name: string;
	provider: string;
	category: string;
	/** Global market share, 0~100. */
	marketSharePct: number;
	/** GEO(Generative Engine Optimization) fitness score, 0~100. */
	geoScore: number;
	/** Share of AI-answer citations/references attributed to this engine, 0~100. */
	citationRate: number;
}

/** A fully rendered leaderboard row: metric + rank + trend, ready for display. */
export interface RankingItem extends AiEngineMetric {
	/** 1-based position after sorting (1st, 2nd, 3rd, ...). */
	rank: number;
	rankChange: RankChange;
	isNew: boolean;
}
