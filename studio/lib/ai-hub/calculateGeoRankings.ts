/**
 * Derives per-engine GEO fitness (`geoScore`) and AI-answer citation rate
 * (`citationRate`) from each tool's own live ranking signals — never a shared
 * constant, so cards can't show duplicated or NaN values. Every number is
 * computed from that one item's `marketSharePct` / `recommend_score` /
 * `rating` / `growth` / tags, plus a small deterministic (id-seeded, so it's
 * stable across renders) variance term that keeps otherwise-similar tools
 * from landing on the exact same score.
 *
 * `auditSignals` is the extension point: once a real site diagnostic
 * (`auditResult`) has measured how an engine actually treats this domain,
 * pass its measured GEO score / citation rate here and this engine's output
 * blends toward the measured value instead of the generic estimate.
 */

import type { AiEngineMetric, RankingItem } from '@/types/ai-engine-metric';

/** Minimal duck-typed shape — matches both `AiTool` and `RankedLiveAiTool` without importing them. */
export interface GeoRankingInput {
	id: string;
	name: string;
	provider: string;
	category: string;
	tags?: readonly string[];
	recommend_score?: number;
	rating?: number;
	growth?: string;
	market_share?: number;
	/** Present on `RankedLiveAiTool` once daily ranking has run; preferred over `market_share` when available. */
	globalSharePct?: number;
	rankDelta?: number;
	isNew?: boolean;
}

/** Real, measured signal for one engine from an actual site GEO audit. */
export interface GeoAuditSignal {
	toolId: string;
	/** 0~100 measured GEO diagnostic score for this engine on the audited site. */
	auditGeoScore?: number;
	/** 0~100 measured citation/reference rate for this engine on the audited site. */
	auditCitationRate?: number;
}

const CITATION_TAG_NEEDLES = ['GEO', '검색엔진', '실시간리서치', '인용', 'Citation', 'citation'];

function clamp(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
	return Math.round(value * 10) / 10;
}

/** Deterministic pseudo-random offset in `[-spread, spread]`, stable for a given id (no Math.random). */
function seededVariance(seed: string, spread: number): number {
	let hash = 0;
	for (let i = 0; i < seed.length; i += 1) {
		hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
	}
	return ((hash % 1000) / 1000 - 0.5) * 2 * spread;
}

function parseGrowthPct(growth: string | undefined): number {
	if (!growth) return 0;
	const match = /-?\d+(\.\d+)?/.exec(growth);
	if (!match) return 0;
	const value = Number(match[0]);
	return Number.isFinite(value) ? value : 0;
}

function hasCitationSignal(tags: readonly string[] | undefined): boolean {
	if (!tags || tags.length === 0) return false;
	return tags.some((tag) => CITATION_TAG_NEEDLES.some((needle) => tag.includes(needle)));
}

/** This engine's global share, 0~100 — prefers the live-computed `globalSharePct` when present. */
export function marketShareOf(tool: GeoRankingInput): number {
	const value = typeof tool.globalSharePct === 'number' ? tool.globalSharePct : tool.market_share ?? 0;
	return clamp(value, 0, 100);
}

/** GEO fitness score, 0~100 — see module doc for the formula. */
export function geoScoreOf(tool: GeoRankingInput, auditSignal?: GeoAuditSignal): number {
	const marketSharePct = marketShareOf(tool);
	const recommendScore = clamp(tool.recommend_score ?? 0, 0, 100);
	const ratingScore = clamp((tool.rating ?? 0) * 20, 0, 100);
	const growthBoost = clamp(parseGrowthPct(tool.growth), -50, 50);
	const citationTagBoost = hasCitationSignal(tool.tags) ? 8 : 0;

	const estimate =
		marketSharePct * 0.35 + recommendScore * 0.35 + ratingScore * 0.2 + growthBoost * 0.1 + citationTagBoost;
	const variance = seededVariance(`${tool.id}:geo`, 4);

	if (auditSignal?.auditGeoScore != null && Number.isFinite(auditSignal.auditGeoScore)) {
		return round1(clamp(estimate * 0.4 + auditSignal.auditGeoScore * 0.6, 0, 100));
	}
	return round1(clamp(estimate + variance, 0, 100));
}

/** AI-answer citation rate, 0~100 — see module doc for the formula. */
export function citationRateOf(tool: GeoRankingInput, auditSignal?: GeoAuditSignal): number {
	const marketSharePct = marketShareOf(tool);
	const recommendScore = clamp(tool.recommend_score ?? 0, 0, 100);
	const citationTagBoost = hasCitationSignal(tool.tags) ? 12 : 0;

	const estimate = marketSharePct * 0.55 + recommendScore * 0.25 + citationTagBoost;
	const variance = seededVariance(`${tool.id}:citation`, 5);

	if (auditSignal?.auditCitationRate != null && Number.isFinite(auditSignal.auditCitationRate)) {
		return round1(clamp(estimate * 0.4 + auditSignal.auditCitationRate * 0.6, 0, 100));
	}
	return round1(clamp(estimate + variance, 0, 100));
}

/** Bundles the three per-engine numbers used across the ranking widgets. */
export function toAiEngineMetric(tool: GeoRankingInput, auditSignal?: GeoAuditSignal): AiEngineMetric {
	return {
		id: tool.id,
		name: tool.name,
		provider: tool.provider,
		category: tool.category,
		marketSharePct: round1(marketShareOf(tool)),
		geoScore: geoScoreOf(tool, auditSignal),
		citationRate: citationRateOf(tool, auditSignal),
	};
}

/**
 * Computes GEO fitness + citation rate for every tool, sorts by `geoScore`
 * (desc, tie-broken by market share), and assigns sequential 1st..Nth ranks
 * — the single source of truth behind "글로벌 점유율 프리뷰 TOP 8" and
 * "아래 정렬된 AI 들". Pass `auditSignals` once a real site diagnostic
 * (`auditResult`) is available to blend in measured per-engine numbers.
 */
export function calculateGeoRankings(tools: readonly GeoRankingInput[], auditSignals: readonly GeoAuditSignal[] = []): RankingItem[] {
	const signalById = new Map(auditSignals.map((signal) => [signal.toolId, signal]));

	const withMetrics = tools.map((tool) => {
		const signal = signalById.get(tool.id);
		const metric = toAiEngineMetric(tool, signal);
		const rankDelta = Number.isFinite(tool.rankDelta) ? Math.trunc(tool.rankDelta as number) : 0;
		const isNew = tool.isNew === true;
		return {
			metric,
			rankChange: {
				direction: (isNew ? 'up' : rankDelta > 0 ? 'up' : rankDelta < 0 ? 'down' : 'same') as RankingItem['rankChange']['direction'],
				diff: isNew ? 0 : Math.abs(rankDelta),
			},
			isNew,
		};
	});

	return withMetrics
		.sort((a, b) => b.metric.geoScore - a.metric.geoScore || b.metric.marketSharePct - a.metric.marketSharePct)
		.map((row, index) => ({
			...row.metric,
			rank: index + 1,
			rankChange: row.rankChange,
			isNew: row.isNew,
		}));
}
