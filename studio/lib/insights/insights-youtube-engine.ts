import 'server-only';

import { extractJsonObjectFromText } from './insights-ai-research';
import {
	formatYoutubeDuration,
	formatYoutubeViewCount,
	normalizeYoutubeComment,
	normalizeYoutubeSummary,
	parseYoutubeCollectionTarget,
	pickYoutubeThumbnail,
	sortYoutubeVideosByNewest,
	YOUTUBE_COMMENTS_PAGE_SIZE,
	YOUTUBE_SEARCH_CACHE_TTL_MS,
	YOUTUBE_SEARCH_MAX,
	YOUTUBE_VIDEOS_CACHE_VERSION,
	youtubeWatchUrl,
	type InsightsYoutubeComment,
	type InsightsYoutubeCommentsResult,
	type InsightsYoutubeSearchResult,
	type InsightsYoutubeSummary,
	type InsightsYoutubeVideo,
	type YoutubeCollectionSource,
} from './insights-youtube';

const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';
const YOUTUBE_CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels';
const YOUTUBE_PLAYLIST_ITEMS_URL = 'https://www.googleapis.com/youtube/v3/playlistItems';
const YOUTUBE_COMMENTS_URL = 'https://www.googleapis.com/youtube/v3/commentThreads';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const SEARCH_TIMEOUT_MS = 10_000;
const OPENAI_TIMEOUT_MS = 20_000;

function envString(name: string): string {
	return (process.env[name] || '').trim().replace(/^["']|["']$/g, '');
}

export function readYoutubeApiKey(): string {
	return (
		envString('YOUTUBE_API_KEY') ||
		envString('GOOGLE_YOUTUBE_API_KEY') ||
		envString('GOOGLE_API_KEY') ||
		envString('GOOGLE_SEARCH_API_KEY')
	);
}

export function readYoutubeOpenAiKey(): string {
	return envString('OPENAI_API_KEY');
}

async function fetchJson(url: string, timeoutMs: number, label: string, revalidateSec = 0): Promise<unknown> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			...(revalidateSec > 0
				? { next: { revalidate: revalidateSec } }
				: { cache: 'no-store' as const }),
		});
		const body = (await res.json().catch(() => null)) as unknown;
		if (!res.ok) {
			const error = body && typeof body === 'object' ? (body as { error?: { message?: string } }).error?.message : '';
			throw new Error(error || `${label} HTTP ${res.status}`);
		}
		return body;
	} finally {
		clearTimeout(timer);
	}
}

type SearchCacheEntry = {
	expiresAt: number;
	result: InsightsYoutubeSearchResult;
};

const searchMemoryCache = new Map<string, SearchCacheEntry>();

export function youtubeSearchCacheKey(query: string, channelId = '', playlistId = ''): string {
	return [`v${YOUTUBE_VIDEOS_CACHE_VERSION}`, query.trim().toLowerCase(), channelId.trim(), playlistId.trim()].join('|');
}

export function readYoutubeSearchMemory(key: string, now = Date.now()): InsightsYoutubeSearchResult | null {
	const hit = searchMemoryCache.get(key);
	if (!hit || hit.expiresAt <= now) return null;
	return { ...hit.result, cached: true };
}

export function writeYoutubeSearchMemory(key: string, result: InsightsYoutubeSearchResult, now = Date.now()) {
	searchMemoryCache.set(key, { expiresAt: now + YOUTUBE_SEARCH_CACHE_TTL_MS, result });
}

type YoutubeSearchItem = {
	id?: { videoId?: string };
	snippet?: {
		title?: string;
		description?: string;
		channelTitle?: string;
		publishedAt?: string;
		thumbnails?: unknown;
	};
};

type YoutubeVideoItem = {
	id?: string;
	snippet?: YoutubeSearchItem['snippet'];
	contentDetails?: { duration?: string };
	statistics?: { viewCount?: string };
};

type YoutubePlaylistItem = {
	id?: string | { videoId?: string };
	snippet?: YoutubeSearchItem['snippet'] & {
		resourceId?: { videoId?: string };
	};
};

function toVideo(item: YoutubeVideoItem | YoutubeSearchItem | YoutubePlaylistItem, fallbackId = ''): InsightsYoutubeVideo | null {
	const snippet = item.snippet;
	const resourceId = (snippet as YoutubePlaylistItem['snippet'])?.resourceId?.videoId || '';
	const searchId = typeof item.id === 'object' && item.id ? (item.id as { videoId?: string }).videoId || '' : '';
	const stringId = typeof item.id === 'string' && /^[\w-]{11}$/.test(item.id) ? item.id : '';
	const videoId = resourceId || searchId || stringId || fallbackId;
	const title = (snippet?.title || '').replace(/\s+/g, ' ').trim();
	if (!videoId || !title) return null;
	const viewCount = Number((item as YoutubeVideoItem).statistics?.viewCount || 0);
	const duration = (item as YoutubeVideoItem).contentDetails?.duration || '';
	const publishedAt = snippet?.publishedAt || '';
	return {
		id: videoId,
		videoId,
		title,
		description: (snippet?.description || '').replace(/\s+/g, ' ').trim(),
		channelTitle: (snippet?.channelTitle || 'YouTube').trim(),
		publishedAt,
		thumbnailUrl: pickYoutubeThumbnail(snippet?.thumbnails),
		videoUrl: youtubeWatchUrl(videoId),
		viewCount: Number.isFinite(viewCount) ? viewCount : 0,
		viewLabel: formatYoutubeViewCount(Number.isFinite(viewCount) ? viewCount : 0),
		duration,
		durationLabel: formatYoutubeDuration(duration),
	};
}

async function hydrateVideoDetails(videos: InsightsYoutubeVideo[], apiKey: string): Promise<InsightsYoutubeVideo[]> {
	const ids = videos.map((item) => item.videoId).filter(Boolean).slice(0, YOUTUBE_SEARCH_MAX);
	if (ids.length === 0) return videos;
	const detailParams = new URLSearchParams({
		part: 'snippet,statistics,contentDetails',
		id: ids.join(','),
		maxResults: '50',
		key: apiKey,
	});
	const details = (await fetchJson(
		`${YOUTUBE_VIDEOS_URL}?${detailParams.toString()}`,
		SEARCH_TIMEOUT_MS,
		'youtube-videos',
	)) as { items?: YoutubeVideoItem[] };
	const byId = new Map((details.items || []).map((item) => [item.id || '', item]));
	return videos.map((item) => {
		const detailed = byId.get(item.videoId);
		return detailed ? toVideo(detailed, item.videoId) || item : item;
	});
}

async function listPlaylistVideos(playlistId: string, apiKey: string): Promise<InsightsYoutubeVideo[]> {
	const params = new URLSearchParams({
		part: 'snippet',
		playlistId,
		maxResults: '50',
		key: apiKey,
	});
	const data = (await fetchJson(
		`${YOUTUBE_PLAYLIST_ITEMS_URL}?${params.toString()}`,
		SEARCH_TIMEOUT_MS,
		'youtube-playlist',
	)) as { items?: YoutubePlaylistItem[] };
	return (data.items || [])
		.map((item) => toVideo(item, item.snippet?.resourceId?.videoId || ''))
		.filter((item): item is InsightsYoutubeVideo => Boolean(item));
}

async function resolveUploadsPlaylist(handle: string, apiKey: string): Promise<string> {
	const params = new URLSearchParams({
		part: 'contentDetails',
		forHandle: handle,
		key: apiKey,
	});
	const data = (await fetchJson(
		`${YOUTUBE_CHANNELS_URL}?${params.toString()}`,
		SEARCH_TIMEOUT_MS,
		'youtube-channels',
		3600,
	)) as { items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }> };
	return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || '';
}

async function searchByKeyword(query: string, apiKey: string): Promise<InsightsYoutubeVideo[]> {
	const params = new URLSearchParams({
		part: 'snippet',
		type: 'video',
		q: query,
		maxResults: '50',
		order: 'date',
		safeSearch: 'moderate',
		relevanceLanguage: 'ko',
		key: apiKey,
	});
	const search = (await fetchJson(
		`${YOUTUBE_SEARCH_URL}?${params.toString()}`,
		SEARCH_TIMEOUT_MS,
		'youtube-search',
	)) as { items?: YoutubeSearchItem[] };
	const draft = (search.items || [])
		.map((item) => toVideo(item, item.id?.videoId || ''))
		.filter((item): item is InsightsYoutubeVideo => Boolean(item));
	return hydrateVideoDetails(draft, apiKey);
}

export async function searchYoutubeVideos(
	query: string,
	apiKey: string,
	options?: { channelId?: string; playlistId?: string },
): Promise<InsightsYoutubeSearchResult> {
	const target = parseYoutubeCollectionTarget({
		query,
		channelId: options?.channelId,
		playlistId: options?.playlistId,
	});
	const cacheKey = youtubeSearchCacheKey(target.query, target.channelId || '', target.playlistId || target.handle || '');
	const cached = readYoutubeSearchMemory(cacheKey);
	if (cached) return cached;

	let videos: InsightsYoutubeVideo[] = [];
	let source: YoutubeCollectionSource = 'search';

	if (target.kind === 'handle' && target.handle) {
		const uploads = await resolveUploadsPlaylist(target.handle, apiKey);
		if (uploads) {
			videos = await listPlaylistVideos(uploads, apiKey);
			source = 'playlist';
		}
	} else if (target.kind === 'playlist' && target.playlistId) {
		videos = await listPlaylistVideos(target.playlistId, apiKey);
		source = 'playlist';
	}

	if (videos.length === 0 && target.query) {
		videos = await searchByKeyword(target.query, apiKey);
		source = 'search';
	}

	const result: InsightsYoutubeSearchResult = {
		query: target.query || query,
		videos: sortYoutubeVideosByNewest(videos).slice(0, YOUTUBE_SEARCH_MAX),
		source,
		warning:
			videos.length === 0 ? '관련 영상을 찾지 못했습니다. 다른 키워드로 검색해 보세요.' : undefined,
	};
	if (result.videos.length > 0) writeYoutubeSearchMemory(cacheKey, result);
	return result;
}

export function buildHeuristicYoutubeSummary(video: {
	title: string;
	description: string;
	channelTitle: string;
}): InsightsYoutubeSummary {
	const lead = video.description.replace(/\s+/g, ' ').trim().slice(0, 140);
	return {
		videoId: '',
		model: 'heuristic',
		warning: '설명란 기반 약식 요약을 사용했습니다.',
		bullets: [
			`「${video.title}」 — ${video.channelTitle} 채널의 AI/SEO 관련 영상입니다.`,
			lead || '영상 설명이 짧아 제목과 채널 정보만으로 핵심을 추정했습니다.',
			'원문을 확인한 뒤 공식 페이지의 엔티티·스키마 신호와 맞춰 보세요.',
		],
	};
}

export async function summarizeYoutubeVideo(
	video: { videoId: string; title: string; description: string; channelTitle: string },
	apiKey = readYoutubeOpenAiKey(),
): Promise<InsightsYoutubeSummary> {
	if (!apiKey) {
		return { ...buildHeuristicYoutubeSummary(video), videoId: video.videoId };
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
	try {
		const res = await fetch(OPENAI_URL, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			signal: controller.signal,
			body: JSON.stringify({
				model: MODEL,
				temperature: 0.3,
				response_format: { type: 'json_object' },
				messages: [
					{
						role: 'system',
						content:
							'너는 AI SEO/GEO 영상 분석가다. 제공된 제목·설명만 근거로 3줄 핵심 요약을 JSON으로 반환하라. 없는 사실을 만들지 마라. JSON 키: bullets(string[3]).',
					},
					{
						role: 'user',
						content: JSON.stringify({
							title: video.title,
							channelTitle: video.channelTitle,
							description: video.description.slice(0, 2_400),
						}),
					},
				],
			}),
		});
		const data = (await res.json().catch(() => null)) as {
			error?: { message?: string };
			choices?: Array<{ message?: { content?: string } }>;
		} | null;
		if (!res.ok) throw new Error(data?.error?.message || `OpenAI HTTP ${res.status}`);
		const content = data?.choices?.[0]?.message?.content;
		if (!content) throw new Error('Empty OpenAI response');
		const parsed = normalizeYoutubeSummary(extractJsonObjectFromText(content), video.videoId);
		if (parsed.bullets.length === 0) {
			return { ...buildHeuristicYoutubeSummary(video), videoId: video.videoId, warning: '모델 요약을 비워 약식 요약을 사용했습니다.' };
		}
		return { ...parsed, model: MODEL, videoId: video.videoId };
	} finally {
		clearTimeout(timer);
	}
}

export async function fetchYoutubeComments(
	videoId: string,
	apiKey: string,
	pageToken = '',
): Promise<InsightsYoutubeCommentsResult> {
	const params = new URLSearchParams({
		part: 'snippet',
		videoId,
		maxResults: String(YOUTUBE_COMMENTS_PAGE_SIZE),
		order: 'relevance',
		textFormat: 'plainText',
		key: apiKey,
	});
	if (pageToken) params.set('pageToken', pageToken);
	const data = (await fetchJson(`${YOUTUBE_COMMENTS_URL}?${params.toString()}`, SEARCH_TIMEOUT_MS, 'youtube-comments')) as {
		items?: unknown[];
		nextPageToken?: string;
	};
	const comments = (data.items || [])
		.map((item, index) => normalizeYoutubeComment(item, index))
		.filter((item): item is InsightsYoutubeComment => Boolean(item));
	return {
		success: comments.length > 0,
		videoId,
		comments,
		nextPageToken: data.nextPageToken || undefined,
	};
}
