/**
 * Official ranking snapshot + a single daily overlay used by the preview bar,
 * directory cards, and the "오늘자 순위 분석" modal so every surface prints
 * the same share / growth for the same tool on the same local calendar day.
 */

import type { AiTool, AiToolCategoryId } from '@/lib/admin/ai-tools-management';
import { applyDailyGlobalRanking, applyDailyMarketShares } from '@/lib/ai-hub/getDailyAiRanking';

export const AI_RANKING_SOURCE_CAPTION =
	'* 기준: Similarweb & a16z GenAI 글로벌 웹 트래픽 분석 추정치';

export type AiGlobalRankRow = {
	id: string;
	name: string;
	provider: string;
	/** Catalog category — used for accent color / admin category chip only. */
	category: AiToolCategoryId;
	monthly_visits: string;
	/** Share of global generative-AI web traffic (0–100). */
	globalSharePct: number;
	growth: string;
};

export type AiCategoryChampionRow = {
	/** Stable key for React lists. `search` is a ranking-only slice, not a catalog tab. */
	key: string;
	label: string;
	toolId: string;
	/** User share *within this field*, not global web-traffic share. */
	categoryShare: number;
};

/** Global generative-AI web traffic ranking (TOP 10). First 8 power the home preview. */
export const AI_GLOBAL_TOP_10: readonly AiGlobalRankRow[] = [
	{ id: 'chatgpt', name: 'ChatGPT', provider: 'OpenAI', category: 'llm', monthly_visits: '5.2B', globalSharePct: 54.2, growth: '+3.2%' },
	{ id: 'gemini', name: 'Gemini', provider: 'Google', category: 'llm', monthly_visits: '2.5B', globalSharePct: 25.8, growth: '+8.5%' },
	{ id: 'claude', name: 'Claude', provider: 'Anthropic', category: 'llm', monthly_visits: '810M', globalSharePct: 8.4, growth: '+14.2%' },
	{ id: 'deepseek', name: 'DeepSeek', provider: 'DeepSeek', category: 'llm', monthly_visits: '390M', globalSharePct: 4.1, growth: '+12.0%' },
	{ id: 'perplexity', name: 'Perplexity AI', provider: 'Perplexity', category: 'llm', monthly_visits: '250M', globalSharePct: 2.6, growth: '+6.8%' },
	{ id: 'grok', name: 'Grok', provider: 'xAI', category: 'llm', monthly_visits: '135M', globalSharePct: 1.4, growth: '+4.5%' },
	{ id: 'midjourney', name: 'Midjourney', provider: 'Midjourney', category: 'image', monthly_visits: '87M', globalSharePct: 0.9, growth: '-1.2%' },
	{ id: 'canva-ai', name: 'Canva AI', provider: 'Canva', category: 'image', monthly_visits: '68M', globalSharePct: 0.7, growth: '+5.1%' },
	{ id: 'poe', name: 'Poe', provider: 'Quora', category: 'hub', monthly_visits: '58M', globalSharePct: 0.6, growth: '-0.8%' },
	{ id: 'runway', name: 'Runway', provider: 'Runway', category: 'video', monthly_visits: '45M', globalSharePct: 0.5, growth: '+7.4%' },
] as const;

export const AI_PREVIEW_TOP_8: readonly AiGlobalRankRow[] = AI_GLOBAL_TOP_10.slice(0, 8);

export const AI_CATEGORY_CHAMPIONS: readonly AiCategoryChampionRow[] = [
	{ key: 'llm', label: '대화형 LLM / 종합 AI', toolId: 'chatgpt', categoryShare: 54.2 },
	{ key: 'code', label: '코딩 & 엔지니어링', toolId: 'cursor', categoryShare: 38.5 },
	{ key: 'image', label: '이미지 생성', toolId: 'midjourney', categoryShare: 41.2 },
	{ key: 'video', label: '비디오 & 영상 생성', toolId: 'runway', categoryShare: 32.0 },
	{ key: 'audio', label: '음성 합성 & 사운드', toolId: 'elevenlabs', categoryShare: 46.5 },
	{ key: 'search', label: 'AI 검색 & 리서치', toolId: 'perplexity', categoryShare: 58.0 },
] as const;

export type RankedAiTool = AiTool & { globalSharePct: number };

export type ResolvedCategoryChampion = {
	key: string;
	categoryLabel: string;
	tool: AiTool;
};

function catalogById(tools: AiTool[]): Map<string, AiTool> {
	return new Map(tools.map((tool) => [tool.id, tool]));
}

function stubTool(row: {
	id: string;
	name: string;
	provider: string;
	category: AiToolCategoryId;
	monthly_visits: string;
	growth: string;
	market_share: number;
}): AiTool {
	return {
		id: row.id,
		name: row.name,
		provider: row.provider,
		url: '',
		logo_url: '',
		desc: '',
		tags: [],
		is_public: true,
		market_share: row.market_share,
		monthly_visits: row.monthly_visits,
		recommend_score: 90,
		rating: 4.7,
		growth: row.growth,
		pricing: { type: '', summary: '', free_tier: '', paid_tier: '' },
		guide: { steps: ['', '', ''], pro_tip: '' },
		category: row.category,
	};
}

/**
 * One daily pass for cards + ranking. Category tools get the date-seeded
 * category share; tools in `AI_GLOBAL_TOP_10` are then overwritten with that
 * day's global traffic share / growth so the list, preview bar, and modal
 * never disagree on ChatGPT · Gemini · etc.
 */
export function applyUnifiedDailyStats(tools: AiTool[], date: Date = new Date()): AiTool[] {
	const withCategory = applyDailyMarketShares(tools, date);
	const globalById = new Map(applyDailyGlobalRanking(AI_GLOBAL_TOP_10, date).map((row) => [row.id, row]));
	return withCategory.map((tool) => {
		const global = globalById.get(tool.id);
		if (!global) return tool;
		return {
			...tool,
			market_share: global.globalSharePct,
			growth: global.growth,
			monthly_visits: global.monthly_visits,
		};
	});
}

/** Official global TOP N — same shares as `applyUnifiedDailyStats` for that day. */
export function resolveOfficialGlobalTop(tools: AiTool[], limit = 10, date: Date = new Date()): RankedAiTool[] {
	const catalog = catalogById(tools);
	const dailyRows = applyDailyGlobalRanking(AI_GLOBAL_TOP_10, date);
	return dailyRows.slice(0, limit).map((row) => {
		const listed = catalog.get(row.id);
		const base =
			listed ??
			stubTool({
				id: row.id,
				name: row.name,
				provider: row.provider,
				category: row.category,
				monthly_visits: row.monthly_visits,
				growth: row.growth,
				market_share: row.globalSharePct,
			});
		return {
			...base,
			name: row.name,
			provider: row.provider,
			monthly_visits: row.monthly_visits,
			growth: row.growth,
			market_share: row.globalSharePct,
			globalSharePct: row.globalSharePct,
		};
	});
}

/** Per-field #1 — prints the same `market_share` / `growth` as that tool's card. */
export function resolveOfficialCategoryChampions(tools: AiTool[], _date: Date = new Date()): ResolvedCategoryChampion[] {
	const catalog = catalogById(tools);
	return AI_CATEGORY_CHAMPIONS.map((entry) => {
		const tool = catalog.get(entry.toolId);
		if (!tool) {
			return {
				key: entry.key,
				categoryLabel: entry.label,
				tool: stubTool({
					id: entry.toolId,
					name: entry.toolId,
					provider: '',
					category: 'llm',
					monthly_visits: '',
					growth: '+0.0%',
					market_share: entry.categoryShare,
				}),
			};
		}
		return {
			key: entry.key,
			categoryLabel: entry.label,
			tool,
		};
	});
}
