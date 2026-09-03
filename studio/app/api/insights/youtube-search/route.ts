import { readYoutubeApiKey, searchYoutubeVideos } from '@/lib/insights/insights-youtube-engine';
import { YOUTUBE_SEARCH_MAX } from '@/lib/insights/insights-youtube';
import {
	createInsightsRequestId,
	insightsNoStoreJson,
	insightsPublicError,
	logInsightsFailure,
} from '@/lib/insights/insights-api-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readQuery(value: unknown): string {
	return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

async function runSearch(query: string, channelId = '', playlistId = '') {
	const requestId = createInsightsRequestId();
	if (query.length < 2) {
		return insightsNoStoreJson({ error: '검색어를 2자 이상 입력해 주세요.', code: 'bad_request' }, 400, requestId);
	}
	if (query.length > 200) {
		return insightsNoStoreJson({ error: '검색어는 200자 이하여야 합니다.', code: 'bad_request' }, 400, requestId);
	}

	const apiKey = readYoutubeApiKey();
	if (!apiKey) {
		logInsightsFailure('insights/youtube-search', new Error('provider_unavailable'), { requestId, stage: 'key' });
		return insightsNoStoreJson({ error: insightsPublicError('youtube_unavailable'), code: 'unavailable' }, 503, requestId);
	}

	try {
		const result = await searchYoutubeVideos(query, apiKey, { channelId, playlistId });
		return insightsNoStoreJson(
			{
				...result,
				videos: result.videos,
				maxResults: YOUTUBE_SEARCH_MAX,
			},
			200,
			requestId,
		);
	} catch (error) {
		logInsightsFailure('insights/youtube-search', error, { requestId });
		return insightsNoStoreJson({ error: insightsPublicError('youtube'), code: 'provider_failed' }, 502, requestId);
	}
}

export async function GET(request: Request) {
	const search = new URL(request.url).searchParams;
	return runSearch(readQuery(search.get('q')), readQuery(search.get('channelId')), readQuery(search.get('playlistId')));
}

export async function POST(request: Request) {
	const requestId = createInsightsRequestId();
	try {
		const body = (await request.json()) as { query?: unknown; channelId?: unknown; playlistId?: unknown };
		return runSearch(readQuery(body.query), readQuery(body.channelId), readQuery(body.playlistId));
	} catch {
		return insightsNoStoreJson({ error: '검색어를 전달해 주세요.', code: 'bad_request' }, 400, requestId);
	}
}
