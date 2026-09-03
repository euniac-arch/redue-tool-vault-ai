/**
 * Unified Insights scrap / bookmark store.
 * Bookmark clicks (feed + AI research) persist the full article object
 * so the mypage vault can render title / source / link immediately.
 */

import { INSIGHT_CATEGORY_LABEL, type InsightsNewsItem } from './insights-news-types';
import type { ResearchScrap } from '@/lib/mypage/research-scraps';

export const SCRAPPED_NEWS_STORAGE_KEY = 'redue_scrapped_news';
export const SCRAPPED_NEWS_EVENT = 'insights-scrapped-news';

export type ScrappedNewsItem = {
	id: string;
	title: string;
	url: string;
	publisher: string;
	publishedAt: string;
	summary: string;
	queryKeyword?: string;
	tag?: string;
	scrappedAt: string;
};

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

function asText(value: unknown): string {
	return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function normalizeScrapUrl(url: string): string {
	const raw = url.trim();
	if (!raw) return '';
	try {
		const parsed = new URL(raw);
		parsed.hash = '';
		return parsed.toString().replace(/\/$/, '');
	} catch {
		return raw.replace(/\/$/, '');
	}
}

export function scrapIdentity(item: { id?: string; url?: string; sourceUrl?: string }): string {
	return normalizeScrapUrl(item.url || item.sourceUrl || '') || asText(item.id);
}

export function toScrappedNewsItem(item: InsightsNewsItem, queryKeyword = ''): ScrappedNewsItem {
	const url = item.sourceUrl.trim();
	const id = asText(item.id) || url || `ai_${Date.now()}`;
	const tag = INSIGHT_CATEGORY_LABEL[item.category] || item.tags[0] || 'AI / SEO';
	return {
		id,
		title: item.title,
		url,
		publisher: item.sourceName || 'News',
		publishedAt: item.publishedAtIso || item.publishedAt || '',
		summary: item.summary || '저장된 인사이트 기사입니다.',
		queryKeyword: queryKeyword.trim() || item.tags[0] || tag,
		tag,
		scrappedAt: new Date().toISOString(),
	};
}

export function parseScrappedNewsItem(value: unknown): ScrappedNewsItem | null {
	if (!value || typeof value !== 'object') return null;
	const row = value as Record<string, unknown>;
	const title = asText(row.title) || asText(row.articleTitle);
	const url = asText(row.url) || asText(row.sourceUrl) || asText(row.articleUrl);
	const id = asText(row.id) || url;
	if (!title || (!url && !id)) return null;
	return {
		id,
		title,
		url,
		publisher: asText(row.publisher) || asText(row.sourceName) || asText(row.source) || 'News',
		publishedAt: asText(row.publishedAt) || asText(row.publishedAtIso) || asText(row.date) || '',
		summary: asText(row.summary) || asText(row.aiSummary) || asText(row.snippet) || '저장된 인사이트 기사입니다.',
		queryKeyword: asText(row.queryKeyword) || asText(row.tag) || 'AI / SEO',
		tag: asText(row.tag) || 'AI / SEO',
		scrappedAt: asText(row.scrappedAt) || new Date().toISOString(),
	};
}

export function isItemScrapped(
	item: { id?: string; url?: string; sourceUrl?: string },
	scraps: ScrappedNewsItem[],
): boolean {
	const id = asText(item.id);
	const url = scrapIdentity(item);
	return scraps.some((scrap) => scrap.id === id || (url && scrapIdentity(scrap) === url));
}

export function scrappedNewsIds(scraps: ScrappedNewsItem[]): string[] {
	return scraps.map((item) => item.id).filter(Boolean);
}

export function scrapToResearchScrap(item: ScrappedNewsItem): ResearchScrap {
	const day = (item.scrappedAt || item.publishedAt || '').slice(0, 10);
	return {
		id: item.id,
		queryKeyword: item.queryKeyword || item.tag || 'AI / SEO',
		articleTitle: item.title,
		source: item.publisher || 'News',
		articleUrl: item.url,
		aiSummary: item.summary,
		scrappedAt: day || new Date().toISOString().slice(0, 10),
		tag: item.tag || 'AI / SEO',
	};
}

function notifyScrappedNews() {
	if (!isBrowser()) return;
	try {
		window.dispatchEvent(new CustomEvent(SCRAPPED_NEWS_EVENT));
	} catch {
		/* ignore */
	}
}

export function readScrappedNews(): ScrappedNewsItem[] {
	if (!isBrowser()) return [];
	try {
		const raw = window.localStorage.getItem(SCRAPPED_NEWS_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		const seen = new Set<string>();
		const items: ScrappedNewsItem[] = [];
		for (const row of parsed) {
			const item = parseScrappedNewsItem(row);
			if (!item) continue;
			const key = scrapIdentity(item) || item.id;
			if (!key || seen.has(key)) continue;
			seen.add(key);
			items.push(item);
		}
		return items;
	} catch {
		return [];
	}
}

export function writeScrappedNews(items: ScrappedNewsItem[]): ScrappedNewsItem[] {
	const next = items
		.map((item) => parseScrappedNewsItem(item))
		.filter((item): item is ScrappedNewsItem => Boolean(item));
	if (isBrowser()) {
		try {
			window.localStorage.setItem(SCRAPPED_NEWS_STORAGE_KEY, JSON.stringify(next));
			notifyScrappedNews();
		} catch {
			/* private mode / quota */
		}
	}
	return next;
}

export function toggleScrappedNews(
	item: InsightsNewsItem,
	queryKeyword = '',
	current = readScrappedNews(),
): { items: ScrappedNewsItem[]; saved: boolean } {
	const exists = isItemScrapped(item, current);
	if (exists) {
		const id = asText(item.id);
		const url = scrapIdentity(item);
		return {
			saved: false,
			items: writeScrappedNews(
				current.filter((scrap) => scrap.id !== id && !(url && scrapIdentity(scrap) === url)),
			),
		};
	}
	return {
		saved: true,
		items: writeScrappedNews([toScrappedNewsItem(item, queryKeyword), ...current]),
	};
}

export function upsertScrappedNews(
	item: InsightsNewsItem,
	queryKeyword = '',
	current = readScrappedNews(),
): ScrappedNewsItem[] {
	if (isItemScrapped(item, current)) return current;
	return writeScrappedNews([toScrappedNewsItem(item, queryKeyword), ...current]);
}

export function removeScrappedNews(idOrUrl: string, current = readScrappedNews()): ScrappedNewsItem[] {
	const key = scrapIdentity({ id: idOrUrl, url: idOrUrl }) || idOrUrl.trim();
	if (!key) return current;
	return writeScrappedNews(
		current.filter((scrap) => scrap.id !== idOrUrl.trim() && scrapIdentity(scrap) !== key),
	);
}
