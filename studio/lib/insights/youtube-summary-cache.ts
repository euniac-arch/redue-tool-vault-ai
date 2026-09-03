export const YOUTUBE_SUMMARY_CACHE_KEY = 'redue_youtube_summary_cache';
export const YOUTUBE_SUMMARY_CACHE_EVENT = 'insights-youtube-summary-cache';
const YOUTUBE_SUMMARY_CACHE_MAX = 80;

export type VideoSummaryCacheEntry = {
	topic: string;
	keyPoints: string[];
	implications: string;
	summarizedAt: number;
};

export type VideoSummaryCache = {
	[videoId: string]: VideoSummaryCacheEntry;
};

let memoryCache: VideoSummaryCache | null = null;

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

function asText(value: unknown): string {
	return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function parseVideoSummaryEntry(value: unknown): VideoSummaryCacheEntry | null {
	if (!value || typeof value !== 'object') return null;
	const row = value as Record<string, unknown>;
	const topic = asText(row.topic);
	const implications = asText(row.implications);
	const keyPoints = Array.isArray(row.keyPoints) ? row.keyPoints.map(asText).filter(Boolean).slice(0, 3) : [];
	const summarizedAt = Number(row.summarizedAt);
	if (!topic && keyPoints.length === 0 && !implications) return null;
	return {
		topic,
		keyPoints,
		implications,
		summarizedAt: Number.isFinite(summarizedAt) && summarizedAt > 0 ? summarizedAt : Date.now(),
	};
}

export function parseVideoSummaryCache(raw: unknown): VideoSummaryCache {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
	const next: VideoSummaryCache = {};
	for (const [videoId, value] of Object.entries(raw as Record<string, unknown>)) {
		const id = asText(videoId);
		const entry = parseVideoSummaryEntry(value);
		if (!id || !entry) continue;
		next[id] = entry;
	}
	return next;
}

function notify() {
	if (!isBrowser()) return;
	try {
		window.dispatchEvent(new CustomEvent(YOUTUBE_SUMMARY_CACHE_EVENT));
	} catch {
		/* ignore */
	}
}

function persist(cache: VideoSummaryCache): VideoSummaryCache {
	const entries = Object.entries(cache).sort((a, b) => b[1].summarizedAt - a[1].summarizedAt);
	const next = Object.fromEntries(entries.slice(0, YOUTUBE_SUMMARY_CACHE_MAX)) as VideoSummaryCache;
	memoryCache = next;
	if (isBrowser()) {
		try {
			window.localStorage.setItem(YOUTUBE_SUMMARY_CACHE_KEY, JSON.stringify(next));
			notify();
		} catch {
			/* private mode / quota */
		}
	}
	return next;
}

export function readYoutubeSummaryCache(): VideoSummaryCache {
	if (memoryCache) return memoryCache;
	if (!isBrowser()) return {};
	try {
		const raw = window.localStorage.getItem(YOUTUBE_SUMMARY_CACHE_KEY);
		memoryCache = raw ? parseVideoSummaryCache(JSON.parse(raw) as unknown) : {};
	} catch {
		memoryCache = {};
	}
	return memoryCache;
}

export function getCachedVideoSummary(videoId: string): VideoSummaryCacheEntry | null {
	const id = asText(videoId);
	if (!id) return null;
	return readYoutubeSummaryCache()[id] || null;
}

export function writeCachedVideoSummary(videoId: string, entry: VideoSummaryCacheEntry): VideoSummaryCacheEntry | null {
	const id = asText(videoId);
	const parsed = parseVideoSummaryEntry(entry);
	if (!id || !parsed) return null;
	const cache = { ...readYoutubeSummaryCache(), [id]: parsed };
	persist(cache);
	return parsed;
}

export function invalidateYoutubeSummaryMemory() {
	memoryCache = null;
}

export function removeCachedVideoSummary(videoId: string) {
	const id = asText(videoId);
	if (!id) return;
	const cache = { ...readYoutubeSummaryCache() };
	if (!cache[id]) return;
	delete cache[id];
	persist(cache);
}
