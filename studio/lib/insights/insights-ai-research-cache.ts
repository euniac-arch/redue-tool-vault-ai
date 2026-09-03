import type { InsightsAiResearchResult } from '@/lib/insights/insights-ai-research';
import { AI_RECENT_SEARCHES_LIMIT, normalizeRecentSearchQuery } from '@/lib/insights/insights-ai-recent-searches';

export const AI_RESEARCH_CACHE_KEY = 'redue_ai_research_cache';
export const AI_RESEARCH_CACHE_TTL_MS = 2 * 60 * 60 * 1000;

export type InsightsAiResearchCacheEntry = {
	query: string;
	searchedAt: number;
	result: InsightsAiResearchResult;
};

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

export function isResearchCacheFresh(searchedAt: number, now = Date.now(), ttlMs = AI_RESEARCH_CACHE_TTL_MS): boolean {
	if (!Number.isFinite(searchedAt) || searchedAt <= 0) return false;
	return now - searchedAt < ttlMs;
}

export function formatResearchAnalyzedAt(searchedAt: number, now = Date.now()): string {
	const date = new Date(searchedAt);
	const ymd = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Seoul',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(date);
	const hm = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Asia/Seoul',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	}).format(date);
	return `${ymd.replace(/-/g, '.')} ${hm}`;
}

export function formatResearchAnalyzedAgo(searchedAt: number, now = Date.now()): string {
	const diff = Math.max(0, now - searchedAt);
	if (diff < 60_000) return '방금 전';
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
	return `${Math.floor(diff / 86_400_000)}일 전`;
}

export function formatResearchAnalyzedLabel(searchedAt: number, now = Date.now()): string {
	return `🕒 분석 기준: ${formatResearchAnalyzedAt(searchedAt, now)} (${formatResearchAnalyzedAgo(searchedAt, now)})`;
}

function isCacheEntry(value: unknown): value is InsightsAiResearchCacheEntry {
	if (!value || typeof value !== 'object') return false;
	const row = value as Record<string, unknown>;
	const result = row.result;
	return (
		typeof row.query === 'string' &&
		typeof row.searchedAt === 'number' &&
		Boolean(result) &&
		typeof result === 'object' &&
		typeof (result as InsightsAiResearchResult).summary === 'string'
	);
}

function readCacheMap(): Record<string, InsightsAiResearchCacheEntry> {
	if (!isBrowser()) return {};
	try {
		const raw = window.localStorage.getItem(AI_RESEARCH_CACHE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
		const next: Record<string, InsightsAiResearchCacheEntry> = {};
		for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
			if (!isCacheEntry(value)) continue;
			next[key] = value;
		}
		return next;
	} catch {
		return {};
	}
}

function writeCacheMap(map: Record<string, InsightsAiResearchCacheEntry>) {
	if (!isBrowser()) return;
	try {
		window.localStorage.setItem(AI_RESEARCH_CACHE_KEY, JSON.stringify(map));
	} catch {
		/* private mode / quota */
	}
}

function pruneCache(map: Record<string, InsightsAiResearchCacheEntry>): Record<string, InsightsAiResearchCacheEntry> {
	const rows = Object.entries(map).sort((a, b) => b[1].searchedAt - a[1].searchedAt);
	return Object.fromEntries(rows.slice(0, AI_RECENT_SEARCHES_LIMIT));
}

export function readCachedResearch(query: string): InsightsAiResearchCacheEntry | null {
	const key = normalizeRecentSearchQuery(query);
	if (!key) return null;
	return readCacheMap()[key] ?? null;
}

export function getFreshCachedResearch(query: string, now = Date.now()): InsightsAiResearchCacheEntry | null {
	const cached = readCachedResearch(query);
	if (!cached || !isResearchCacheFresh(cached.searchedAt, now)) return null;
	return cached;
}

export function writeCachedResearch(query: string, result: InsightsAiResearchResult, searchedAt = Date.now()): InsightsAiResearchCacheEntry {
	const key = normalizeRecentSearchQuery(query);
	const stamped: InsightsAiResearchResult = { ...result, query: result.query || key, searchedAt };
	const entry: InsightsAiResearchCacheEntry = { query: key, searchedAt, result: stamped };
	if (!key) return entry;
	const next = pruneCache({ ...readCacheMap(), [key]: entry });
	writeCacheMap(next);
	return entry;
}

export function removeCachedResearch(query: string) {
	const key = normalizeRecentSearchQuery(query);
	if (!key) return;
	const map = readCacheMap();
	if (!(key in map)) return;
	delete map[key];
	writeCacheMap(map);
}

export function clearCachedResearch() {
	if (!isBrowser()) return;
	try {
		window.localStorage.removeItem(AI_RESEARCH_CACHE_KEY);
	} catch {
		/* ignore */
	}
}
