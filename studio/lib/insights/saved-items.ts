import { formatRelativeKo } from '@/lib/admin/geo-news-html';
import type { InsightsNewsItem } from './insights-news-types';
import type { InsightsYoutubeVideo } from './insights-youtube';
import { youtubeWatchUrl } from './insights-youtube';
import { parseScrappedNewsItem, type ScrappedNewsItem, writeScrappedNews } from './scrapped-news';
import { parseScrappedVideo, writeScrappedVideos } from './scrapped-videos';
import { getCachedVideoSummary } from './youtube-summary-cache';

export const SAVED_ITEMS_STORAGE_KEY = 'redue_saved_items';
export const SAVED_ITEMS_EVENT = 'insights-saved-items';

export type SavedItemType = 'news' | 'youtube';

export type SavedItem = {
	id: string;
	type: SavedItemType;
	title: string;
	description?: string;
	url?: string;
	thumbnail?: string;
	channelTitle?: string;
	source?: string;
	publishedAt: string;
	savedAt: number;
	aiSummary?: unknown;
};

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

function asText(value: unknown): string {
	return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function parseSavedItem(value: unknown): SavedItem | null {
	if (!value || typeof value !== 'object') return null;
	const row = value as Record<string, unknown>;
	const type = row.type === 'youtube' ? 'youtube' : row.type === 'news' ? 'news' : '';
	const id = asText(row.id) || asText(row.videoId);
	const title = asText(row.title);
	if (!type || !id || !title) return null;
	const savedAt = Number(row.savedAt);
	return {
		id,
		type,
		title,
		description: asText(row.description) || undefined,
		url: asText(row.url) || undefined,
		thumbnail: asText(row.thumbnail) || asText(row.thumbnailUrl) || undefined,
		channelTitle: asText(row.channelTitle) || undefined,
		source: asText(row.source) || asText(row.publisher) || undefined,
		publishedAt: asText(row.publishedAt),
		savedAt: Number.isFinite(savedAt) && savedAt > 0 ? savedAt : Date.now(),
		aiSummary: row.aiSummary,
	};
}

function notifySavedItems() {
	if (!isBrowser()) return;
	try {
		window.dispatchEvent(new CustomEvent(SAVED_ITEMS_EVENT));
	} catch {
		/* ignore */
	}
}

export function newsToSavedItem(item: InsightsNewsItem): SavedItem {
	return {
		id: item.id || item.sourceUrl,
		type: 'news',
		title: item.title,
		description: item.summary || undefined,
		url: item.sourceUrl || undefined,
		source: item.sourceName || undefined,
		publishedAt: item.publishedAtIso || item.publishedAt || '',
		savedAt: Date.now(),
		aiSummary: item.summary || undefined,
	};
}

export function youtubeToSavedItem(item: InsightsYoutubeVideo, aiSummary?: unknown): SavedItem {
	return {
		id: item.videoId || item.id,
		type: 'youtube',
		title: item.title,
		description: item.description || undefined,
		url: item.videoUrl || youtubeWatchUrl(item.videoId || item.id),
		thumbnail: item.thumbnailUrl || undefined,
		channelTitle: item.channelTitle || undefined,
		publishedAt: item.publishedAt || '',
		savedAt: Date.now(),
		aiSummary: aiSummary ?? getCachedVideoSummary(item.videoId || item.id) ?? undefined,
	};
}

export function savedItemToNewsItem(item: SavedItem): InsightsNewsItem {
	// `SavedItem.publishedAt` deliberately stores the canonical ISO timestamp
	// (see `newsToSavedItem` below) so bookmarked cards keep sorting correctly
	// no matter how long ago they were saved. It must be re-formatted into a
	// relative Korean label here — never rendered as the raw ISO string — since
	// `InsightsNewsCard` displays `publishedAt` verbatim.
	const published = item.publishedAt || '';
	const publishedDate = published ? new Date(published) : null;
	const isValidDate = Boolean(publishedDate) && !Number.isNaN(publishedDate!.getTime());
	const displayLabel = isValidDate ? formatRelativeKo(publishedDate!) : '';
	return {
		id: item.id,
		title: item.title,
		summary: item.description || '',
		sourceName: item.source || 'News',
		sourceUrl: item.url || '',
		guid: null,
		region: 'GLOBAL',
		publishedAt: displayLabel || published,
		publishedAtIso: isValidDate ? publishedDate!.toISOString() : published,
		category: 'aeo_geo_search',
		categories: [],
		tags: [],
	};
}

export function savedItemToYoutubeVideo(item: SavedItem): InsightsYoutubeVideo {
	const videoId = item.id;
	return {
		id: videoId,
		videoId,
		title: item.title,
		description: item.description || '',
		channelTitle: item.channelTitle || 'YouTube',
		publishedAt: item.publishedAt || '',
		thumbnailUrl: item.thumbnail || '',
		videoUrl: item.url || youtubeWatchUrl(videoId),
		viewCount: 0,
		viewLabel: '',
		duration: '',
		durationLabel: '',
	};
}

function migrateLegacySavedItems(): SavedItem[] {
	if (!isBrowser()) return [];
	const migrated: SavedItem[] = [];
	try {
		const newsRaw = window.localStorage.getItem('redue_scrapped_news');
		const newsParsed = newsRaw ? (JSON.parse(newsRaw) as unknown) : [];
		if (Array.isArray(newsParsed)) {
			for (const row of newsParsed) {
				const scrap = parseScrappedNewsItem(row);
				if (!scrap) continue;
				migrated.push({
					id: scrap.id || scrap.url,
					type: 'news',
					title: scrap.title,
					description: scrap.summary || undefined,
					url: scrap.url || undefined,
					source: scrap.publisher || undefined,
					publishedAt: scrap.publishedAt || '',
					savedAt: Date.parse(scrap.scrappedAt) || Date.now(),
					aiSummary: scrap.summary || undefined,
				});
			}
		}
	} catch {
		/* ignore */
	}
	try {
		const videoRaw = window.localStorage.getItem('redue_scrapped_videos');
		const videoParsed = videoRaw ? (JSON.parse(videoRaw) as unknown) : [];
		if (Array.isArray(videoParsed)) {
			for (const row of videoParsed) {
				const scrap = parseScrappedVideo(row);
				if (!scrap) continue;
				migrated.push({
					id: scrap.videoId || scrap.id,
					type: 'youtube',
					title: scrap.title,
					description: scrap.description || undefined,
					url: scrap.videoUrl || undefined,
					thumbnail: scrap.thumbnailUrl || undefined,
					channelTitle: scrap.channelTitle || undefined,
					publishedAt: scrap.publishedAt || '',
					savedAt: Date.parse(scrap.scrappedAt) || Date.now(),
					aiSummary: scrap.aiSummary || undefined,
				});
			}
		}
	} catch {
		/* ignore */
	}
	return dedupeSavedItems(migrated);
}

function dedupeSavedItems(items: SavedItem[]): SavedItem[] {
	const seen = new Set<string>();
	const next: SavedItem[] = [];
	for (const item of items) {
		const key = `${item.type}:${item.id}`;
		if (seen.has(key)) continue;
		seen.add(key);
		next.push(item);
	}
	return next;
}

function mirrorLegacyStores(items: SavedItem[]) {
	const news = items
		.filter((item) => item.type === 'news')
		.map((item) =>
			parseScrappedNewsItem({
				id: item.id,
				title: item.title,
				url: item.url,
				publisher: item.source,
				publishedAt: item.publishedAt,
				summary: item.description,
				scrappedAt: new Date(item.savedAt).toISOString(),
			}),
		)
		.filter((item): item is ScrappedNewsItem => Boolean(item));
	const videos = items
		.filter((item) => item.type === 'youtube')
		.map((item) =>
			parseScrappedVideo({
				...savedItemToYoutubeVideo(item),
				scrappedAt: new Date(item.savedAt).toISOString(),
				aiSummary: typeof item.aiSummary === 'string' ? item.aiSummary : undefined,
			}),
		)
		.filter((item): item is NonNullable<ReturnType<typeof parseScrappedVideo>> => Boolean(item));
	writeScrappedNews(news);
	writeScrappedVideos(videos);
}

export function readSavedItems(): SavedItem[] {
	if (!isBrowser()) return [];
	try {
		const raw = window.localStorage.getItem(SAVED_ITEMS_STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as unknown;
			if (Array.isArray(parsed)) {
				const items = dedupeSavedItems(parsed.map(parseSavedItem).filter((item): item is SavedItem => Boolean(item)));
				if (items.length > 0) return items;
			}
		}
	} catch {
		/* ignore */
	}
	const migrated = migrateLegacySavedItems();
	if (migrated.length > 0) writeSavedItems(migrated);
	return migrated;
}

export function writeSavedItems(items: SavedItem[]): SavedItem[] {
	const next = dedupeSavedItems(items.map(parseSavedItem).filter((item): item is SavedItem => Boolean(item)));
	if (isBrowser()) {
		try {
			window.localStorage.setItem(SAVED_ITEMS_STORAGE_KEY, JSON.stringify(next));
			mirrorLegacyStores(next);
			notifySavedItems();
		} catch {
			/* private mode / quota */
		}
	}
	return next;
}

export function isItemSaved(id: string, type: SavedItemType, items = readSavedItems()): boolean {
	const key = id.trim();
	if (!key) return false;
	return items.some((item) => item.type === type && item.id === key);
}

export function toggleBookmark(
	input: { type: 'news'; item: InsightsNewsItem } | { type: 'youtube'; item: InsightsYoutubeVideo },
	current = readSavedItems(),
): { items: SavedItem[]; saved: boolean } {
	const nextItem = input.type === 'news' ? newsToSavedItem(input.item) : youtubeToSavedItem(input.item);
	if (isItemSaved(nextItem.id, nextItem.type, current)) {
		return {
			saved: false,
			items: writeSavedItems(current.filter((item) => !(item.type === nextItem.type && item.id === nextItem.id))),
		};
	}
	return {
		saved: true,
		items: writeSavedItems([nextItem, ...current]),
	};
}

export function upsertBookmark(
	input: { type: 'news'; item: InsightsNewsItem } | { type: 'youtube'; item: InsightsYoutubeVideo },
	current = readSavedItems(),
): SavedItem[] {
	const nextItem = input.type === 'news' ? newsToSavedItem(input.item) : youtubeToSavedItem(input.item);
	if (isItemSaved(nextItem.id, nextItem.type, current)) return current;
	return writeSavedItems([nextItem, ...current]);
}

export function countSavedItems(items: SavedItem[], type: SavedItemType): number {
	return items.filter((item) => item.type === type).length;
}
