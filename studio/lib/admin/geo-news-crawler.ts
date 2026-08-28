/**
 * GEO / schema news crawler — merges official SEO RSS, Google News RSS,
 * and Naver News Search, then applies precise keyword targeting + dedupe.
 */
import { collectedToGeoNewsItem, dedupeCollectedNews, type CollectedNewsArticle } from './geo-news-dedupe';
import { collectOfficialSeoRss, collectGoogleNewsRss } from './geo-news-rss';
import { collectNaverNewsSearch } from './geo-news-naver';
import type { GeoNewsItem } from './geo-news-management';

function mergeSettled(results: PromiseSettledResult<CollectedNewsArticle[]>[]): CollectedNewsArticle[] {
	const merged: CollectedNewsArticle[] = [];
	const errors: string[] = [];
	for (const result of results) {
		if (result.status === 'fulfilled') merged.push(...result.value);
		else errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
	}
	if (merged.length === 0 && errors.length > 0) {
		throw new Error(`뉴스 피드를 불러오지 못했습니다. ${errors.join(' / ')}`);
	}
	return merged;
}

export async function collectGeoNewsFeed(bookmarked: Set<string> = new Set()): Promise<GeoNewsItem[]> {
	const settled = await Promise.allSettled([
		collectOfficialSeoRss(),
		collectGoogleNewsRss(),
		collectNaverNewsSearch(),
	]);
	const merged = mergeSettled(settled);
	return dedupeCollectedNews(merged).map((item) => collectedToGeoNewsItem(item, bookmarked));
}
