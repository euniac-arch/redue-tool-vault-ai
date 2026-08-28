/**
 * Server-only RSS collector for GEO insights.
 * Fetch + cheerio XML mode so CORS never hits the browser.
 *
 * Official feeds: Google Search Central, Search Engine Land
 * Keyword feeds: Google News RSS per NEWS_KEYWORD_CATEGORIES (KR + GLOBAL)
 */
import * as cheerio from 'cheerio';
import type { CollectedNewsArticle } from './geo-news-dedupe';
import { formatRelativeKo, hostnameAsSource, stripHtml } from './geo-news-html';
import type { GeoNewsCategory, GeoNewsItem } from './geo-news-management';
import {
	buildGoogleNewsQuery,
	evaluateNewsTargeting,
	listNewsKeywordCategories,
	toGeoNewsCategory,
	type NewsKeywordCategoryId,
} from './newsKeywords';

export const RSS_FEEDS = [
	{
		id: 'google-search-blog',
		sourceName: 'Google Search Central',
		region: 'GLOBAL' as const,
		urls: [
			'https://developers.google.com/search/blog/rss.xml',
			'https://feeds.feedburner.com/blogspot/amDG',
		],
	},
	{
		id: 'search-engine-land',
		sourceName: 'Search Engine Land',
		region: 'GLOBAL' as const,
		urls: ['https://searchengineland.com/feed'],
	},
] as const;

const FETCH_TIMEOUT_MS = 12_000;
const PER_FEED_LIMIT = 12;
const PER_KEYWORD_FEED_LIMIT = 8;
const USER_AGENT = 'REDUE-Studio/1.0 (geo-insights; +https://redue.ai)';

export type RawRssItem = {
	title: string;
	link: string;
	/** RSS `<guid>` or Atom `<id>` — used as a stable identity when present. */
	guid?: string;
	snippet: string;
	pubDate: Date;
	categories: string[];
	sourceName?: string;
};

function firstHttpUrl(...candidates: Array<string | undefined>): string {
	for (const candidate of candidates) {
		const value = candidate?.trim();
		if (value && /^https?:\/\//i.test(value)) return value;
	}
	return '';
}

function inferCategory(title: string, snippet: string, categories: string[]): GeoNewsCategory {
	const targeting = evaluateNewsTargeting(title, `${snippet} ${categories.join(' ')}`);
	if (targeting.primaryCategoryId) {
		return toGeoNewsCategory(targeting.primaryCategoryId, targeting.matchedKeywords);
	}
	const haystack = [title, snippet, ...categories].join(' ').toLowerCase();
	if (/(schema|json-ld|structured data|sameas|markup|review snippet)/i.test(haystack)) return 'Schema Markup';
	if (/(chatgpt|searchgpt|perplexity|gemini|claude|openai|generative ai|gen-ai|ai overview|sge)/i.test(haystack)) {
		return /geo|citation|overview|sge|generative/.test(haystack) ? 'GEO' : 'AI Model';
	}
	if (/(geo|citation|llms\.txt|entity graph)/i.test(haystack)) return 'GEO';
	return 'Search Engine';
}

function inferTags(title: string, snippet: string, categories: string[]): string[] {
	const targeting = evaluateNewsTargeting(title, snippet);
	const haystack = `${title} ${snippet} ${categories.join(' ')}`;
	const catalog = [
		'ChatGPT Search',
		'SearchGPT',
		'Perplexity',
		'Google SGE',
		'AI Overviews',
		'JSON-LD',
		'Schema',
		'Search Console',
		'Core Update',
	];
	const fromCatalog = catalog.filter((tag) => haystack.toLowerCase().includes(tag.toLowerCase()));
	const fromRss = categories.map((item) => item.trim()).filter(Boolean).slice(0, 3);
	return [...new Set([...targeting.tags, ...fromCatalog, ...fromRss])].slice(0, 4);
}

export type FetchFeedXmlOptions = {
	/** HTTP 200 with no `<item>`/`<entry>` returns the XML instead of throwing. */
	allowEmpty?: boolean;
};

export async function fetchFeedXml(urls: readonly string[], options: FetchFeedXmlOptions = {}): Promise<string> {
	let lastError: Error | null = null;
	for (const url of urls) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
		try {
			const res = await fetch(url, {
				signal: controller.signal,
				headers: {
					Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
					'User-Agent': USER_AGENT,
				},
				cache: 'no-store',
			});
			if (!res.ok) {
				lastError = new Error(`${url} → HTTP ${res.status}`);
				continue;
			}
			const xml = await res.text();
			if (!xml.includes('<item') && !xml.includes('<entry')) {
				if (options.allowEmpty) {
					console.warn('[geo-news] RSS item이 없습니다.', url);
					return xml;
				}
				lastError = new Error(`${url} → RSS item이 없습니다.`);
				continue;
			}
			return xml;
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
		} finally {
			clearTimeout(timer);
		}
	}
	if (options.allowEmpty) {
		console.warn(
			'[geo-news] RSS item이 없습니다.',
			lastError instanceof Error ? lastError.message : lastError,
		);
		return '';
	}
	throw lastError ?? new Error('RSS 피드를 불러오지 못했습니다.');
}

function extractGoogleNewsOriginalUrl(link: string, snippetHtml: string): string {
	const hrefMatch = snippetHtml.match(/href=["'](https?:\/\/[^"']+)["']/i);
	const candidate = hrefMatch?.[1] ? stripHtml(hrefMatch[1]) : '';
	if (candidate && !/news\.google\.com/i.test(candidate)) return candidate;
	return firstHttpUrl(link);
}

export function parseRssOrAtom(xml: string): RawRssItem[] {
	const $ = cheerio.load(xml, { xml: true });
	const items: RawRssItem[] = [];

	$('item').each((_, el) => {
		const node = $(el);
		const title = stripHtml(node.find('title').first().text());
		const rawDescription = node.find('description').first().text() || node.find('content\\:encoded').first().text();
		const guid = stripHtml(node.find('guid').first().text()) || undefined;
		const link = extractGoogleNewsOriginalUrl(
			firstHttpUrl(node.find('link').first().text(), guid),
			rawDescription,
		);
		const snippet = stripHtml(rawDescription);
		const pubRaw = node.find('pubDate').first().text() || node.find('dc\\:date').first().text();
		const categories = node
			.find('category')
			.toArray()
			.map((cat) => stripHtml($(cat).text()))
			.filter(Boolean);
		const sourceName = stripHtml(node.find('source').first().text());
		if (!title || !link) return;
		items.push({
			title,
			link,
			guid,
			snippet,
			pubDate: pubRaw ? new Date(pubRaw) : new Date(0),
			categories,
			sourceName: sourceName || undefined,
		});
	});

	if (items.length > 0) return items;

	$('entry').each((_, el) => {
		const node = $(el);
		const title = stripHtml(node.find('title').first().text());
		const guid = stripHtml(node.find('id').first().text()) || undefined;
		const link = firstHttpUrl(
			node.find('link[rel="alternate"]').attr('href'),
			node.find('link').attr('href'),
			guid,
		);
		const snippet = stripHtml(node.find('summary').first().text() || node.find('content').first().text());
		const pubRaw = node.find('published').first().text() || node.find('updated').first().text();
		if (!title || !link) return;
		items.push({
			title,
			link,
			guid,
			snippet,
			pubDate: pubRaw ? new Date(pubRaw) : new Date(0),
			categories: [],
		});
	});

	return items;
}

function toGeoNewsItem(
	raw: RawRssItem,
	sourceName: string,
	region: GeoNewsItem['region'],
	bookmarked: Set<string>,
): GeoNewsItem {
	const summary = raw.snippet.slice(0, 240) || '원문에서 요약을 제공하지 않았습니다.';
	return {
		id: raw.link,
		region,
		category: inferCategory(raw.title, raw.snippet, raw.categories),
		title: raw.title,
		summary,
		sourceName: raw.sourceName || sourceName,
		sourceUrl: raw.link,
		publishedAt: formatRelativeKo(raw.pubDate) || raw.pubDate.toISOString(),
		tags: inferTags(raw.title, raw.snippet, raw.categories),
		isBookmarked: bookmarked.has(raw.link),
	};
}

function rawToCollected(
	raw: RawRssItem,
	sourceName: string,
	region: CollectedNewsArticle['region'],
	options: { trustedSource: boolean; categoryId?: NewsKeywordCategoryId },
): CollectedNewsArticle | null {
	const targeting = evaluateNewsTargeting(raw.title, raw.snippet);
	if (!options.trustedSource && !targeting.accepted) return null;

	const categoryId = targeting.primaryCategoryId ?? options.categoryId ?? null;
	const category = categoryId
		? toGeoNewsCategory(categoryId, targeting.matchedKeywords)
		: inferCategory(raw.title, raw.snippet, raw.categories);

	return {
		title: raw.title,
		url: raw.link,
		snippet: raw.snippet,
		pubDate: raw.pubDate,
		sourceName: raw.sourceName || sourceName || hostnameAsSource(raw.link),
		region,
		category,
		tags: inferTags(raw.title, raw.snippet, raw.categories),
		matchedKeywords: targeting.matchedKeywords,
		matchedCategoryId: categoryId,
		trustedSource: options.trustedSource,
	};
}

export async function collectOfficialSeoRss(): Promise<CollectedNewsArticle[]> {
	const settled = await Promise.allSettled(
		RSS_FEEDS.map(async (feed) => {
			const xml = await fetchFeedXml(feed.urls);
			return parseRssOrAtom(xml)
				.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
				.slice(0, PER_FEED_LIMIT)
				.map((item) => rawToCollected(item, feed.sourceName, feed.region, { trustedSource: true }))
				.filter((item): item is CollectedNewsArticle => Boolean(item));
		}),
	);

	const collected: CollectedNewsArticle[] = [];
	for (const result of settled) {
		if (result.status === 'fulfilled') collected.push(...result.value);
	}
	return collected;
}

function googleNewsRssUrl(query: string, locale: 'ko' | 'en'): string {
	const params = locale === 'ko' ? 'hl=ko&gl=KR&ceid=KR:ko' : 'hl=en-US&gl=US&ceid=US:en';
	return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${params}`;
}

export async function collectGoogleNewsRss(): Promise<CollectedNewsArticle[]> {
	const jobs = listNewsKeywordCategories().flatMap((category) => {
		const locales: Array<'ko' | 'en'> = ['ko', 'en'];
		return locales.map(async (locale) => {
			const query = buildGoogleNewsQuery(category.id, locale);
			const xml = await fetchFeedXml([googleNewsRssUrl(query, locale)], { allowEmpty: true });
			const parsed = parseRssOrAtom(xml);
			if (parsed.length === 0) {
				console.warn('[geo-news] RSS item이 없습니다.', query);
				return [];
			}
			return parsed
				.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
				.slice(0, PER_KEYWORD_FEED_LIMIT)
				.map((item) =>
					rawToCollected(item, item.sourceName || 'Google News', locale === 'ko' ? 'KR' : 'GLOBAL', {
						trustedSource: false,
						categoryId: category.id,
					}),
				)
				.filter((item): item is CollectedNewsArticle => Boolean(item));
		});
	});

	const settled = await Promise.allSettled(jobs);
	const collected: CollectedNewsArticle[] = [];
	for (const result of settled) {
		if (result.status === 'fulfilled') collected.push(...result.value);
		else {
			console.warn(
				'[geo-news] Google News RSS failed',
				result.reason instanceof Error ? result.reason.message : result.reason,
			);
		}
	}
	return collected;
}

export async function collectGeoNewsFromRss(bookmarked: Set<string> = new Set()): Promise<GeoNewsItem[]> {
	const settled = await Promise.allSettled(
		RSS_FEEDS.map(async (feed) => {
			const xml = await fetchFeedXml(feed.urls);
			return parseRssOrAtom(xml)
				.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
				.slice(0, PER_FEED_LIMIT)
				.map((item) => ({ item, feed }));
		}),
	);

	const collected: Array<{ item: RawRssItem; feed: (typeof RSS_FEEDS)[number] }> = [];
	const errors: string[] = [];
	for (const result of settled) {
		if (result.status === 'fulfilled') collected.push(...result.value);
		else errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
	}

	if (collected.length === 0) {
		throw new Error(`RSS 피드를 불러오지 못했습니다. ${errors.join(' / ')}`);
	}

	const seen = new Set<string>();
	return collected
		.sort((a, b) => b.item.pubDate.getTime() - a.item.pubDate.getTime())
		.filter(({ item }) => {
			if (seen.has(item.link)) return false;
			seen.add(item.link);
			return true;
		})
		.map(({ item, feed }) => toGeoNewsItem(item, feed.sourceName, feed.region, bookmarked));
}
