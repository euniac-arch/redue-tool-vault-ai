/**
 * GEO news feed data-access layer.
 *
 * Browser calls GET /api/admin/geo-insights (avoids RSS CORS).
 * The API route runs `collectLiveGeoNewsFeed` on the Node server,
 * which merges Google Search Central + Search Engine Land RSS,
 * Google News RSS (keyword pool), and Naver News Search, then
 * maps `item.link` → `sourceUrl`.
 *
 *   fetchGeoNewsFeed        -> GET   /api/admin/geo-insights
 *   toggleGeoNewsBookmark   -> client-side overlay keyed by article URL
 */
import { collectGeoNewsFeed } from './geo-news-crawler';
import { filterGeoNews, type GeoNewsFilters, type GeoNewsItem } from './geo-news-management';

const bookmarkStore = new Set<string>();

export type FetchGeoNewsFeedParams = {
	filters: GeoNewsFilters;
};

export type FetchGeoNewsFeedResult = {
	items: GeoNewsItem[];
	total: number;
	refreshedAt: string;
};

function applyBookmarks(items: GeoNewsItem[]): GeoNewsItem[] {
	return items.map((item) => ({
		...item,
		tags: [...item.tags],
		isBookmarked: bookmarkStore.has(item.sourceUrl),
	}));
}

/** Server-only: parse live RSS, then filter. Do not call from the browser. */
export async function collectLiveGeoNewsFeed(params: FetchGeoNewsFeedParams): Promise<FetchGeoNewsFeedResult> {
	const collected = await collectGeoNewsFeed(bookmarkStore);
	const items = filterGeoNews(applyBookmarks(collected), params.filters);
	return {
		items,
		total: items.length,
		refreshedAt: new Date().toISOString(),
	};
}

/** GET /api/admin/geo-insights — filtered GEO / schema news feed. */
export async function fetchGeoNewsFeed(params: FetchGeoNewsFeedParams): Promise<FetchGeoNewsFeedResult> {
	if (typeof window === 'undefined') {
		return collectLiveGeoNewsFeed(params);
	}

	const query = new URLSearchParams({
		q: params.filters.query,
		region: params.filters.region,
		category: params.filters.category,
	});
	const res = await fetch(`/api/admin/geo-insights?${query.toString()}`, { cache: 'no-store' });
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { error?: string } | null;
		throw new Error(body?.error || '뉴스 피드를 불러오지 못했습니다.');
	}
	return res.json();
}

/** Bookmark is a session overlay — RSS itself is read-only. */
export async function toggleGeoNewsBookmark(id: string): Promise<GeoNewsItem> {
	if (bookmarkStore.has(id)) bookmarkStore.delete(id);
	else bookmarkStore.add(id);

	if (typeof window !== 'undefined') {
		return {
			id,
			region: 'GLOBAL',
			category: 'Search Engine',
			title: '',
			summary: '',
			sourceName: '',
			sourceUrl: id,
			publishedAt: '',
			tags: [],
			isBookmarked: bookmarkStore.has(id),
		};
	}

	const collected = await collectGeoNewsFeed(bookmarkStore);
	const found = collected.find((item) => item.id === id || item.sourceUrl === id);
	if (!found) throw new Error(`뉴스(${id})를 찾을 수 없습니다.`);
	return { ...found, tags: [...found.tags], isBookmarked: bookmarkStore.has(found.sourceUrl) };
}
