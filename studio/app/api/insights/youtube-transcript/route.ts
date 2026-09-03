import {
	fetchYoutubeTranscriptText,
	summarizeYoutubeTranscript,
	transcriptUnavailableResponse,
} from '@/lib/insights/insights-youtube-transcript';
import {
	createInsightsRequestId,
	insightsNoStoreJson,
	insightsPublicError,
	logInsightsFailure,
} from '@/lib/insights/insights-api-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

function asText(value: unknown): string {
	return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export async function POST(request: Request) {
	const requestId = createInsightsRequestId();
	let videoId = '';
	let title = '';
	try {
		const body = (await request.json()) as { videoId?: unknown; title?: unknown };
		videoId = asText(body.videoId);
		title = asText(body.title);
	} catch {
		return insightsNoStoreJson({ success: false, message: '영상 정보를 전달해 주세요.' }, 200, requestId);
	}

	if (!videoId) {
		return insightsNoStoreJson({ success: false, videoId, message: 'videoId가 필요합니다.' }, 200, requestId);
	}

	let transcript: { text: string; lang: string };
	try {
		transcript = await fetchYoutubeTranscriptText(videoId);
	} catch (error) {
		logInsightsFailure('insights/youtube-transcript', error, { requestId, videoId, stage: 'transcript' });
		return insightsNoStoreJson(transcriptUnavailableResponse(videoId), 200, requestId);
	}

	try {
		const summary = await summarizeYoutubeTranscript({
			videoId,
			title,
			transcript: transcript.text,
			lang: transcript.lang,
		});
		if (!summary.success) {
			return insightsNoStoreJson(
				{ ...summary, message: insightsPublicError('summarize') },
				200,
				requestId,
			);
		}
		return insightsNoStoreJson(summary, 200, requestId);
	} catch (error) {
		logInsightsFailure('insights/youtube-transcript', error, { requestId, videoId, stage: 'summarize' });
		return insightsNoStoreJson(
			{
				success: false,
				videoId,
				message: insightsPublicError('summarize'),
			},
			200,
			requestId,
		);
	}
}
