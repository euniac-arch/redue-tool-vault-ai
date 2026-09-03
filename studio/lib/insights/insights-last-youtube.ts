import {
	isUsableYoutubeVideoCache,
	normalizeYoutubeVideo,
	YOUTUBE_VIDEOS_CACHE_VERSION,
	type InsightsYoutubeSearchResult,
	type InsightsYoutubeVideo,
} from './insights-youtube';

export const LAST_YOUTUBE_SEARCH_KEY = 'redue_last_youtube_search';

export function readLastYoutubeSearch(): InsightsYoutubeSearchResult | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.localStorage.getItem(LAST_YOUTUBE_SEARCH_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object') return null;
		const row = parsed as Record<string, unknown>;
		const query = typeof row.query === 'string' ? row.query.trim() : '';
		const videos = Array.isArray(row.videos)
			? row.videos.map(normalizeYoutubeVideo).filter((item): item is InsightsYoutubeVideo => Boolean(item))
			: [];
		if (!query || !isUsableYoutubeVideoCache(row.version, videos.length)) return null;
		return {
			query,
			videos,
			warning: typeof row.warning === 'string' ? row.warning : undefined,
			source: row.source === 'playlist' || row.source === 'search' ? row.source : undefined,
		};
	} catch {
		return null;
	}
}

export function writeLastYoutubeSearch(result: InsightsYoutubeSearchResult): InsightsYoutubeSearchResult {
	if (typeof window !== 'undefined' && result.query) {
		try {
			window.localStorage.setItem(
				LAST_YOUTUBE_SEARCH_KEY,
				JSON.stringify({ ...result, version: YOUTUBE_VIDEOS_CACHE_VERSION }),
			);
		} catch {
			/* ignore */
		}
	}
	return result;
}
