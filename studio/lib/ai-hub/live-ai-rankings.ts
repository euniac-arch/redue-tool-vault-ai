/**
 * Live daily AI-tool ranking — schema, KST calendar helpers, and pure
 * rank / share / mover calculations. No tool-name tables live here; every
 * figure is derived from the catalog payload + the previous day's snapshot.
 */

import { parseMonthlyVisits, type AiTool, type AiToolCategoryId } from '@/lib/admin/ai-tools-management';
import { parseGrowthPercent } from '@/lib/ai-hub/getDailyAiRanking';
import {
	classifyRisingStatus,
	deriveTrendScore,
	resolveGrowthRate,
	sortRisingTools,
	type AiToolRisingStatus,
} from '@/lib/ai-hub/rising-ai-tools';

export type { AIToolItem, AiToolRisingStatus } from '@/lib/ai-hub/rising-ai-tools';
export { sortRisingTools } from '@/lib/ai-hub/rising-ai-tools';

export const AI_RANKING_SOURCE_CAPTION =
	'* 기준: Similarweb & a16z GenAI 글로벌 웹 트래픽 분석 추정치 · 매일 00:00 KST 재검증';

export const HOT_RANK_JUMP = 3;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export type LiveAiRankingCategory = AiToolCategoryId;

export type LivePricingModel = 'Freemium' | 'Paid' | 'Open Source';

/** Wire format requested by the daily rankings pipeline. */
export interface LiveAIToolData {
	id: string;
	name: string;
	developer: string;
	category: LiveAiRankingCategory;
	score: number;
	rating: number;
	trafficIndex: number;
	currentRank: number;
	previousRank: number;
	pricingModel: LivePricingModel;
	pricingDetail: string;
	tags: string[];
	updatedAt: string;
}

export type RankedLiveAiTool = AiTool &
	LiveAIToolData & {
		rankDelta: number;
		isNew: boolean;
		isHot: boolean;
		isRising: boolean;
		status: AiToolRisingStatus;
		growthRate: number;
		trendScore: number;
		formalRank?: number;
		launchDate?: string;
		categoryRank: number;
		previousCategoryRank: number;
		globalSharePct: number;
		categorySharePct: number;
	};

export type DailyRankSnapshotRow = {
	id: string;
	currentRank: number;
	categoryRank: number;
	trafficIndex: number;
	score: number;
};

export type DailyAiRankingAnalysis = {
	topMover: RankedLiveAiTool | null;
	newEntries: RankedLiveAiTool[];
	categoryChampions: Array<{
		key: LiveAiRankingCategory;
		categoryLabel: string;
		tool: RankedLiveAiTool;
	}>;
	globalTop: RankedLiveAiTool[];
	rising: RankedLiveAiTool[];
	topRising: RankedLiveAiTool | null;
};

export type DailyAiRankingsResponse = {
	date: string;
	updatedAt: string;
	source: string;
	tools: RankedLiveAiTool[];
	analysis: DailyAiRankingAnalysis;
	categories: Array<{ id: LiveAiRankingCategory; label: string; icon: string }>;
};

export type RankedAiToolSortKey = 'rank' | 'recommend_score' | 'market_share' | 'rating' | 'name' | 'trend';

function pad2(value: number): string {
	return String(value).padStart(2, '0');
}

function kstParts(now: Date): { y: number; m: number; d: number } {
	const kst = new Date(now.getTime() + KST_OFFSET_MS);
	return { y: kst.getUTCFullYear(), m: kst.getUTCMonth() + 1, d: kst.getUTCDate() };
}

/** `YYYY-MM-DD` in Korea Standard Time. */
export function getKstDateKey(now: Date = new Date()): string {
	const { y, m, d } = kstParts(now);
	return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function shiftDateKey(dateKey: string, days: number): string {
	const [year, month, day] = dateKey.split('-').map(Number);
	const utc = Date.UTC(year, month - 1, day) + days * 86_400_000;
	const shifted = new Date(utc);
	return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

export function parseDateKey(dateKey: string | null | undefined): string | null {
	if (!dateKey) return null;
	const normalized = dateKey.trim().replace(/\./g, '-');
	return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

/** Milliseconds until the next 00:00:00.050 KST. */
export function msUntilNextKstMidnight(from: Date = new Date()): number {
	const { y, m, d } = kstParts(from);
	const nextUtc = Date.UTC(y, m - 1, d + 1, 0, 0, 0, 50) - KST_OFFSET_MS;
	return Math.max(50, nextUtc - from.getTime());
}

export function formatKstRankingAsOfLabel(dateKey: string): string {
	const [year, month, day] = dateKey.split('-').map(Number);
	return `${year}년 ${month}월 ${day}일 기준 (KST)`;
}

export function toPricingModel(type: string): LivePricingModel {
	const token = (type || '').toLowerCase();
	if (token.includes('open')) return 'Open Source';
	if (token.includes('paid') && !token.includes('free')) return 'Paid';
	return 'Freemium';
}

export function inferYesterdayTrafficIndex(tool: Pick<AiTool, 'monthly_visits' | 'growth'>): number {
	const today = Math.max(0, parseMonthlyVisits(tool.monthly_visits));
	const growthPct = parseGrowthPercent(tool.growth);
	const denom = 1 + growthPct / 100;
	if (!Number.isFinite(denom) || denom <= 0) return today;
	return today / denom;
}

function compareTrafficThenScore(
	a: { trafficIndex: number; score: number; id: string },
	b: { trafficIndex: number; score: number; id: string },
): number {
	return b.trafficIndex - a.trafficIndex || b.score - a.score || a.id.localeCompare(b.id);
}

function assignRanks<T extends { id: string; trafficIndex: number; score: number }>(
	items: T[],
): Map<string, number> {
	const ranked = [...items].sort(compareTrafficThenScore);
	const ranks = new Map<string, number>();
	ranked.forEach((item, index) => {
		ranks.set(item.id, index + 1);
	});
	return ranks;
}

function round1(value: number): number {
	return Math.round(value * 10) / 10;
}

/** Normalize an index onto a 100% base. `share = index / sum(indexes) * 100`. */
export function normalizeSharePct(index: number, total: number): number {
	if (!(total > 0) || !(index > 0)) return 0;
	return round1((index / total) * 100);
}

export function normalizeShareMap(entries: Array<{ id: string; index: number }>): Map<string, number> {
	const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.index), 0);
	const shares = new Map<string, number>();
	for (const entry of entries) {
		shares.set(entry.id, normalizeSharePct(entry.index, total));
	}
	return shares;
}

export function computeDailyRankings(
	catalog: AiTool[],
	previousById: Map<string, DailyRankSnapshotRow>,
	updatedAt: string,
	options?: { hasYesterdaySnapshot?: boolean },
): RankedLiveAiTool[] {
	const scored = catalog.map((tool) => ({
		tool,
		trafficIndex: Math.max(0, parseMonthlyVisits(tool.monthly_visits)),
		score: tool.recommend_score,
		yesterdayTraffic: previousById.has(tool.id)
			? previousById.get(tool.id)!.trafficIndex
			: inferYesterdayTrafficIndex(tool),
	}));

	const currentRanks = assignRanks(
		scored.map((row) => ({ id: row.tool.id, trafficIndex: row.trafficIndex, score: row.score })),
	);
	const inferredYesterdayRanks = assignRanks(
		scored.map((row) => ({
			id: row.tool.id,
			trafficIndex: row.yesterdayTraffic,
			score: row.score,
		})),
	);

	const byCategory = new Map<LiveAiRankingCategory, typeof scored>();
	for (const row of scored) {
		const list = byCategory.get(row.tool.category) ?? [];
		list.push(row);
		byCategory.set(row.tool.category, list);
	}

	const categoryRanks = new Map<string, number>();
	const inferredYesterdayCategoryRanks = new Map<string, number>();
	for (const group of byCategory.values()) {
		for (const [id, rank] of assignRanks(
			group.map((row) => ({ id: row.tool.id, trafficIndex: row.trafficIndex, score: row.score })),
		)) {
			categoryRanks.set(id, rank);
		}
		for (const [id, rank] of assignRanks(
			group.map((row) => ({
				id: row.tool.id,
				trafficIndex: row.yesterdayTraffic,
				score: row.score,
			})),
		)) {
			inferredYesterdayCategoryRanks.set(id, rank);
		}
	}

	const globalShares = normalizeShareMap(scored.map((row) => ({ id: row.tool.id, index: row.trafficIndex })));
	const categoryShares = new Map<string, number>();
	for (const group of byCategory.values()) {
		const shares = normalizeShareMap(group.map((row) => ({ id: row.tool.id, index: row.trafficIndex })));
		for (const [id, share] of shares) categoryShares.set(id, share);
	}

	return scored
		.map(({ tool, trafficIndex, score }) => {
			const currentRank = currentRanks.get(tool.id) ?? 0;
			const snapshot = previousById.get(tool.id);
			const hasYesterday = options?.hasYesterdaySnapshot === true && previousById.size > 0;
			const previousRank = hasYesterday
				? (snapshot?.currentRank ?? 0)
				: (snapshot?.currentRank ?? inferredYesterdayRanks.get(tool.id) ?? 0);
			const categoryRank = categoryRanks.get(tool.id) ?? 0;
			const previousCategoryRank = hasYesterday
				? (snapshot?.categoryRank ?? 0)
				: (snapshot?.categoryRank ?? inferredYesterdayCategoryRanks.get(tool.id) ?? 0);
			const isNew = previousRank === 0;
			const rankDelta = previousRank > 0 ? previousRank - currentRank : 0;
			const isHot = !isNew && rankDelta >= HOT_RANK_JUMP;
			const growthRate = resolveGrowthRate(tool);
			const launchDate = tool.launch_date;
			const trendScore = deriveTrendScore({
				growthRate,
				rankDelta,
				isNew,
				isHot,
				launchDate,
				catalogTrendScore: tool.trend_score,
			});
			const rising = classifyRisingStatus({
				growthRate,
				trendScore,
				currentRank,
				rankDelta,
				isNew,
				isHot,
				launchDate,
			});
			const categorySharePct = categoryShares.get(tool.id) ?? 0;
			const globalSharePct = globalShares.get(tool.id) ?? 0;
			const live: LiveAIToolData = {
				id: tool.id,
				name: tool.name,
				developer: tool.provider,
				category: tool.category,
				score,
				rating: tool.rating,
				trafficIndex,
				currentRank,
				previousRank,
				pricingModel: toPricingModel(tool.pricing.type),
				pricingDetail: tool.pricing.summary,
				tags: [...tool.tags],
				updatedAt,
			};
			return {
				...tool,
				...live,
				provider: tool.provider,
				market_share: categorySharePct,
				rankDelta,
				isNew,
				isHot,
				isRising: rising.isRising,
				status: rising.status,
				growthRate,
				trendScore,
				formalRank: rising.formalRank,
				launchDate,
				categoryRank,
				previousCategoryRank,
				globalSharePct,
				categorySharePct,
			};
		})
		.sort((a, b) => a.currentRank - b.currentRank);
}

export function toDailySnapshotRows(tools: RankedLiveAiTool[]): DailyRankSnapshotRow[] {
	return tools.map((tool) => ({
		id: tool.id,
		currentRank: tool.currentRank,
		categoryRank: tool.categoryRank,
		trafficIndex: tool.trafficIndex,
		score: tool.score,
	}));
}

export function analyzeDailyRankings(
	tools: RankedLiveAiTool[],
	categoryLabels: Partial<Record<LiveAiRankingCategory, string>>,
	globalLimit = 10,
): DailyAiRankingAnalysis {
	const movers = tools.filter((tool) => !tool.isNew && tool.previousRank > 0);
	const topMover =
		movers.length === 0
			? null
			: movers.reduce((best, tool) => {
					if (tool.rankDelta !== best.rankDelta) return tool.rankDelta > best.rankDelta ? tool : best;
					return parseGrowthPercent(tool.growth) > parseGrowthPercent(best.growth) ? tool : best;
				});

	const newEntries = tools
		.filter((tool) => tool.isNew || tool.previousRank === 0)
		.sort((a, b) => b.score - a.score || a.currentRank - b.currentRank);

	const championByCategory = new Map<LiveAiRankingCategory, RankedLiveAiTool>();
	for (const tool of tools) {
		const current = championByCategory.get(tool.category);
		if (!current || tool.score > current.score || (tool.score === current.score && tool.trafficIndex > current.trafficIndex)) {
			championByCategory.set(tool.category, tool);
		}
	}

	const categoryOrder: LiveAiRankingCategory[] = ['llm', 'image', 'video', 'audio', 'code', 'hub'];
	const categoryChampions = categoryOrder
		.filter((key) => championByCategory.has(key))
		.map((key) => ({
			key,
			categoryLabel: categoryLabels[key] ?? key,
			tool: championByCategory.get(key)!,
		}));

	const rising = sortRisingTools(tools);
	return {
		topMover,
		newEntries,
		categoryChampions,
		globalTop: [...tools].sort((a, b) => a.currentRank - b.currentRank).slice(0, globalLimit),
		rising,
		topRising: rising[0] ?? null,
	};
}

export function sortRankedAiTools(tools: RankedLiveAiTool[], sortKey: RankedAiToolSortKey, scopedToCategory: boolean): RankedLiveAiTool[] {
	const sorted = [...tools];
	if (sortKey === 'name') {
		sorted.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
		return sorted;
	}
	if (sortKey === 'rank') {
		sorted.sort((a, b) => (scopedToCategory ? a.categoryRank - b.categoryRank : a.currentRank - b.currentRank));
		return sorted;
	}
	if (sortKey === 'trend') {
		sorted.sort((a, b) => b.trendScore - a.trendScore || b.growthRate - a.growthRate);
		return sorted;
	}
	if (sortKey === 'market_share') {
		sorted.sort((a, b) =>
			scopedToCategory ? b.categorySharePct - a.categorySharePct : b.globalSharePct - a.globalSharePct,
		);
		return sorted;
	}
	sorted.sort((a, b) => b[sortKey] - a[sortKey]);
	return sorted;
}

export function displayRank(tool: RankedLiveAiTool, scopedToCategory: boolean): number {
	return scopedToCategory ? tool.categoryRank : tool.currentRank;
}

export function displayRankDelta(tool: RankedLiveAiTool, scopedToCategory: boolean): number {
	if (tool.isNew) return 0;
	if (scopedToCategory) {
		return tool.previousCategoryRank > 0 ? tool.previousCategoryRank - tool.categoryRank : 0;
	}
	return tool.rankDelta;
}
