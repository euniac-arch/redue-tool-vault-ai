import 'server-only';

import * as cheerio from 'cheerio';
import { stripHtml } from '@/lib/admin/geo-news-html';
import { cleanNewsPageHeadline, expandTruncatedNewsTitle, looksTruncatedNewsTitle } from './insights-news-title';

const FETCH_TIMEOUT_MS = 2_800;
const COLLECT_LIMIT = 80;
const CACHE_REPAIR_LIMIT = 40;
const CONCURRENCY = 8;
const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export type NewsTitleSource = {
	id?: string;
	title: string;
	summary?: string;
	sourceUrl?: string;
	link?: string;
	region?: string;
};

export type ResolveTruncatedNewsTitlesOptions = {
	/** Max articles to repair in this pass. Collect uses a high cap; cache hits stay smaller. */
	limit?: number;
};

async function mapPool<T>(items: readonly T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
	let cursor = 0;
	async function run() {
		while (cursor < items.length) {
			const index = cursor;
			cursor += 1;
			const item = items[index];
			if (item === undefined) return;
			await worker(item);
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
}

export async function fetchNewsPageTitle(url: string): Promise<string> {
	if (!/^https?:\/\//i.test(url)) return '';
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			headers: {
				Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
				'User-Agent': USER_AGENT,
			},
			redirect: 'follow',
			cache: 'no-store',
		});
		if (!res.ok) return '';
		const html = (await res.text()).slice(0, 160_000);
		const $ = cheerio.load(html);
		const candidates = [
			$('meta[property="og:title"]').attr('content'),
			$('meta[name="og:title"]').attr('content'),
			$('meta[name="twitter:title"]').attr('content'),
			$('title').first().text(),
			$('h1').first().text(),
		]
			.map((raw) => cleanNewsPageHeadline(stripHtml(raw || '')))
			.filter(Boolean);
		const complete = candidates.find((item) => !looksTruncatedNewsTitle(item));
		return complete || candidates.sort((a, b) => b.length - a.length)[0] || '';
	} catch {
		return '';
	} finally {
		clearTimeout(timer);
	}
}

export async function resolveTruncatedNewsTitles<T extends NewsTitleSource>(
	articles: T[],
	options: ResolveTruncatedNewsTitlesOptions = {},
): Promise<T[]> {
	const limit = options.limit ?? COLLECT_LIMIT;
	const targets = articles
		.filter((article) => looksTruncatedNewsTitle(article.title))
		.sort((a, b) => Number(b.region === 'KR') - Number(a.region === 'KR'))
		.slice(0, Math.max(0, limit));
	if (targets.length === 0) return articles;

	await mapPool(targets, CONCURRENCY, async (article) => {
		const url = (article.sourceUrl || article.link || '').trim();
		const pageTitle = url ? await fetchNewsPageTitle(url) : '';
		const next = expandTruncatedNewsTitle(article.title, article.summary || '', pageTitle);
		if (next && next !== article.title) article.title = next;
	});
	return articles;
}

export const INSIGHTS_CACHE_TITLE_REPAIR_LIMIT = CACHE_REPAIR_LIMIT;
