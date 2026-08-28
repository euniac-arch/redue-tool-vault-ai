/**
 * GEO news feed data-access layer (Node.js only).
 *
 * Browser clients must call GET /api/admin/geo-insights.
 * This module merges Google Search Central + Search Engine Land RSS,
 * Google News RSS (keyword pool), and Naver News Search, then
 * maps `item.link` → `sourceUrl`.
 */
import 'server-only';

import { collectGeoNewsFeed } from './geo-news-crawler';
import { filterGeoNews, type GeoNewsFilters, type GeoNewsItem } from './geo-news-management';

export type FetchGeoNewsFeedParams = {
	filters: GeoNewsFilters;
};

export type FetchGeoNewsFeedResult = {
	items: GeoNewsItem[];
	total: number;
	refreshedAt: string;
};

/** Server-only: parse live RSS, then filter. Do not call from the browser. */
export async function collectLiveGeoNewsFeed(params: FetchGeoNewsFeedParams): Promise<FetchGeoNewsFeedResult> {
	const collected = await collectGeoNewsFeed();
	const items = filterGeoNews(collected, params.filters);
	return {
		items,
		total: items.length,
		refreshedAt: new Date().toISOString(),
	};
}
