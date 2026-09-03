export type InsightsYoutubeVideo = {
	id: string;
	videoId: string;
	title: string;
	description: string;
	channelTitle: string;
	publishedAt: string;
	thumbnailUrl: string;
	videoUrl: string;
	viewCount: number;
	viewLabel: string;
	duration: string;
	durationLabel: string;
};

export const YOUTUBE_SEARCH_MAX = 50;
export const YOUTUBE_VISIBLE_PAGE_SIZE = 12;
export const YOUTUBE_SEARCH_CACHE_TTL_MS = 60 * 60 * 1000;
/** Bump when the search payload shape or result cap changes so old 8-item caches are ignored. */
export const YOUTUBE_VIDEOS_CACHE_VERSION = 3;

export function isUsableYoutubeVideoCache(version: unknown, videoCount: number): boolean {
	return Number(version) === YOUTUBE_VIDEOS_CACHE_VERSION && Number.isFinite(videoCount) && videoCount > 0;
}

export type YoutubeCollectionKind = 'playlist' | 'handle' | 'search';
export type YoutubeCollectionSource = 'search' | 'playlist';

export type YoutubeCollectionTarget = {
	kind: YoutubeCollectionKind;
	query: string;
	channelId?: string;
	playlistId?: string;
	handle?: string;
};

export type InsightsYoutubeSearchResult = {
	query: string;
	videos: InsightsYoutubeVideo[];
	warning?: string;
	source?: YoutubeCollectionSource;
	cached?: boolean;
};

export type InsightsYoutubeSummary = {
	videoId: string;
	bullets: string[];
	model: string;
	warning?: string;
};

export type InsightsYoutubeComment = {
	id: string;
	authorName: string;
	authorImageUrl: string;
	text: string;
	likeCount: number;
	publishedAt: string;
	publishedLabel: string;
};

export const YOUTUBE_COMMENTS_PAGE_SIZE = 20;
export const YOUTUBE_COMMENTS_MAX = 100;

export type InsightsYoutubeCommentsResult = {
	success: boolean;
	videoId: string;
	comments: InsightsYoutubeComment[];
	nextPageToken?: string;
	message?: string;
};

export type InsightsYoutubeTranscriptSummary = {
	success: boolean;
	videoId: string;
	topic?: string;
	keyPoints?: string[];
	implications?: string;
	message?: string;
	model?: string;
	lang?: string;
};

function asText(value: unknown): string {
	return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function youtubeWatchUrl(videoId: string): string {
	return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

export function formatYoutubeDuration(iso: string): string {
	const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(iso.trim());
	if (!match) return '';
	const hours = Number(match[1] || 0);
	const minutes = Number(match[2] || 0);
	const seconds = Number(match[3] || 0);
	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatYoutubeViewCount(count: number): string {
	if (!Number.isFinite(count) || count < 0) return '조회수 없음';
	if (count >= 100_000_000) return `${(count / 100_000_000).toFixed(1).replace(/\.0$/, '')}억회`;
	if (count >= 10_000) return `${(count / 10_000).toFixed(count >= 100_000 ? 0 : 1).replace(/\.0$/, '')}만회`;
	return `${count.toLocaleString('ko-KR')}회`;
}

export function formatYoutubePublishedAt(iso: string, now = Date.now()): string {
	const then = Date.parse(iso);
	if (Number.isNaN(then)) return '';
	const diff = Math.max(0, now - then);
	if (diff < 60_000) return '방금 전';
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
	if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}일 전`;
	return new Intl.DateTimeFormat('ko-KR', {
		timeZone: 'Asia/Seoul',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(new Date(then));
}

export function pickYoutubeThumbnail(thumbnails: unknown): string {
	if (!thumbnails || typeof thumbnails !== 'object') return '';
	const map = thumbnails as Record<string, { url?: unknown }>;
	for (const key of ['high', 'medium', 'default', 'standard', 'maxres']) {
		const url = asText(map[key]?.url);
		if (url) return url;
	}
	return '';
}

export function normalizeYoutubeVideo(value: unknown): InsightsYoutubeVideo | null {
	if (!value || typeof value !== 'object') return null;
	const row = value as Record<string, unknown>;
	const videoId = asText(row.videoId) || asText(row.id);
	const title = asText(row.title);
	if (!videoId || !title) return null;
	const viewCount = Number(row.viewCount || 0);
	const duration = asText(row.duration);
	const publishedAt = asText(row.publishedAt);
	return {
		id: videoId,
		videoId,
		title,
		description: asText(row.description),
		channelTitle: asText(row.channelTitle) || 'YouTube',
		publishedAt,
		thumbnailUrl: asText(row.thumbnailUrl),
		videoUrl: asText(row.videoUrl) || youtubeWatchUrl(videoId),
		viewCount: Number.isFinite(viewCount) ? viewCount : 0,
		viewLabel: asText(row.viewLabel) || formatYoutubeViewCount(Number.isFinite(viewCount) ? viewCount : 0),
		duration,
		durationLabel: asText(row.durationLabel) || formatYoutubeDuration(duration),
	};
}

export function sortYoutubeVideosByNewest(videos: InsightsYoutubeVideo[]): InsightsYoutubeVideo[] {
	return [...videos].sort((a, b) => {
		const aTime = Date.parse(a.publishedAt) || 0;
		const bTime = Date.parse(b.publishedAt) || 0;
		return bTime - aTime;
	});
}

const CHANNEL_ID_RE = /^UC[\w-]{22}$/i;
const UPLOADS_PLAYLIST_RE = /^UU[\w-]{22}$/i;

export function uploadsPlaylistIdFromChannel(channelId: string): string {
	const id = asText(channelId);
	if (!CHANNEL_ID_RE.test(id)) return '';
	return `UU${id.slice(2)}`;
}

export function parseYoutubeCollectionTarget(input: {
	query?: string;
	channelId?: string;
	playlistId?: string;
}): YoutubeCollectionTarget {
	const query = asText(input.query);
	const channelId = asText(input.channelId);
	const playlistId = asText(input.playlistId);
	if (playlistId) return { kind: 'playlist', query: query || playlistId, playlistId };
	if (channelId) {
		return {
			kind: 'playlist',
			query: query || channelId,
			channelId,
			playlistId: uploadsPlaylistIdFromChannel(channelId),
		};
	}

	const channelMatch = query.match(/(?:youtube\.com\/channel\/)?(UC[\w-]{22})/i);
	if (channelMatch?.[1]) {
		const id = channelMatch[1];
		return { kind: 'playlist', query, channelId: id, playlistId: uploadsPlaylistIdFromChannel(id) };
	}
	const uploadsMatch = query.match(/\b(UU[\w-]{22})\b/i);
	if (uploadsMatch?.[1] && UPLOADS_PLAYLIST_RE.test(uploadsMatch[1])) {
		return { kind: 'playlist', query, playlistId: uploadsMatch[1] };
	}
	const listMatch = query.match(/[?&]list=([\w-]+)/i);
	if (listMatch?.[1]) return { kind: 'playlist', query, playlistId: listMatch[1] };
	const handleMatch = query.match(/@([\w.-]{3,})/);
	if (handleMatch?.[1]) return { kind: 'handle', query, handle: handleMatch[1] };
	return { kind: 'search', query };
}

export function normalizeYoutubeSearchResult(raw: unknown, query = ''): InsightsYoutubeSearchResult {
	const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const videos = Array.isArray(body.videos)
		? body.videos.map(normalizeYoutubeVideo).filter((item): item is InsightsYoutubeVideo => Boolean(item))
		: [];
	const source = body.source === 'playlist' || body.source === 'search' ? body.source : undefined;
	return {
		query: asText(body.query) || query,
		videos: sortYoutubeVideosByNewest(videos).slice(0, YOUTUBE_SEARCH_MAX),
		warning: asText(body.warning) || undefined,
		source,
		cached: body.cached === true,
	};
}

export function normalizeYoutubeSummary(raw: unknown, videoId = ''): InsightsYoutubeSummary {
	const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const bullets = Array.isArray(body.bullets)
		? body.bullets.map(asText).filter(Boolean).slice(0, 3)
		: typeof body.summary === 'string'
			? body.summary
					.split('\n')
					.map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
					.filter(Boolean)
					.slice(0, 3)
			: [];
	return {
		videoId: asText(body.videoId) || videoId,
		bullets,
		model: asText(body.model) || 'gpt-4o-mini',
		warning: asText(body.warning) || undefined,
	};
}

export function normalizeYoutubeTranscriptSummary(
	raw: unknown,
	videoId = '',
): InsightsYoutubeTranscriptSummary {
	const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const keyPoints = Array.isArray(body.keyPoints)
		? body.keyPoints.map(asText).filter(Boolean).slice(0, 3)
		: [];
	const topic = asText(body.topic);
	const implications = asText(body.implications);
	const success = body.success !== false && Boolean(topic || keyPoints.length || implications);
	if (!success) {
		return {
			success: false,
			videoId: asText(body.videoId) || videoId,
			message: asText(body.message) || '자막이 지원되지 않는 영상입니다.',
		};
	}
	return {
		success: true,
		videoId: asText(body.videoId) || videoId,
		topic,
		keyPoints,
		implications,
		model: asText(body.model) || 'gpt-4o-mini',
		lang: asText(body.lang) || undefined,
	};
}

function decodeCommentText(value: unknown): string {
	return asText(value)
		.replace(/<[^>]+>/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

export function normalizeYoutubeComment(value: unknown, index = 0): InsightsYoutubeComment | null {
	if (!value || typeof value !== 'object') return null;
	const row = value as Record<string, unknown>;
	const snippetRoot = row.snippet && typeof row.snippet === 'object' ? (row.snippet as Record<string, unknown>) : row;
	const top = snippetRoot.topLevelComment && typeof snippetRoot.topLevelComment === 'object'
		? (snippetRoot.topLevelComment as Record<string, unknown>)
		: snippetRoot;
	const snippet = top.snippet && typeof top.snippet === 'object' ? (top.snippet as Record<string, unknown>) : top;
	const text = decodeCommentText(snippet.textOriginal) || decodeCommentText(snippet.textDisplay) || decodeCommentText(row.text);
	const authorName = asText(snippet.authorDisplayName) || asText(row.authorName) || 'YouTube 사용자';
	if (!text) return null;
	const likeCount = Number(snippet.likeCount ?? row.likeCount ?? 0);
	const publishedAt = asText(snippet.publishedAt) || asText(row.publishedAt);
	return {
		id: asText(top.id) || asText(row.id) || `comment_${index}`,
		authorName,
		authorImageUrl: asText(snippet.authorProfileImageUrl) || asText(row.authorImageUrl),
		text,
		likeCount: Number.isFinite(likeCount) && likeCount > 0 ? likeCount : 0,
		publishedAt,
		publishedLabel: asText(row.publishedLabel) || formatYoutubePublishedAt(publishedAt),
	};
}

export function normalizeYoutubeCommentsResult(raw: unknown, videoId = ''): InsightsYoutubeCommentsResult {
	const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const items = Array.isArray(body.comments) ? body.comments : Array.isArray(body.items) ? body.items : [];
	const comments = items
		.map((item, index) => normalizeYoutubeComment(item, index))
		.filter((item): item is InsightsYoutubeComment => Boolean(item))
		.slice(0, YOUTUBE_COMMENTS_PAGE_SIZE);
	const success = body.success !== false && comments.length > 0;
	const nextPageToken = asText(body.nextPageToken) || undefined;
	return {
		success,
		videoId: asText(body.videoId) || videoId,
		comments,
		nextPageToken,
		message: asText(body.message) || undefined,
	};
}

export function mergeYoutubeComments(
	current: InsightsYoutubeComment[],
	incoming: InsightsYoutubeComment[],
	max = YOUTUBE_COMMENTS_MAX,
): InsightsYoutubeComment[] {
	const seen = new Set(current.map((item) => item.id));
	const next = [...current];
	for (const item of incoming) {
		if (seen.has(item.id) || next.length >= max) continue;
		seen.add(item.id);
		next.push(item);
	}
	return next;
}

export function canLoadMoreYoutubeComments(
	count: number,
	nextPageToken?: string | null,
	max = YOUTUBE_COMMENTS_MAX,
): boolean {
	return count < max && Boolean(nextPageToken);
}
