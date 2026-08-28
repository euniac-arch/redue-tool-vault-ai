import type { GeoNewsCategory, GeoNewsItem, GeoNewsRegion } from './geo-news-management';
import { formatRelativeKo, hostnameAsSource } from './geo-news-html';
import type { NewsKeywordCategoryId } from './newsKeywords';

const TRACKING_PARAMS = new Set([
	'utm_source',
	'utm_medium',
	'utm_campaign',
	'utm_term',
	'utm_content',
	'utm_id',
	'fbclid',
	'gclid',
	'gbraid',
	'wbraid',
	'mc_cid',
	'mc_eid',
	'sid',
	'n_cid',
	'ref',
	'oc',
	'rc',
]);

export type CollectedNewsArticle = {
	title: string;
	url: string;
	snippet: string;
	pubDate: Date;
	sourceName: string;
	region: GeoNewsRegion;
	category: GeoNewsCategory;
	tags: string[];
	matchedKeywords: string[];
	matchedCategoryId: NewsKeywordCategoryId | null;
	/** Official SEO blogs skip the strict keyword gate. */
	trustedSource: boolean;
};

function isWeakHost(hostname: string): boolean {
	return /(^|\.)news\.google\.com$/i.test(hostname) || /(^|\.)(n\.)?news\.naver\.com$/i.test(hostname);
}

export function canonicalizeNewsUrl(rawUrl: string): string {
	try {
		const parsed = new URL(rawUrl.trim());
		const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
		for (const key of [...parsed.searchParams.keys()]) {
			if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
				parsed.searchParams.delete(key);
			}
		}
		const query = parsed.searchParams.toString();
		const path = parsed.pathname.replace(/\/+$/, '');
		return `${host}${path}${query ? `?${query}` : ''}`;
	} catch {
		return rawUrl.trim().toLowerCase();
	}
}

export function normalizeNewsTitle(title: string): string {
	return title
		.replace(/\s+[-–|]\s+[^-–|]{2,40}$/u, '')
		.toLowerCase()
		.replace(/<[^>]+>/g, ' ')
		.replace(/[^\p{L}\p{N}\s]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function sourcePriority(url: string): number {
	try {
		const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
		if (isWeakHost(host)) return 0;
		return 2;
	} catch {
		return 1;
	}
}

function preferArticle(current: CollectedNewsArticle, incoming: CollectedNewsArticle): CollectedNewsArticle {
	const currentScore = sourcePriority(current.url);
	const incomingScore = sourcePriority(incoming.url);
	if (incomingScore !== currentScore) return incomingScore > currentScore ? incoming : current;
	return incoming.pubDate.getTime() > current.pubDate.getTime() ? incoming : current;
}

/**
 * Drop identical URLs and syndicated copies of the same headline.
 * Prefers publisher permalinks over Google News / Naver News wrappers.
 */
export function dedupeCollectedNews(items: CollectedNewsArticle[]): CollectedNewsArticle[] {
	const byUrl = new Map<string, CollectedNewsArticle>();
	for (const item of items) {
		const key = canonicalizeNewsUrl(item.url);
		if (!key) continue;
		const existing = byUrl.get(key);
		byUrl.set(key, existing ? preferArticle(existing, item) : item);
	}

	const byTitle = new Map<string, CollectedNewsArticle>();
	for (const item of byUrl.values()) {
		const titleKey = normalizeNewsTitle(item.title);
		if (!titleKey) {
			byTitle.set(`url:${canonicalizeNewsUrl(item.url)}`, item);
			continue;
		}
		const existing = byTitle.get(titleKey);
		byTitle.set(titleKey, existing ? preferArticle(existing, item) : item);
	}

	return [...byTitle.values()].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}

export function collectedToGeoNewsItem(item: CollectedNewsArticle, bookmarked: Set<string>): GeoNewsItem {
	return {
		id: item.url,
		region: item.region,
		category: item.category,
		title: item.title,
		summary: item.snippet.slice(0, 240) || '원문에서 요약을 제공하지 않았습니다.',
		sourceName: item.sourceName || hostnameAsSource(item.url) || 'News',
		sourceUrl: item.url,
		publishedAt: formatRelativeKo(item.pubDate) || item.pubDate.toISOString(),
		tags: [...item.tags],
		isBookmarked: bookmarked.has(item.url),
	};
}
