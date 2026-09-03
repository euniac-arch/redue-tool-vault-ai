/**
 * Admin "글로벌 AI 도구 디렉토리 & 큐레이션" — types, dataset loader, and pure helpers.
 *
 * Source data lives in `studio/data/aiToolsData.json` as an array of
 * categories, each holding its own `tools` list (name / provider / url /
 * logo_url / desc / tags). The `is_public` flag controls whether a tool is
 * exposed on the public-facing site and is persisted locally via
 * `localStorage` until a real backend endpoint is wired up.
 */

import aiToolsRaw from '@/data/aiToolsData.json';

export type AiToolCategoryId = 'llm' | 'image' | 'video' | 'audio' | 'code' | 'hub';

export type AiToolPricing = {
	/** Free-form label, e.g. "Freemium" / "Paid" / "Open Source / API" */
	type: string;
	/** One-line summary shown as a compact badge/caption, e.g. "무료 / Plus $20/월" */
	summary: string;
	free_tier: string;
	paid_tier: string;
};

export type AiToolGuide = {
	/** Exactly 3 step-by-step usage instructions. */
	steps: string[];
	pro_tip: string;
};

/** A single tool entry as it appears in `aiToolsData.json`. */
export type AiToolRaw = {
	id: string;
	name: string;
	provider: string;
	url: string;
	logo_url: string;
	desc: string;
	tags: string[];
	is_public: boolean;
	/** Global market share, in percent (e.g. 58.4 for 58.4%). */
	market_share: number;
	/** Estimated monthly visits, pre-formatted (e.g. "3.1B", "180M"). */
	monthly_visits: string;
	/** Curated recommendation score, 1~100. */
	recommend_score: number;
	/** User rating, typically 0~5. */
	rating: number;
	/** Month-over-month growth, pre-formatted with sign (e.g. "+8.4%", "-1.5%"). */
	growth: string;
	pricing: AiToolPricing;
	guide: AiToolGuide;
};

/** A category entry as it appears in `aiToolsData.json`, before flattening. */
export type AiToolCategoryRaw = {
	category_id: AiToolCategoryId;
	category_name: string;
	/** lucide-react icon component name, e.g. "MessageSquare" */
	icon: string;
	tools: AiToolRaw[];
};

export type AiToolCategory = {
	id: AiToolCategoryId;
	label: string;
	icon: string;
};

/** Flattened tool with its parent category id attached, used throughout the UI. */
export type AiTool = AiToolRaw & { category: AiToolCategoryId };

export type AiToolFilters = {
	query: string;
	category: 'all' | AiToolCategoryId;
};

/** Sort keys for the curation grid. `market_share` is the default view. */
export type AiToolSortKey = 'market_share' | 'recommend_score' | 'rating' | 'name';

export const AI_TOOL_SORT_OPTIONS: { key: AiToolSortKey; label: string }[] = [
	{ key: 'market_share', label: '글로벌 점유율순' },
	{ key: 'recommend_score', label: '추천순' },
	{ key: 'rating', label: '평점순' },
	{ key: 'name', label: '이름순' },
];

const DATASET = aiToolsRaw as AiToolCategoryRaw[];

export const AI_TOOL_CATEGORIES: AiToolCategory[] = DATASET.map((entry) => ({
	id: entry.category_id,
	label: entry.category_name,
	icon: entry.icon,
}));

const VISIBILITY_STORAGE_KEY = 'admin.aiTools.visibilityOverrides.v2';

function readVisibilityOverrides(): Record<string, boolean> {
	if (typeof window === 'undefined') return {};
	try {
		const raw = window.localStorage.getItem(VISIBILITY_STORAGE_KEY);
		if (!raw) return {};
		return JSON.parse(raw) as Record<string, boolean>;
	} catch {
		return {};
	}
}

function writeVisibilityOverrides(overrides: Record<string, boolean>) {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(overrides));
	} catch {
		/* private mode / blocked storage */
	}
}

/**
 * Flattens a categorized dataset (either the bundled `aiToolsData.json` or a fresh payload
 * returned by the "AI 데이터 최신화" refresh endpoint) and applies any locally persisted
 * `is_public` overrides.
 */
export function flattenAiToolCategories(categories: AiToolCategoryRaw[]): AiTool[] {
	const overrides = readVisibilityOverrides();
	return categories.flatMap((entry) =>
		entry.tools.map((tool) => ({
			...tool,
			tags: [...tool.tags],
			category: entry.category_id,
			is_public: overrides[tool.id] ?? tool.is_public,
		})),
	);
}

/** Flattens the bundled dataset and applies any locally persisted `is_public` overrides. */
export function loadAiTools(): AiTool[] {
	return flattenAiToolCategories(DATASET);
}

/** Persists a single tool's visibility override so it survives a page reload. */
export function persistToolVisibility(id: string, isPublic: boolean) {
	const overrides = readVisibilityOverrides();
	overrides[id] = isPublic;
	writeVisibilityOverrides(overrides);
}

export function filterAiTools(tools: AiTool[], filters: AiToolFilters): AiTool[] {
	const q = filters.query.trim().toLowerCase();
	return tools.filter((tool) => {
		if (filters.category !== 'all' && tool.category !== filters.category) return false;
		if (!q) return true;
		return (
			tool.name.toLowerCase().includes(q) ||
			tool.provider.toLowerCase().includes(q) ||
			tool.desc.toLowerCase().includes(q) ||
			tool.tags.some((tag) => tag.toLowerCase().includes(q))
		);
	});
}

export function countAiToolsByCategory(tools: AiTool[]): Record<AiToolCategoryId, number> {
	const counts = {} as Record<AiToolCategoryId, number>;
	for (const category of AI_TOOL_CATEGORIES) counts[category.id] = 0;
	for (const tool of tools) counts[tool.category] = (counts[tool.category] ?? 0) + 1;
	return counts;
}

export function getAiToolCategoryLabel(id: AiToolCategoryId): string {
	return AI_TOOL_CATEGORIES.find((category) => category.id === id)?.label ?? id;
}

/** Returns a new array sorted by the given key (numeric keys descending, `name` ascending in Korean order). */
export function sortAiTools(tools: AiTool[], sortKey: AiToolSortKey): AiTool[] {
	const sorted = [...tools];
	if (sortKey === 'name') {
		sorted.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
		return sorted;
	}
	sorted.sort((a, b) => b[sortKey] - a[sortKey]);
	return sorted;
}

/**
 * Top N tools ranked by `market_share`. Only valid when `tools` is already scoped to a single
 * category — `market_share` is a *per-category* percentage (each category's shares sum to ~100 on
 * their own; see the "market_share" field description in `ai-tools-refresh.ts`'s refresh prompt),
 * so this must never be used to rank the whole cross-category dataset. `getAiToolCategoryChampions`
 * below is the only intended caller. For a real cross-category "global" ranking, use
 * `getTopAiToolsByGlobalTraffic` instead.
 */
export function getTopAiToolsByMarketShare(tools: AiTool[], limit = 10): AiTool[] {
	return sortAiTools(tools, 'market_share').slice(0, limit);
}

/**
 * Parses a compact traffic string (e.g. `"3.1B"`, `"180M"`, `"950K"`) into a raw visit count.
 * Returns 0 when the value can't be parsed.
 */
export function parseMonthlyVisits(value: string): number {
	const match = /^([\d.]+)\s*([kmb])?\+?$/i.exec((value ?? '').trim());
	if (!match) return 0;
	const num = Number(match[1]);
	if (!Number.isFinite(num)) return 0;
	const unit = (match[2] ?? '').toLowerCase();
	const multiplier = unit === 'b' ? 1_000_000_000 : unit === 'm' ? 1_000_000 : unit === 'k' ? 1_000 : 1;
	return num * multiplier;
}

/**
 * Top N tools ranked by **actual global traffic** (`monthly_visits`, parsed to a raw number) — the
 * only field in the dataset that's directly comparable across every category. `market_share` is a
 * per-category percentage, so sorting the entire cross-category dataset by it (as the "오늘자 순위
 * 분석" global TOP 10 previously did via `getTopAiToolsByMarketShare`) mixes numbers from unrelated
 * scales and yields a meaningless order — a tool with a large share of a small/uncrowded category
 * could outrank a far bigger tool from a more competitive category. Each returned entry carries a
 * `globalSharePct` (its share of the total traffic across every tool passed in) to render instead
 * of the misleading `market_share` value.
 */
export function getTopAiToolsByGlobalTraffic(tools: AiTool[], limit = 10): (AiTool & { globalSharePct: number })[] {
	const withVisits = tools.map((tool) => ({ tool, visits: parseMonthlyVisits(tool.monthly_visits) }));
	const totalVisits = withVisits.reduce((sum, entry) => sum + entry.visits, 0);
	return withVisits
		.sort((a, b) => b.visits - a.visits)
		.slice(0, limit)
		.map(({ tool, visits }) => ({
			...tool,
			globalSharePct: totalVisits > 0 ? (visits / totalVisits) * 100 : 0,
		}));
}

/** The #1 tool by market share within each category present in `tools`, in dataset category order. */
export function getAiToolCategoryChampions(tools: AiTool[]): { category: AiToolCategoryId; tool: AiTool }[] {
	return AI_TOOL_CATEGORIES.map((category) => {
		const inCategory = tools.filter((tool) => tool.category === category.id);
		if (inCategory.length === 0) return null;
		const [top] = sortAiTools(inCategory, 'market_share');
		return { category: category.id, tool: top };
	}).filter((entry): entry is { category: AiToolCategoryId; tool: AiTool } => entry !== null);
}
