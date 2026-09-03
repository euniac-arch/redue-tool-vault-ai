import {
	isUsableYoutubeVideoCache,
	normalizeYoutubeSearchResult,
	YOUTUBE_SEARCH_CACHE_TTL_MS,
	YOUTUBE_VIDEOS_CACHE_VERSION,
	type InsightsYoutubeSearchResult,
} from './insights-youtube';

export const YOUTUBE_VIDEOS_CACHE_KEY = 'redue_youtube_videos_cache';

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

export function readYoutubeVideosCache(query?: string, now = Date.now()): InsightsYoutubeSearchResult | null {
	if (!isBrowser()) return null;
	try {
		const raw = window.localStorage.getItem(YOUTUBE_VIDEOS_CACHE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object') return null;
		const row = parsed as Record<string, unknown>;
		const fetchedAt = Number(row.fetchedAt);
		if (!Number.isFinite(fetchedAt) || now - fetchedAt > YOUTUBE_SEARCH_CACHE_TTL_MS) return null;
		const result = normalizeYoutubeSearchResult(row, typeof row.query === 'string' ? row.query : '');
		if (!result.query || !isUsableYoutubeVideoCache(row.version, result.videos.length)) return null;
		if (query && result.query.trim().toLowerCase() !== query.trim().toLowerCase()) return null;
		return { ...result, cached: true };
	} catch {
		return null;
	}
}

export function writeYoutubeVideosCache(result: InsightsYoutubeSearchResult, fetchedAt = Date.now()): InsightsYoutubeSearchResult {
	if (isBrowser() && result.query && result.videos.length > 0) {
		try {
			window.localStorage.setItem(
				YOUTUBE_VIDEOS_CACHE_KEY,
				JSON.stringify({
					...result,
					version: YOUTUBE_VIDEOS_CACHE_VERSION,
					fetchedAt,
				}),
			);
		} catch {
			/* private mode / quota */
		}
	}
	return result;
}
