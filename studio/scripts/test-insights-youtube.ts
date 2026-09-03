/**
 * Run: npx tsx scripts/test-insights-youtube.ts
 */
import {
	formatYoutubeDuration,
	formatYoutubeViewCount,
	canLoadMoreYoutubeComments,
	mergeYoutubeComments,
	normalizeYoutubeCommentsResult,
	normalizeYoutubeSummary,
	normalizeYoutubeTranscriptSummary,
	normalizeYoutubeSearchResult,
	normalizeYoutubeVideo,
	parseYoutubeCollectionTarget,
	YOUTUBE_SEARCH_MAX,
	YOUTUBE_VIDEOS_CACHE_VERSION,
	YOUTUBE_VISIBLE_PAGE_SIZE,
	isUsableYoutubeVideoCache,
	uploadsPlaylistIdFromChannel,
	youtubeWatchUrl,
} from '../lib/insights/insights-youtube';
import { joinTranscriptSegments, sliceTranscriptText } from '../lib/insights/insights-youtube-transcript';
import { isVideoScrapped, parseScrappedVideo } from '../lib/insights/scrapped-videos';
import {
	isItemSaved,
	newsToSavedItem,
	parseSavedItem,
	savedItemToNewsItem,
	savedItemToYoutubeVideo,
	youtubeToSavedItem,
} from '../lib/insights/saved-items';
import {
	parseVideoSummaryCache,
	parseVideoSummaryEntry,
	YOUTUBE_SUMMARY_CACHE_KEY,
} from '../lib/insights/youtube-summary-cache';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${JSON.stringify(detail)}` : ''}`);
}

assert('watch url', youtubeWatchUrl('dQw4w9WgXcQ') === 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
assert('duration mm:ss', formatYoutubeDuration('PT3M12S') === '3:12');
assert('duration hh:mm:ss', formatYoutubeDuration('PT1H2M3S') === '1:02:03');
assert('views 만회', formatYoutubeViewCount(123456) === '12만회');
assert('views 소수 만회', formatYoutubeViewCount(15000) === '1.5만회');
assert('views 회', formatYoutubeViewCount(980) === '980회');

const video = normalizeYoutubeVideo({
	id: 'abc123xyz00',
	title: 'GEO 최적화 강의',
	description: '생성형 검색 대응',
	channelTitle: 'REDUE',
	publishedAt: '2026-08-01T00:00:00.000Z',
	thumbnailUrl: 'https://i.ytimg.com/vi/abc123xyz00/hqdefault.jpg',
	viewCount: 15000,
	duration: 'PT8M5S',
});
assert('normalizes video id', video?.videoId === 'abc123xyz00' && video.videoUrl.includes('abc123xyz00'));
assert('normalizes duration label', video?.durationLabel === '8:05');
assert('drops empty video', normalizeYoutubeVideo({ title: 'x' }) === null);

const newestFirst = normalizeYoutubeSearchResult({
	query: 'GEO',
	videos: [
		{ ...video, videoId: 'old', id: 'old', publishedAt: '2024-01-01T00:00:00.000Z' },
		{ ...video, videoId: 'new', id: 'new', publishedAt: '2026-08-01T00:00:00.000Z' },
	],
});
assert('search newest first', newestFirst.videos[0]?.videoId === 'new' && newestFirst.videos[1]?.videoId === 'old');
assert('uploads playlist from channel', uploadsPlaylistIdFromChannel('UCabcdefghijklmnopqrstuv') === 'UUabcdefghijklmnopqrstuv');
assert('parses channel url', parseYoutubeCollectionTarget({ query: 'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv' }).kind === 'playlist');
assert('parses handle', parseYoutubeCollectionTarget({ query: '@GoogleSearchCentral' }).kind === 'handle');
assert('parses keyword search', parseYoutubeCollectionTarget({ query: 'GEO 최적화' }).kind === 'search');
const fifty = normalizeYoutubeSearchResult({
	query: 'GEO',
	videos: Array.from({ length: 50 }, (_, index) => ({
		...video,
		id: `id${index}`,
		videoId: `id${String(index).padStart(2, '0')}xxxxxxx`.slice(0, 11),
		publishedAt: `2026-08-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
	})),
});
assert('keeps up to 50 videos', fifty.videos.length === 50);
assert('search max is 50', YOUTUBE_SEARCH_MAX === 50);
assert('default youtube page size is 12', YOUTUBE_VISIBLE_PAGE_SIZE === 12);
assert('cache version is 3', YOUTUBE_VIDEOS_CACHE_VERSION === 3);
assert('accepts versioned cache', isUsableYoutubeVideoCache(3, 50));
assert('rejects old 8-item cache version', !isUsableYoutubeVideoCache(2, 8) && !isUsableYoutubeVideoCache(1, 50));
assert('rejects empty cache', !isUsableYoutubeVideoCache(3, 0));

const summary = normalizeYoutubeSummary({ bullets: ['핵심 1', '', '핵심 2', '핵심 3', 'extra'] }, 'abc');
assert('keeps 3 bullets', summary.bullets.join('|') === '핵심 1|핵심 2|핵심 3');

const sliced = sliceTranscriptText('가'.repeat(4_200));
assert('slices transcript length', sliced.length <= 3_501 && sliced.endsWith('…'));
assert('joins segments', joinTranscriptSegments([{ text: '첫 문장' }, { text: '둘째 문장' }]) === '첫 문장 둘째 문장');

const transcriptOk = normalizeYoutubeTranscriptSummary(
	{
		success: true,
		topic: 'GEO 검색 최적화',
		keyPoints: ['엔티티 강화', '', '인용 가능한 근거', '내부링크', 'extra'],
		implications: 'FAQ와 스키마를 먼저 맞춰라',
	},
	'abc',
);
assert('transcript topic', transcriptOk.success && transcriptOk.topic === 'GEO 검색 최적화');
assert('transcript 3 points', (transcriptOk.keyPoints || []).join('|') === '엔티티 강화|인용 가능한 근거|내부링크');
assert('transcript implications', transcriptOk.implications === 'FAQ와 스키마를 먼저 맞춰라');

const transcriptFail = normalizeYoutubeTranscriptSummary({ success: false }, 'xyz');
assert('transcript fail message', transcriptFail.success === false && transcriptFail.message?.includes('자막'));

const comments = normalizeYoutubeCommentsResult(
	{
		success: true,
		items: [
			{
				id: 'c1',
				snippet: {
					topLevelComment: {
						id: 'c1',
						snippet: {
							authorDisplayName: 'GEO러',
							authorProfileImageUrl: 'https://example.com/a.jpg',
							textOriginal: '핵심이 잘 정리됨',
							likeCount: 12,
							publishedAt: '2026-08-01T00:00:00.000Z',
						},
					},
				},
			},
		],
	},
	'abc',
);
assert('comment author', comments.success && comments.comments[0]?.authorName === 'GEO러');
assert('comment likes', comments.comments[0]?.likeCount === 12);
assert('empty comments fail-safe', normalizeYoutubeCommentsResult({ success: false }).comments.length === 0);
assert('keeps next page token', normalizeYoutubeCommentsResult({ comments: comments.comments, nextPageToken: 'abc' }).nextPageToken === 'abc');
const merged = mergeYoutubeComments(comments.comments, [
	comments.comments[0]!,
	{ ...comments.comments[0]!, id: 'c2', text: '두번째' },
]);
assert('dedupes comment ids', merged.length === 2);
assert('stops at 100', !canLoadMoreYoutubeComments(100, 'next'));
assert('loads more under 100', canLoadMoreYoutubeComments(80, 'next'));
assert('stops without token', !canLoadMoreYoutubeComments(40, ''));

assert('cache key', YOUTUBE_SUMMARY_CACHE_KEY === 'redue_youtube_summary_cache');
const cached = parseVideoSummaryEntry({
	topic: '주제',
	keyPoints: ['a', 'b', 'c', 'd'],
	implications: '시사점',
	summarizedAt: 1_700_000_000_000,
});
assert('cache entry keeps 3 points', Boolean(cached && cached.keyPoints.join('|') === 'a|b|c'));
assert('drops empty cache entry', parseVideoSummaryEntry({ topic: '' }) === null);
const cacheMap = parseVideoSummaryCache({
	abc: cached,
	bad: { topic: '' },
	'': cached,
});
assert('cache map keeps valid id', Boolean(cacheMap.abc?.topic === '주제') && !cacheMap.bad);

const scrap = parseScrappedVideo({ ...video, queryKeyword: 'GEO' });
assert('scrap keeps channel', scrap?.channelTitle === 'REDUE');
assert('scrap match', isVideoScrapped('abc123xyz00', scrap ? [scrap] : []));

const savedVideo = youtubeToSavedItem(video!);
assert('youtube bookmark type', savedVideo.type === 'youtube' && savedVideo.id === 'abc123xyz00');
assert('youtube bookmark roundtrip', savedItemToYoutubeVideo(savedVideo).videoId === 'abc123xyz00');
assert('parses saved item', parseSavedItem({ ...savedVideo, type: 'youtube' })?.title === video?.title);
assert(
	'detects saved video',
	isItemSaved('abc123xyz00', 'youtube', [savedVideo]) && !isItemSaved('abc123xyz00', 'news', [savedVideo]),
);
const savedNews = newsToSavedItem({
	id: 'n1',
	title: 'GEO 뉴스',
	summary: '요약',
	sourceName: 'REDUE',
	sourceUrl: 'https://example.com/geo',
	guid: null,
	region: 'KR',
	publishedAt: '1시간 전',
	publishedAtIso: '2026-08-29T00:00:00.000Z',
	category: 'aeo_geo_search',
	categories: ['GEO'],
	tags: ['GEO'],
});
assert('news bookmark type', savedNews.type === 'news' && savedNews.source === 'REDUE');
// Regression: `newsToSavedItem` intentionally keeps the canonical ISO
// timestamp (for durable sort order across long-saved bookmarks), so
// `savedItemToNewsItem` must reformat it into a relative Korean label when
// the "저장된 뉴스" tab renders it back through `InsightsNewsCard` — it must
// never surface the raw "...T....000Z" string to the user.
assert('saved item stores the canonical ISO, not the display label', savedNews.publishedAt === '2026-08-29T00:00:00.000Z');
const restoredNewsCard = savedItemToNewsItem(savedNews);
assert(
	'restored saved-news card does not show the raw ISO timestamp',
	restoredNewsCard.publishedAt !== savedNews.publishedAt && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(restoredNewsCard.publishedAt),
	{ publishedAt: restoredNewsCard.publishedAt },
);
assert(
	'restored saved-news card keeps a machine-readable publishedAtIso',
	restoredNewsCard.publishedAtIso === new Date(savedNews.publishedAt).toISOString(),
);

const savedNewsWithoutDate = { ...savedNews, publishedAt: '' };
const restoredWithoutDate = savedItemToNewsItem(savedNewsWithoutDate);
assert('restored card with no source date does not crash and stays blank', restoredWithoutDate.publishedAt === '');

if (failed > 0) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall assertions passed');
