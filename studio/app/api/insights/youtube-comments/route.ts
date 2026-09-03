import { fetchYoutubeComments, readYoutubeApiKey } from '@/lib/insights/insights-youtube-engine';
import {
	createInsightsRequestId,
	insightsNoStoreJson,
	insightsPublicError,
	logInsightsFailure,
} from '@/lib/insights/insights-api-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function asText(value: unknown): string {
	return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function emptyResult(requestId: string, videoId = '', message?: string) {
	return insightsNoStoreJson(
		{ success: false, videoId, comments: [], nextPageToken: undefined, message },
		200,
		requestId,
	);
}

async function run(videoId: string, pageToken = '') {
	const requestId = createInsightsRequestId();
	if (!videoId) return emptyResult(requestId, '', 'videoId가 필요합니다.');
	const apiKey = readYoutubeApiKey();
	if (!apiKey) {
		logInsightsFailure('insights/youtube-comments', new Error('provider_unavailable'), { requestId, stage: 'key' });
		return emptyResult(requestId, videoId, insightsPublicError('youtube_unavailable'));
	}

	try {
		const result = await fetchYoutubeComments(videoId, apiKey, pageToken);
		return insightsNoStoreJson(result, 200, requestId);
	} catch (error) {
		logInsightsFailure('insights/youtube-comments', error, { requestId, videoId });
		return emptyResult(requestId, videoId, insightsPublicError('comments'));
	}
}

export async function GET(request: Request) {
	const search = new URL(request.url).searchParams;
	return run(asText(search.get('videoId')), asText(search.get('pageToken')));
}

export async function POST(request: Request) {
	const requestId = createInsightsRequestId();
	try {
		const body = (await request.json()) as { videoId?: unknown; pageToken?: unknown };
		return run(asText(body.videoId), asText(body.pageToken));
	} catch {
		return emptyResult(requestId);
	}
}
