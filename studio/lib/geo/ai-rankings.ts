/**
 * Daily Korea AI-search traffic share snapshot.
 *
 * Data is a 1-day KST rollup: the same calendar date always returns the same
 * rankings, timestamped at 00:00 KST. Live market-share ingestion should
 * replace `computeSharesForDate` while keeping this response shape.
 */

import { AI_ENGINE_CATALOG, type AIEngineId } from '@/types/geo-diagnostic';

export type AIShareTrend = 'up' | 'down' | 'stable';

export interface DailyAIRanking {
	rank: 1 | 2 | 3 | 4 | 5 | 6;
	id: AIEngineId;
	name: string;
	shareRate: number;
	trend: AIShareTrend;
}

/** Payload consumed by the ranking modal and `/api/geo/ai-rankings`. */
export interface AIShareRates {
	/** KST calendar day, `YYYY-MM-DD`. */
	date: string;
	/** Display date, `YYYY.MM.DD`. */
	asOfDisplay: string;
	/** Daily snapshot clock — always `YYYY-MM-DD 00:00:00` (KST). */
	lastUpdated: string;
	rankings: DailyAIRanking[];
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Baseline Korea AI-search / conversational traffic mix (sums to 100). */
const BASE_SHARES: readonly { id: AIEngineId; share: number }[] = [
	{ id: 'chatgpt', share: 52 },
	{ id: 'clova', share: 22 },
	{ id: 'perplexity', share: 11 },
	{ id: 'gemini', share: 8 },
	{ id: 'claude', share: 4 },
	{ id: 'copilot', share: 3 },
];

export const ENGINE_SHARE_BAR_CLASS: Record<AIEngineId, string> = {
	chatgpt: 'bg-[#10A37F]',
	clova: 'bg-[#03C75A]',
	perplexity: 'bg-[#20B8CD]',
	gemini: 'bg-gradient-to-r from-[#4B8BF5] via-[#9B72CB] to-[#D96570]',
	claude: 'bg-[#D97757]',
	copilot: 'bg-[#0078D4]',
};

function pad2(value: number): string {
	return String(value).padStart(2, '0');
}

export function toKstParts(date: Date): { y: number; m: number; d: number } {
	const kst = new Date(date.getTime() + KST_OFFSET_MS);
	return {
		y: kst.getUTCFullYear(),
		m: kst.getUTCMonth() + 1,
		d: kst.getUTCDate(),
	};
}

/** Format a Date as a KST calendar day. `sep='.'` → `YYYY.MM.DD`. */
export function formatKstYmd(date: Date, sep: '-' | '.' = '-'): string {
	const { y, m, d } = toKstParts(date);
	return `${y}${sep}${pad2(m)}${sep}${pad2(d)}`;
}

/**
 * Parse `YYYY-MM-DD` / `YYYY.MM.DD` (or a Date) into that KST calendar day.
 * Invalid / omitted input falls back to "now".
 */
export function parseRankingDate(input?: string | Date | null): Date {
	if (!input) return new Date();
	if (input instanceof Date) {
		return Number.isNaN(input.getTime()) ? new Date() : input;
	}
	const trimmed = input.trim();
	const match = trimmed.match(/^(\d{4})[-.](\d{2})[-.](\d{2})/);
	if (match) {
		const parsed = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00+09:00`);
		if (!Number.isNaN(parsed.getTime())) return parsed;
	}
	const fallback = new Date(trimmed);
	return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
}

function shiftYmd(ymd: string, deltaDays: number): string {
	const [y, m, d] = ymd.split('-').map(Number);
	const utc = new Date(Date.UTC(y, m - 1, d + deltaDays));
	return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`;
}

function ymdSeed(ymd: string): number {
	let hash = 2166136261;
	for (let i = 0; i < ymd.length; i += 1) {
		hash ^= ymd.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function round1(value: number): number {
	return Math.round(value * 10) / 10;
}

function normalizeShares(raw: number[]): number[] {
	const sum = raw.reduce((acc, value) => acc + value, 0);
	if (sum <= 0) return BASE_SHARES.map((row) => row.share);
	const scaled = raw.map((value) => (value / sum) * 100);
	const rounded = scaled.map(round1);
	const drift = round1(100 - rounded.reduce((acc, value) => acc + value, 0));
	rounded[0] = round1(rounded[0] + drift);
	return rounded;
}

function computeSharesForDate(ymd: string): { id: AIEngineId; shareRate: number }[] {
	const rng = mulberry32(ymdSeed(ymd));
	const jittered = BASE_SHARES.map((row) => row.share + (rng() - 0.5) * 1.2);
	const shares = normalizeShares(jittered);
	return BASE_SHARES.map((row, index) => ({
		id: row.id,
		shareRate: shares[index] ?? row.share,
	}));
}

function trendFromDelta(delta: number): AIShareTrend {
	if (delta > 0.15) return 'up';
	if (delta < -0.15) return 'down';
	return 'stable';
}

function isRankingRow(value: unknown): value is DailyAIRanking {
	if (!value || typeof value !== 'object') return false;
	const row = value as Record<string, unknown>;
	const rank = Number(row.rank);
	return (
		rank >= 1 &&
		rank <= 6 &&
		typeof row.id === 'string' &&
		row.id in AI_ENGINE_CATALOG &&
		typeof row.name === 'string' &&
		typeof row.shareRate === 'number' &&
		(row.trend === 'up' || row.trend === 'down' || row.trend === 'stable')
	);
}

export function isAIShareRates(value: unknown): value is AIShareRates {
	if (!value || typeof value !== 'object') return false;
	const obj = value as Record<string, unknown>;
	return (
		typeof obj.lastUpdated === 'string' &&
		typeof obj.date === 'string' &&
		typeof obj.asOfDisplay === 'string' &&
		Array.isArray(obj.rankings) &&
		obj.rankings.length > 0 &&
		obj.rankings.every(isRankingRow)
	);
}

/**
 * Return the once-per-day Korea AI share snapshot for `dateInput`.
 * Defaults to today's KST calendar date.
 */
export function getDailyAIRankings(dateInput?: string | Date | null): AIShareRates {
	const resolved = parseRankingDate(dateInput);
	const date = formatKstYmd(resolved, '-');
	const asOfDisplay = formatKstYmd(resolved, '.');
	const lastUpdated = `${date} 00:00:00`;

	const todayShares = computeSharesForDate(date);
	const yesterdayShares = computeSharesForDate(shiftYmd(date, -1));
	const yesterdayById = new Map(yesterdayShares.map((row) => [row.id, row.shareRate]));

	const ranked = [...(todayShares ?? [])].sort((a, b) => (b?.shareRate ?? 0) - (a?.shareRate ?? 0));

	const rankings: DailyAIRanking[] = ranked.map((row, index) => ({
		rank: (Math.min(6, Math.max(1, index + 1)) as DailyAIRanking['rank']),
		id: row.id,
		name: AI_ENGINE_CATALOG[row.id]?.name ?? row.id,
		shareRate: Number.isFinite(row.shareRate) ? row.shareRate : 0,
		trend: trendFromDelta(row.shareRate - (yesterdayById.get(row.id) ?? row.shareRate)),
	}));

	return { date, asOfDisplay, lastUpdated, rankings };
}
