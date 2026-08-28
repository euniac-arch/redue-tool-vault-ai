import { createHash } from 'crypto';
import { canonicalizeNewsUrl, normalizeNewsTitle } from '@/lib/admin/geo-news-dedupe';
import { formatRelativeKo, hostnameAsSource } from '@/lib/admin/geo-news-html';
import { isNaverNewsConfigured, searchNaverNews } from '@/lib/admin/geo-news-naver';
import { fetchFeedXml, parseRssOrAtom, type RawRssItem } from '@/lib/admin/geo-news-rss';
import { classifyArticleCategory } from './insights-news-classify';
import {
	AI_KEYWORDS,
	listEnglishGoogleNewsQueries,
	listKoreanGoogleNewsQueries,
	naverQueryForKeyword,
	evaluateInsightsKeywords,
	evaluateInsightsSearchHit,
	hitsExcludeKeyword,
} from './insights-news-keywords';
import type { InsightArticleCategory, InsightsNewsItem, InsightsNewsRegion } from './insights-news-types';

const PER_FEED_LIMIT = 24;
const PER_KEYWORD_FEED_LIMIT = 12;
const NAVER_DISPLAY = 20;
const NAVER_THROTTLE_MS = 220;
const GOOGLE_CONCURRENCY = 6;
const GOOGLE_NEWS_WINDOW = 'when:30d';

export const INSIGHTS_RSS_FEEDS = [
	{
		id: 'search-engine-land',
		sourceName: 'Search Engine Land',
		urls: ['https://searchengineland.com/feed'],
		keepOfficial: false,
	},
	{
		id: 'search-engine-journal',
		sourceName: 'Search Engine Journal',
		urls: ['https://www.searchenginejournal.com/feed/', 'https://www.searchenginejournal.com/feed'],
		keepOfficial: false,
	},
	{
		id: 'google-search-blog',
		sourceName: 'Google Search Central',
		urls: [
			'https://developers.google.com/search/blog/rss.xml',
			'https://feeds.feedburner.com/blogspot/amDG',
		],
		keepOfficial: true,
	},
	{
		id: 'search-engine-roundtable',
		sourceName: 'Search Engine Roundtable',
		urls: ['https://www.seroundtable.com/feed', 'https://www.seroundtable.com/index.xml'],
		keepOfficial: false,
	},
] as const;

export type CollectedInsightsArticle = {
	id: string;
	guid: string | null;
	link: string;
	title: string;
	summary: string;
	sourceName: string;
	sourceUrl: string;
	region: InsightsNewsRegion;
	publishedAtIso: string;
	category: InsightArticleCategory;
	categories: InsightsNewsItem['categories'];
	tags: string[];
};

/** SHA-256 of canonical `link`, falling back to `guid` when the permalink is missing. */
export function insightsArticleDocId(link: string, guid?: string | null): string {
	const raw = (link || guid || '').trim();
	const canonical = canonicalizeNewsUrl(raw) || raw.toLowerCase();
	return createHash('sha256').update(canonical).digest('hex');
}

export function collectedToInsightsNewsItem(article: CollectedInsightsArticle): InsightsNewsItem {
	const published = article.publishedAtIso ? new Date(article.publishedAtIso) : new Date(0);
	return {
		id: article.id,
		title: article.title,
		summary: article.summary,
		sourceName: article.sourceName,
		sourceUrl: article.sourceUrl,
		guid: article.guid,
		region: article.region,
		publishedAt: formatRelativeKo(published) || article.publishedAtIso,
		publishedAtIso: article.publishedAtIso,
		category: article.category ?? classifyArticleCategory(article.title, article.summary),
		categories: [...article.categories],
		tags: [...article.tags],
	};
}

function cleanRssTitle(title: string): string {
	return title.replace(/\s+via @[\w.]+(?:,\s*@[\w.]+)*\s*$/i, '').trim();
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapPool<T, R>(items: readonly T[], concurrency: number, mapper: (item: T) => Promise<R[]>): Promise<R[]> {
	const out: R[] = [];
	let cursor = 0;

	async function worker() {
		while (cursor < items.length) {
			const index = cursor;
			cursor += 1;
			const item = items[index];
			if (item === undefined) return;
			if (index > 0) await sleep(40);
			out.push(...(await mapper(item)));
		}
	}

	const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
	await Promise.all(workers);
	return out;
}

export function inferInsightsRegion(
	url: string,
	fallback: InsightsNewsRegion,
	title = '',
): InsightsNewsRegion {
	if (/[가-힣]{2,}/.test(title)) return 'KR';
	try {
		const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
		if (
			/\.kr$/i.test(host) ||
			/(^|\.)(naver|daum|kakao|aitimes|bloter|zdnet\.co\.kr|digitaltoday|thelec|itworld\.co\.kr|it\.chosun|mk\.co\.kr|hani|joongang|chosun|donga|hankyung|yna|newsis|news1)\b/i.test(
				host,
			)
		) {
			return 'KR';
		}
	} catch {
		/* keep fallback */
	}
	return fallback;
}

function toCollectedArticle(
	input: {
		title: string;
		snippet: string;
		link: string;
		guid?: string | null;
		sourceName: string;
		pubDate: Date;
		extra?: string;
		searchKeyword?: string;
	},
	region: InsightsNewsRegion,
	keepOfficial: boolean,
): CollectedInsightsArticle | null {
	const targeting = input.searchKeyword
		? evaluateInsightsSearchHit(input.title, input.snippet, input.searchKeyword, input.extra ?? '')
		: evaluateInsightsKeywords(input.title, input.snippet, input.extra ?? '');
	if (!targeting.accepted && !keepOfficial) return null;
	if (keepOfficial && hitsExcludeKeyword(input.title, input.snippet, input.extra ?? '')) return null;

	const link = input.link.trim();
	if (!link) return null;

	const guid = input.guid?.trim() || null;
	const summary = input.snippet.slice(0, 280) || '원문에서 요약을 제공하지 않았습니다.';
	const publishedAtIso = Number.isNaN(input.pubDate.getTime()) ? new Date().toISOString() : input.pubDate.toISOString();
	const categories = targeting.accepted ? targeting.categories : (['SEO'] as CollectedInsightsArticle['categories']);
	const tags = targeting.accepted ? targeting.tags : ['SEO'];
	const title = cleanRssTitle(input.title);
	const category = classifyArticleCategory(
		title,
		`${summary} ${input.extra ?? ''} ${input.searchKeyword ?? ''}`,
	);

	return {
		id: insightsArticleDocId(link, guid),
		guid,
		link,
		title,
		summary,
		sourceName: input.sourceName || hostnameAsSource(link) || 'News',
		sourceUrl: link,
		region: inferInsightsRegion(link, region, input.title),
		publishedAtIso,
		category,
		categories,
		tags,
	};
}

function rawToCollected(
	raw: RawRssItem,
	sourceName: string,
	region: InsightsNewsRegion,
	keepOfficial: boolean,
): CollectedInsightsArticle | null {
	return toCollectedArticle(
		{
			title: raw.title,
			snippet: raw.snippet,
			link: raw.link,
			guid: raw.guid,
			sourceName: raw.sourceName || sourceName,
			pubDate: raw.pubDate,
			extra: raw.categories.join(' '),
		},
		region,
		keepOfficial,
	);
}

function dedupeArticles(collected: CollectedInsightsArticle[]): CollectedInsightsArticle[] {
	const byUrl = new Map<string, CollectedInsightsArticle>();
	for (const article of collected) {
		const existing = byUrl.get(article.id);
		if (!existing) {
			byUrl.set(article.id, article);
			continue;
		}
		const existingTs = Date.parse(existing.publishedAtIso) || 0;
		const incomingTs = Date.parse(article.publishedAtIso) || 0;
		if (incomingTs >= existingTs) byUrl.set(article.id, article);
	}

	const byTitle = new Map<string, CollectedInsightsArticle>();
	for (const article of byUrl.values()) {
		const titleKey = normalizeNewsTitle(article.title) || `url:${article.id}`;
		const existing = byTitle.get(titleKey);
		if (!existing) {
			byTitle.set(titleKey, article);
			continue;
		}
		if (article.region === 'KR' && existing.region !== 'KR') {
			byTitle.set(titleKey, article);
			continue;
		}
		if (existing.region === 'KR' && article.region !== 'KR') continue;
		const existingTs = Date.parse(existing.publishedAtIso) || 0;
		const incomingTs = Date.parse(article.publishedAtIso) || 0;
		if (incomingTs >= existingTs) byTitle.set(titleKey, article);
	}

	return [...byTitle.values()].sort(
		(a, b) => (Date.parse(b.publishedAtIso) || 0) - (Date.parse(a.publishedAtIso) || 0),
	);
}

async function collectOfficialRss(): Promise<CollectedInsightsArticle[]> {
	const settled = await Promise.allSettled(
		INSIGHTS_RSS_FEEDS.map(async (feed) => {
			const xml = await fetchFeedXml(feed.urls);
			return parseRssOrAtom(xml)
				.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
				.slice(0, PER_FEED_LIMIT)
				.map((item) => rawToCollected(item, feed.sourceName, 'GLOBAL', feed.keepOfficial))
				.filter((item): item is CollectedInsightsArticle => Boolean(item));
		}),
	);

	const collected: CollectedInsightsArticle[] = [];
	for (const result of settled) {
		if (result.status === 'fulfilled') collected.push(...result.value);
		else {
			console.warn(
				'[insights-news] official RSS failed',
				result.reason instanceof Error ? result.reason.message : result.reason,
			);
		}
	}
	return collected;
}

/** Drop phrase quotes so Google News RSS does not return 0 items on exact-match queries. */
export function relaxGoogleNewsQuery(query: string): string {
	return query.replace(/"/g, '').replace(/\s+/g, ' ').trim();
}

function googleNewsRssUrl(query: string, locale: 'ko' | 'en'): string {
	const params = locale === 'ko' ? 'hl=ko&gl=KR&ceid=KR:ko' : 'hl=en-US&gl=US&ceid=US:en';
	const relaxed = relaxGoogleNewsQuery(query);
	return `https://news.google.com/rss/search?q=${encodeURIComponent(`${relaxed} ${GOOGLE_NEWS_WINDOW}`)}&${params}`;
}

function mapNaverHits(
	keyword: string,
	items: Array<{ title: string; snippet: string; url: string; pubDate: Date }>,
): CollectedInsightsArticle[] {
	const mapped: CollectedInsightsArticle[] = [];
	for (const item of items) {
		const article = toCollectedArticle(
			{
				title: item.title,
				snippet: item.snippet,
				link: item.url,
				sourceName: hostnameAsSource(item.url) || '네이버 뉴스',
				pubDate: item.pubDate,
				searchKeyword: keyword,
			},
			'KR',
			false,
		);
		if (article) mapped.push(article);
	}
	return mapped;
}

async function collectGoogleNews(): Promise<CollectedInsightsArticle[]> {
	const krJobs = listKoreanGoogleNewsQueries().map((query) => ({ query, region: 'KR' as const, keyword: '' }));
	const enJobs = listEnglishGoogleNewsQueries().map((query) => ({ query, region: 'GLOBAL' as const, keyword: '' }));
	const jobs = [...krJobs, ...enJobs];

	return mapPool(jobs, GOOGLE_CONCURRENCY, async ({ query, region }) => {
		try {
			const xml = await fetchFeedXml([googleNewsRssUrl(query, region === 'KR' ? 'ko' : 'en')], {
				allowEmpty: true,
			});
			const parsed = parseRssOrAtom(xml);
			if (parsed.length === 0) {
				console.warn('[insights-news] RSS item이 없습니다.', relaxGoogleNewsQuery(query), GOOGLE_NEWS_WINDOW);
				return [];
			}
			return parsed
				.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
				.slice(0, region === 'KR' ? 20 : PER_KEYWORD_FEED_LIMIT)
				.map((item) =>
					toCollectedArticle(
						{
							title: item.title,
							snippet: item.snippet,
							link: item.link,
							guid: item.guid,
							sourceName: item.sourceName || 'Google News',
							pubDate: item.pubDate,
							extra: item.categories.join(' '),
							searchKeyword: region === 'KR' ? '국내 AI' : undefined,
						},
						region,
						false,
					),
				)
				.filter((item): item is CollectedInsightsArticle => Boolean(item));
		} catch (error) {
			console.warn(
				'[insights-news] Google News RSS failed',
				query,
				error instanceof Error ? error.message : error,
			);
			return [];
		}
	});
}

async function collectNaverNews(): Promise<CollectedInsightsArticle[]> {
	if (!isNaverNewsConfigured()) {
		console.warn(
			'[insights-news] NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 없음 — 네이버 국내 뉴스를 건너뜁니다.',
		);
		return [];
	}

	const collected: CollectedInsightsArticle[] = [];
	for (const [index, keyword] of AI_KEYWORDS.entries()) {
		if (index > 0) await sleep(NAVER_THROTTLE_MS);
		try {
			const items = await searchNaverNews(naverQueryForKeyword(keyword), NAVER_DISPLAY);
			collected.push(...mapNaverHits(keyword, items));
		} catch (error) {
			console.warn(
				'[insights-news] Naver News search failed',
				keyword,
				error instanceof Error ? error.message : error,
			);
		}
	}
	return collected;
}

/**
 * Merge official global RSS + per-keyword Google News (KR/EN) + per-keyword Naver News.
 * Each pool keyword is searched on its own (OR union), then URL + title duplicates are dropped.
 */
export async function collectInsightsNewsFromRss(): Promise<CollectedInsightsArticle[]> {
	const settled = await Promise.allSettled([collectOfficialRss(), collectGoogleNews(), collectNaverNews()]);
	const collected: CollectedInsightsArticle[] = [];
	const errors: string[] = [];
	for (const result of settled) {
		if (result.status === 'fulfilled') collected.push(...result.value);
		else errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
	}

	if (collected.length === 0) {
		throw new Error(
			errors.length > 0
				? `뉴스 피드를 불러오지 못했습니다. ${errors.join(' / ')}`
				: '키워드에 맞는 뉴스가 없습니다.',
		);
	}

	return dedupeArticles(collected);
}
