/**
 * Canonical server entry for the GEO / schema news feed.
 * Client UI must use GET /api/admin/geo-insights — do not import this module
 * from `'use client'` components.
 */
import 'server-only';

export {
	collectLiveGeoNewsFeed,
	type FetchGeoNewsFeedParams,
	type FetchGeoNewsFeedResult,
} from './geo-news-service';
