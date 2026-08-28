/**
 * Naver News Search API collector.
 * Uses the same NAVER_CLIENT_ID / NAVER_CLIENT_SECRET as webkr discovery.
 * https://developers.naver.com/docs/serviceapi/search/news/news.md
 */
import 'server-only';

import { readNaverSearchCache, writeNaverSearchCache } from '@/lib/insights/insights-naver-cache';
import type { CollectedNewsArticle } from './geo-news-dedupe';
import { hostnameAsSource, stripHtml } from './geo-news-html';
import {
	buildNaverNewsQuery,
	evaluateNewsTargeting,
	listNewsKeywordCategories,
	toGeoNewsCategory,
	type NewsKeywordCategoryId,
} from './newsKeywords';

const NAVER_NEWS_ENDPOINT = 'https://openapi.naver.com/v1/search/news.json';
const DISPLAY_PER_CATEGORY = 20;
const FETCH_TIMEOUT_MS = 8_000;
const INTER_CALL_DELAY_MS = 220;
const RATE_LIMIT_MAX_RETRIES = 3;
const RATE_LIMIT_BASE_DELAY_MS = 400;
const USER_AGENT = 'REDUE-Studio/1.0 (geo-insights; +https://redue.ai)';

type NaverNewsItem = {
	title?: string;
	originallink?: string;
	link?: string;
	description?: string;
	pubDate?: string;
};

function readNaverCredentials(): { clientId: string; clientSecret: string } | null {
	const clientId = (
		process.env.NAVER_CLIENT_ID ||
		process.env.NEXT_PUBLIC_NAVER_CLIENT_ID ||
		''
	).trim();
	const clientSecret = (
		process.env.NAVER_CLIENT_SECRET ||
		process.env.NEXT_PUBLIC_NAVER_CLIENT_SECRET ||
		''
	).trim();
	if (!clientId || !clientSecret) return null;
	return { clientId, clientSecret };
}

export function isNaverNewsConfigured(): boolean {
	return Boolean(readNaverCredentials());
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickArticleUrl(item: NaverNewsItem): string {
	const original = item.originallink?.trim() || '';
	if (/^https?:\/\//i.test(original)) return original;
	const link = item.link?.trim() || '';
	return /^https?:\/\//i.test(link) ? link : '';
}

function isRateLimitedStatus(status: number): boolean {
	return status === 429;
}

function backoffDelayMs(attempt: number, retryAfterHeader: string | null): number {
	const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : NaN;
	if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
		return Math.min(retryAfterSec * 1000, 8_000);
	}
	const jitter = Math.floor(Math.random() * 120);
	return RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt + jitter;
}

async function fetchNaverNewsPageOnce(
	query: string,
	clientId: string,
	clientSecret: string,
	display: number,
): Promise<{ items: NaverNewsItem[]; status: number; retryAfter: string | null }> {
	const url = new URL(NAVER_NEWS_ENDPOINT);
	url.searchParams.set('query', query);
	url.searchParams.set('display', String(Math.min(100, Math.max(1, display))));
	url.searchParams.set('start', '1');
	url.searchParams.set('sort', 'date');

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			headers: {
				'X-Naver-Client-Id': clientId,
				'X-Naver-Client-Secret': clientSecret,
				Accept: 'application/json',
				'User-Agent': USER_AGENT,
			},
			cache: 'no-store',
		});
		if (isRateLimitedStatus(res.status)) {
			return { items: [], status: res.status, retryAfter: res.headers.get('Retry-After') };
		}
		if (!res.ok) {
			throw new Error(`네이버 뉴스 API HTTP ${res.status}`);
		}
		const body = (await res.json()) as { items?: NaverNewsItem[] };
		return {
			items: Array.isArray(body.items) ? body.items : [],
			status: res.status,
			retryAfter: null,
		};
	} finally {
		clearTimeout(timer);
	}
}

type NaverPageResult = {
	items: NaverNewsItem[];
	rateLimited: boolean;
};

/**
 * Naver News page fetch with exponential backoff on HTTP 429.
 * Exhausted retries return `{ items: [], rateLimited: true }` — callers must not crash.
 */
async function fetchNaverNewsPage(
	query: string,
	clientId: string,
	clientSecret: string,
	display = DISPLAY_PER_CATEGORY,
): Promise<NaverPageResult> {
	for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt += 1) {
		try {
			const result = await fetchNaverNewsPageOnce(query, clientId, clientSecret, display);
			if (!isRateLimitedStatus(result.status)) {
				return { items: result.items, rateLimited: false };
			}

			if (attempt === RATE_LIMIT_MAX_RETRIES) {
				console.warn('[geo-news] Naver News 429 after retries — returning []', query);
				return { items: [], rateLimited: true };
			}

			const delay = backoffDelayMs(attempt, result.retryAfter);
			console.warn('[geo-news] Naver News 429 — backing off', { query, attempt, delay });
			await sleep(delay);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (attempt === RATE_LIMIT_MAX_RETRIES || !/HTTP 429/.test(message)) {
				if (/HTTP 429/.test(message)) {
					console.warn('[geo-news] Naver News 429 after retries — returning []', query);
					return { items: [], rateLimited: true };
				}
				throw error;
			}
			await sleep(backoffDelayMs(attempt, null));
		}
	}
	return { items: [], rateLimited: true };
}

function toCollected(raw: NaverNewsItem, categoryId: NewsKeywordCategoryId): CollectedNewsArticle | null {
	const title = stripHtml(raw.title || '');
	const snippet = stripHtml(raw.description || '');
	const url = pickArticleUrl(raw);
	if (!title || !url) return null;

	const targeting = evaluateNewsTargeting(title, snippet);
	if (!targeting.accepted) return null;

	const resolvedCategoryId = targeting.primaryCategoryId ?? categoryId;
	return {
		title,
		url,
		snippet,
		pubDate: raw.pubDate ? new Date(raw.pubDate) : new Date(0),
		sourceName: hostnameAsSource(url) || '네이버 뉴스',
		region: 'KR',
		category: toGeoNewsCategory(resolvedCategoryId, targeting.matchedKeywords),
		tags: targeting.tags,
		matchedKeywords: targeting.matchedKeywords,
		matchedCategoryId: resolvedCategoryId,
		trustedSource: false,
	};
}

/** Raw Naver News Search for callers that apply their own keyword gate (Insights cache). */
export async function searchNaverNews(
	query: string,
	display = DISPLAY_PER_CATEGORY,
): Promise<Array<{ title: string; snippet: string; url: string; pubDate: Date }>> {
	const credentials = readNaverCredentials();
	if (!credentials || !query.trim()) return [];

	const cached = await readNaverSearchCache(query);
	if (cached) return cached;

	try {
		const { items, rateLimited } = await fetchNaverNewsPage(
			query,
			credentials.clientId,
			credentials.clientSecret,
			display,
		);
		const mapped = items
			.map((item) => {
				const title = stripHtml(item.title || '');
				const url = pickArticleUrl(item);
				if (!title || !url) return null;
				return {
					title,
					snippet: stripHtml(item.description || ''),
					url,
					pubDate: item.pubDate ? new Date(item.pubDate) : new Date(0),
				};
			})
			.filter((item): item is { title: string; snippet: string; url: string; pubDate: Date } => Boolean(item));
		if (!rateLimited) await writeNaverSearchCache(query, mapped);
		return mapped;
	} catch (error) {
		console.warn(
			'[geo-news] Naver News search failed',
			query,
			error instanceof Error ? error.message : error,
		);
		return [];
	}
}

export async function collectNaverNewsSearch(): Promise<CollectedNewsArticle[]> {
	const credentials = readNaverCredentials();
	if (!credentials) return [];

	const collected: CollectedNewsArticle[] = [];
	const categories = listNewsKeywordCategories();

	for (const [index, category] of categories.entries()) {
		if (index > 0) await sleep(INTER_CALL_DELAY_MS);
		try {
			const { items } = await fetchNaverNewsPage(
				buildNaverNewsQuery(category.id),
				credentials.clientId,
				credentials.clientSecret,
			);
			for (const item of items) {
				const mapped = toCollected(item, category.id);
				if (mapped) collected.push(mapped);
			}
		} catch (error) {
			console.warn(
				'[geo-news] Naver News search failed',
				category.id,
				error instanceof Error ? error.message : error,
			);
		}
	}

	return collected;
}
