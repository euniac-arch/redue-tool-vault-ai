import {
	YoutubeTranscript,
	YoutubeTranscriptNotAvailableLanguageError,
} from 'youtube-transcript';
import { extractJsonObjectFromText } from './insights-ai-research';
import {
	normalizeYoutubeTranscriptSummary,
	type InsightsYoutubeTranscriptSummary,
} from './insights-youtube';

export const YOUTUBE_TRANSCRIPT_MAX_CHARS = 3_500;
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const OPENAI_TIMEOUT_MS = 25_000;

export type YoutubeTranscriptSummary = InsightsYoutubeTranscriptSummary;

function asText(value: unknown): string {
	return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function envString(name: string): string {
	return (process.env[name] || '').trim().replace(/^["']|["']$/g, '');
}

export function sliceTranscriptText(text: string, maxChars = YOUTUBE_TRANSCRIPT_MAX_CHARS): string {
	const next = text.replace(/\s+/g, ' ').trim();
	if (next.length <= maxChars) return next;
	return `${next.slice(0, maxChars).trim()}…`;
}

export function joinTranscriptSegments(segments: Array<{ text?: string }>): string {
	return sliceTranscriptText(segments.map((item) => asText(item.text)).filter(Boolean).join(' '));
}

export async function fetchYoutubeTranscriptText(videoId: string): Promise<{ text: string; lang: string }> {
	try {
		const ko = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ko' });
		const text = joinTranscriptSegments(ko);
		if (text) return { text, lang: 'ko' };
	} catch (error) {
		if (!(error instanceof YoutubeTranscriptNotAvailableLanguageError)) {
			throw error;
		}
	}

	const fallback = await YoutubeTranscript.fetchTranscript(videoId);
	const text = joinTranscriptSegments(fallback);
	if (!text) throw new Error('empty_transcript');
	return { text, lang: fallback[0]?.lang || 'auto' };
}

export function normalizeTranscriptSummary(raw: unknown, videoId = ''): YoutubeTranscriptSummary {
	return normalizeYoutubeTranscriptSummary(raw, videoId);
}

export async function summarizeYoutubeTranscript(input: {
	videoId: string;
	title?: string;
	transcript: string;
	lang?: string;
}): Promise<YoutubeTranscriptSummary> {
	const apiKey = envString('OPENAI_API_KEY');
	if (!apiKey) {
		return {
			success: false,
			videoId: input.videoId,
			message: 'AI Provider 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.',
		};
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
						content: [
							'너는 AI SEO & GEO 전문 분석가다.',
							'제공된 유튜브 자막만 근거로 요약하고, 없는 사실을 만들지 마라.',
							'JSON 키: topic(string 1줄), keyPoints(string[3]), implications(string 1줄, AI SEO/실무 적용 시사점).',
						].join(' '),
					},
					{
						role: 'user',
						content: JSON.stringify({
							title: input.title || '',
							lang: input.lang || '',
							transcript: input.transcript,
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
		return {
			...normalizeTranscriptSummary(extractJsonObjectFromText(content), input.videoId),
			model: MODEL,
			lang: input.lang,
		};
	} finally {
		clearTimeout(timer);
	}
}

export function transcriptUnavailableResponse(videoId = ''): YoutubeTranscriptSummary {
	return {
		success: false,
		videoId,
		message: '자막이 지원되지 않는 영상입니다.',
	};
}
