/**
 * Deterministic daily jitter for AI market-share / growth figures.
 * Seed is the local calendar day (`YYYY-MM-DD`), so a refresh on the same day
 * yields the same numbers; after local midnight the series rolls forward.
 */

export function getCalendarDateKey(date: Date = new Date()): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/** Integer seed `YYYYMMDD` from the local calendar (not UTC). */
export function getDailySeed(date: Date = new Date()): number {
	const [year, month, day] = getCalendarDateKey(date).split('-').map(Number);
	return year * 10000 + month * 100 + day;
}

export function formatRankingAsOfLabel(date: Date = new Date()): string {
	return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 기준`;
}

/** Fractional part of sin(seed)*10000 — stable in [0, 1). */
export function pseudoRandom(seed: number): number {
	const x = Math.sin(seed) * 10000;
	return x - Math.floor(x);
}

function hashId(id: string): number {
	let hash = 2166136261;
	for (let i = 0; i < id.length; i += 1) {
		hash ^= id.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function unit(seed: number, id: string, salt: number): number {
	return pseudoRandom(seed + (hashId(id) % 10007) * 17 + salt);
}

/** Share wobble in [-0.3, +0.3]. */
function shareDelta(seed: number, id: string): number {
	return (unit(seed, id, 1) - 0.5) * 0.6;
}

/** Growth wobble in [-0.5, +0.5]. */
function growthDelta(seed: number, id: string): number {
	return (unit(seed, id, 3) - 0.5);
}

export function parseGrowthPercent(growth: string): number {
	const n = Number.parseFloat((growth || '').replace(/[^+\-0-9.]/g, ''));
	return Number.isFinite(n) ? n : 0;
}

export function formatGrowthPercent(value: number): string {
	const rounded = Math.round(value * 10) / 10;
	return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(1)}%`;
}

function round1(value: number): number {
	return Math.round(value * 10) / 10;
}

/**
 * Scale shares so they sum to `target` (default 100). Equal scaling keeps
 * the incoming order. Rounding drift is absorbed by the largest item without
 * allowing a rank flip.
 */
export function normalizeShares(values: number[], target = 100): number[] {
	if (values.length === 0) return [];
	const sum = values.reduce((acc, n) => acc + n, 0);
	const scaled =
		sum <= 0
			? values.map(() => target / values.length)
			: values.map((n) => (n / sum) * target);
	const rounded = scaled.map(round1);
	const drift = round1(target - rounded.reduce((acc, n) => acc + n, 0));
	if (drift !== 0) {
		rounded[0] = round1(Math.max(0.1, rounded[0] + drift));
	}
	for (let i = 1; i < rounded.length; i += 1) {
		if (rounded[i] >= rounded[i - 1]) {
			rounded[i] = round1(Math.max(0.1, rounded[i - 1] - 0.1));
		}
	}
	return rounded;
}

type ShareItem<T> = { id: string; baseShare: number; item: T };

/**
 * Apply a day's wobble, keep descending rank (no surprise reversals), then
 * normalize so the group sums to ~100.
 */
export function jitterShareGroup<T>(items: ShareItem<T>[], seed: number): { item: T; share: number }[] {
	if (items.length === 0) return [];
	const ranked = [...items].sort((a, b) => b.baseShare - a.baseShare || a.id.localeCompare(b.id));
	const raw = ranked.map((entry) => Math.max(0.1, entry.baseShare + shareDelta(seed, entry.id)));
	for (let i = 1; i < raw.length; i += 1) {
		if (raw[i] >= raw[i - 1]) {
			raw[i] = Math.max(0.1, raw[i - 1] - 0.1);
		}
	}
	const shares = normalizeShares(raw, 100);
	return ranked.map((entry, index) => ({ item: entry.item, share: shares[index] }));
}

export function jitterGrowth(baseGrowth: string, id: string, seed: number): string {
	return formatGrowthPercent(parseGrowthPercent(baseGrowth) + growthDelta(seed, id));
}

type DailyShareTool = {
	id: string;
	category: string;
	market_share: number;
	growth: string;
};

/** Overlay daily category-share + growth onto a catalog list (cards / 점유율순). */
export function applyDailyMarketShares<T extends DailyShareTool>(tools: T[], date: Date = new Date()): T[] {
	const seed = getDailySeed(date);
	const groups = new Map<string, T[]>();
	for (const tool of tools) {
		const list = groups.get(tool.category) ?? [];
		list.push(tool);
		groups.set(tool.category, list);
	}

	const nextById = new Map<string, { share: number }>();
	for (const group of groups.values()) {
		const jittered = jitterShareGroup(
			group.map((tool) => ({ id: tool.id, baseShare: tool.market_share, item: tool })),
			seed,
		);
		for (const row of jittered) {
			nextById.set(row.item.id, { share: row.share });
		}
	}

	return tools.map((tool) => {
		const overlay = nextById.get(tool.id);
		return {
			...tool,
			market_share: overlay?.share ?? tool.market_share,
			growth: jitterGrowth(tool.growth, tool.id, seed),
		};
	});
}

export type DailyGlobalRankInput = {
	id: string;
	globalSharePct: number;
	growth: string;
};

/** Daily wobble for the official global TOP list. Order of the baseline is kept. */
export function applyDailyGlobalRanking<T extends DailyGlobalRankInput>(
	rows: readonly T[],
	date: Date = new Date(),
): T[] {
	const seed = getDailySeed(date);
	const raw = rows.map((row) => Math.max(0.1, row.globalSharePct + shareDelta(seed, row.id)));
	for (let i = 1; i < raw.length; i += 1) {
		if (raw[i] >= raw[i - 1]) {
			raw[i] = Math.max(0.1, raw[i - 1] - 0.1);
		}
	}
	const originalSum = rows.reduce((acc, row) => acc + row.globalSharePct, 0);
	const shares = normalizeShares(raw, originalSum);
	return rows.map((row, index) => ({
		...row,
		globalSharePct: shares[index],
		growth: jitterGrowth(row.growth, row.id, seed),
	}));
}

export type DailyChampionInput = {
	toolId: string;
	categoryShare: number;
};

export function applyDailyChampionShares<T extends DailyChampionInput>(
	rows: readonly T[],
	date: Date = new Date(),
): T[] {
	const seed = getDailySeed(date);
	return rows.map((row) => ({
		...row,
		categoryShare: round1(Math.max(0.5, row.categoryShare + shareDelta(seed, `champ:${row.toolId}`))),
	}));
}

/** Milliseconds until the next local midnight (+ slop so the new day is visible). */
export function msUntilNextLocalMidnight(from: Date = new Date()): number {
	const next = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1, 0, 0, 0, 50);
	return Math.max(50, next.getTime() - from.getTime());
}
