/**
 * Client-safe Insights API errors. Never return raw Error.message,
 * env var names, secrets, stack traces, or internal paths to the browser.
 */
import { NextResponse } from 'next/server';
import { redactAsiSecrets } from '@/lib/ai-search-intelligence/api/log';

export type InsightsPublicErrorKind =
	| 'research'
	| 'youtube'
	| 'summarize'
	| 'comments'
	| 'news'
	| 'llm_unavailable'
	| 'youtube_unavailable';

const PUBLIC_KO: Record<InsightsPublicErrorKind, string> = {
	research: 'AI Provider 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.',
	youtube: '영상 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
	summarize: 'AI Provider 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.',
	comments: '댓글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
	news: '뉴스 피드를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
	llm_unavailable: 'AI Provider 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.',
	youtube_unavailable: '영상 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
};

const FORBIDDEN_LOG_KEY = /key|secret|token|authorization|password|credential|cookie|api[_-]?key/i;
const ENV_NAME =
	/\b(OPENAI_API_KEY|ANTHROPIC_API_KEY|YOUTUBE_API_KEY|GEMINI_API_KEY|PERPLEXITY_API_KEY|NAVER_CLIENT_SECRET|NAVER_CLIENT_ID|NEXTAUTH_SECRET|NEXT_PUBLIC_NAVER_CLIENT_SECRET|NEXT_PUBLIC_NAVER_CLIENT_ID)\b/g;

export function insightsPublicError(kind: InsightsPublicErrorKind): string {
	return PUBLIC_KO[kind];
}

export function createInsightsRequestId(): string {
	const rand = Math.random().toString(36).slice(2, 10);
	return `ins_${Date.now().toString(36)}_${rand}`;
}

export function redactInsightsLogText(value: string): string {
	return redactAsiSecrets(value)
		.replace(ENV_NAME, '[env]')
		.replace(/\bCookie:\s*\S+/gi, 'Cookie: [redacted]')
		.replace(/\bAuthorization:\s*\S+/gi, 'Authorization: [redacted]');
}

function sanitizeLogValue(key: string, value: unknown): unknown {
	if (FORBIDDEN_LOG_KEY.test(key)) return '[redacted]';
	if (typeof value === 'string') return redactInsightsLogText(value);
	if (Array.isArray(value)) return value.map((item) => sanitizeLogValue('', item));
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([child, item]) => [child, sanitizeLogValue(child, item)]),
		);
	}
	return value;
}

export function logInsightsFailure(scope: string, error: unknown, extra?: Record<string, unknown>): string {
	const requestId =
		typeof extra?.requestId === 'string' && extra.requestId.startsWith('ins_')
			? extra.requestId
			: createInsightsRequestId();
	const raw = error instanceof Error ? error.message : String(error || 'unknown');
	const safeExtra = Object.fromEntries(
		Object.entries(extra || {})
			.filter(([key]) => key !== 'requestId')
			.map(([key, value]) => [key, sanitizeLogValue(key, value)]),
	);
	console.error(`[${scope}] ${requestId}`, {
		...safeExtra,
		requestId,
		message: redactInsightsLogText(raw),
	});
	return requestId;
}

export function insightsNoStoreJson(body: unknown, status = 200, requestId?: string) {
	const id = requestId || createInsightsRequestId();
	return NextResponse.json(body, {
		status,
		headers: {
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
			'x-insights-request-id': id,
		},
	});
}
