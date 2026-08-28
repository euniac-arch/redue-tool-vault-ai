/**
 * Insights news data-access layer.
 *
 * GET /api/insights and GET /api/news/fetch both call `getInsightsNewsFeed`.
 *
 * Flow:
 *   1. Read `insights_metadata/feed.lastFetchedAt`
 *   2. If age < 5h and `insights_news` is non-empty → return cache immediately
 *   3. Otherwise fetch KR (Naver + Google News) + global RSS, keyword-filter,
 *      bump `lastFetchedAt`, then return
 *
 * Manual refresh (`forceRefresh`) bypasses TTL. Concurrent refresh requests
 * share a single in-flight promise so RSS is not hammered.
 */

import {
	listCachedInsightsNews,
	readInsightsNewsMeta,
	upsertInsightsNewsCache,
} from '@/lib/firebase/insights-news';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import {
	collectInsightsNewsFromRss,
	collectedToInsightsNewsItem,
} from './insights-news-collect';
import {
	filterInsightsNews,
	isInsightsNewsCacheFresh,
	type InsightsNewsFeedResult,
	type InsightsNewsTab,
} from './insights-news-types';

export type GetInsightsNewsFeedParams = {
	tab?: InsightsNewsTab;
	forceRefresh?: boolean;
};

let inflightRefresh: Promise<InsightsNewsFeedResult> | null = null;

function applyTab(result: InsightsNewsFeedResult, tab: InsightsNewsTab): InsightsNewsFeedResult {
	const items = filterInsightsNews(result.items, tab);
	return { ...result, items, total: items.length };
}

async function liveCollectAndMaybePersist(): Promise<InsightsNewsFeedResult> {
	const collected = await collectInsightsNewsFromRss();
	const liveItems = collected.map(collectedToInsightsNewsItem);
	if (!isFirebaseAdminConfigured()) {
		return {
			items: liveItems,
			total: liveItems.length,
			lastFetchedAt: new Date().toISOString(),
			cached: false,
			source: 'live',
		};
	}

	try {
		const items = await upsertInsightsNewsCache(collected);
		const meta = await readInsightsNewsMeta();
		return {
			items,
			total: items.length,
			lastFetchedAt: meta?.lastFetchedAt ?? new Date().toISOString(),
			cached: false,
			source: 'live',
		};
	} catch (error) {
		console.warn(
			'[insights-news] Firestore upsert failed; serving live RSS',
			error instanceof Error ? error.message : error,
		);
		return {
			items: liveItems,
			total: liveItems.length,
			lastFetchedAt: new Date().toISOString(),
			cached: false,
			source: 'live',
		};
	}
}

async function readCacheIfAny(): Promise<{ items: InsightsNewsFeedResult['items']; metaLastFetchedAt: string | null; lastFetchedAtMs: number | null }> {
	if (!isFirebaseAdminConfigured()) {
		return { items: [], metaLastFetchedAt: null, lastFetchedAtMs: null };
	}
	try {
		const [meta, items] = await Promise.all([readInsightsNewsMeta(), listCachedInsightsNews()]);
		return {
			items,
			metaLastFetchedAt: meta?.lastFetchedAt ?? null,
			lastFetchedAtMs: meta?.lastFetchedAtMs ?? null,
		};
	} catch (error) {
		console.warn(
			'[insights-news] Firestore cache read failed',
			error instanceof Error ? error.message : error,
		);
		return { items: [], metaLastFetchedAt: null, lastFetchedAtMs: null };
	}
}

async function refreshWithStaleFallback(): Promise<InsightsNewsFeedResult> {
	const stale = await readCacheIfAny();
	try {
		return await liveCollectAndMaybePersist();
	} catch (error) {
		if (stale.items.length > 0) {
			console.warn(
				'[insights-news] live RSS failed; serving stale cache',
				error instanceof Error ? error.message : error,
			);
			return {
				items: stale.items,
				total: stale.items.length,
				lastFetchedAt: stale.metaLastFetchedAt,
				cached: true,
				source: 'stale',
			};
		}
		throw error;
	}
}

/**
 * Cache-first Insights feed. RSS is fetched only when the 5h TTL elapsed,
 * the store is empty, Firebase is missing, or `forceRefresh` is set.
 */
export async function getInsightsNewsFeed(params: GetInsightsNewsFeedParams = {}): Promise<InsightsNewsFeedResult> {
	const tab = params.tab ?? 'all';
	const forceRefresh = params.forceRefresh === true;

	if (!forceRefresh && isFirebaseAdminConfigured()) {
		const cached = await readCacheIfAny();
		const hasKr = cached.items.some((item) => item.region === 'KR' || /[가-힣]{2,}/.test(item.title));
		if (cached.items.length > 0 && isInsightsNewsCacheFresh(cached.lastFetchedAtMs) && hasKr) {
			return applyTab(
				{
					items: cached.items,
					total: cached.items.length,
					lastFetchedAt: cached.metaLastFetchedAt,
					cached: true,
					source: 'cache',
				},
				tab,
			);
		}
	}

	if (inflightRefresh) {
		return applyTab(await inflightRefresh, tab);
	}

	inflightRefresh = refreshWithStaleFallback().finally(() => {
		inflightRefresh = null;
	});

	return applyTab(await inflightRefresh, tab);
}
