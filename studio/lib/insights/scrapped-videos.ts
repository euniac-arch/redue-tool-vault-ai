import type { InsightsYoutubeVideo } from './insights-youtube';

export const SCRAPPED_VIDEOS_STORAGE_KEY = 'redue_scrapped_videos';
export const SCRAPPED_VIDEOS_EVENT = 'insights-scrapped-videos';

export type ScrappedVideoItem = InsightsYoutubeVideo & {
	queryKeyword?: string;
	scrappedAt: string;
	aiSummary?: string;
};

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

function asText(value: unknown): string {
	return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function parseScrappedVideo(value: unknown): ScrappedVideoItem | null {
	if (!value || typeof value !== 'object') return null;
	const row = value as Record<string, unknown>;
	const videoId = asText(row.videoId) || asText(row.id);
	const title = asText(row.title);
	if (!videoId || !title) return null;
	return {
		id: videoId,
		videoId,
		title,
		description: asText(row.description) || asText(row.summary),
		channelTitle: asText(row.channelTitle) || asText(row.publisher) || 'YouTube',
		publishedAt: asText(row.publishedAt),
		thumbnailUrl: asText(row.thumbnailUrl),
		videoUrl: asText(row.videoUrl) || `https://www.youtube.com/watch?v=${videoId}`,
		viewCount: Number(row.viewCount || 0) || 0,
		viewLabel: asText(row.viewLabel),
		duration: asText(row.duration),
		durationLabel: asText(row.durationLabel),
		queryKeyword: asText(row.queryKeyword),
		scrappedAt: asText(row.scrappedAt) || new Date().toISOString(),
		aiSummary: asText(row.aiSummary),
	};
}

function notify() {
	if (!isBrowser()) return;
	try {
		window.dispatchEvent(new CustomEvent(SCRAPPED_VIDEOS_EVENT));
	} catch {
		/* ignore */
	}
}

export function readScrappedVideos(): ScrappedVideoItem[] {
	if (!isBrowser()) return [];
	try {
		const raw = window.localStorage.getItem(SCRAPPED_VIDEOS_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		const seen = new Set<string>();
		const items: ScrappedVideoItem[] = [];
		for (const row of parsed) {
			const item = parseScrappedVideo(row);
			if (!item || seen.has(item.videoId)) continue;
			seen.add(item.videoId);
			items.push(item);
		}
		return items;
	} catch {
		return [];
	}
}

export function writeScrappedVideos(items: ScrappedVideoItem[]): ScrappedVideoItem[] {
	const next = items.map(parseScrappedVideo).filter((item): item is ScrappedVideoItem => Boolean(item));
	if (isBrowser()) {
		try {
			window.localStorage.setItem(SCRAPPED_VIDEOS_STORAGE_KEY, JSON.stringify(next));
			notify();
		} catch {
			/* private mode / quota */
		}
	}
	return next;
}

export function isVideoScrapped(videoId: string, items = readScrappedVideos()): boolean {
	return items.some((item) => item.videoId === videoId || item.id === videoId);
}

export function toggleScrappedVideo(
	video: InsightsYoutubeVideo,
	queryKeyword = '',
	current = readScrappedVideos(),
): { items: ScrappedVideoItem[]; saved: boolean } {
	if (isVideoScrapped(video.videoId, current)) {
		return {
			saved: false,
			items: writeScrappedVideos(current.filter((item) => item.videoId !== video.videoId && item.id !== video.videoId)),
		};
	}
	return {
		saved: true,
		items: writeScrappedVideos([
			{
				...video,
				queryKeyword: queryKeyword.trim() || 'YouTube',
				scrappedAt: new Date().toISOString(),
			},
			...current,
		]),
	};
}

export function removeScrappedVideo(videoId: string, current = readScrappedVideos()): ScrappedVideoItem[] {
	const key = videoId.trim();
	if (!key) return current;
	return writeScrappedVideos(current.filter((item) => item.videoId !== key && item.id !== key));
}
