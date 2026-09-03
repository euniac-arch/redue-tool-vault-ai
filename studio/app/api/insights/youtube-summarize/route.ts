import { summarizeYoutubeVideo } from '@/lib/insights/insights-youtube-engine';
import {
	createInsightsRequestId,
	insightsNoStoreJson,
	insightsPublicError,
	logInsightsFailure,
} from '@/lib/insights/insights-api-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function asText(value: unknown): string {
	return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export async function POST(request: Request) {
	const requestId = createInsightsRequestId();
	let body: Record<string, unknown> = {};
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return insightsNoStoreJson({ error: '영상 정보를 전달해 주세요.', code: 'bad_request' }, 400, requestId);
	}

	const videoId = asText(body.videoId);
	const title = asText(body.title);
	if (!videoId || !title) {
		return insightsNoStoreJson({ error: 'videoId와 title이 필요합니다.', code: 'bad_request' }, 400, requestId);
	}

	try {
		const result = await summarizeYoutubeVideo({
			videoId,
			title,
			description: asText(body.description),
			channelTitle: asText(body.channelTitle) || 'YouTube',
		});
		return insightsNoStoreJson(result, 200, requestId);
	} catch (error) {
		logInsightsFailure('insights/youtube-summarize', error, { requestId, videoId });
		return insightsNoStoreJson({ error: insightsPublicError('summarize'), code: 'provider_failed' }, 502, requestId);
	}
}
