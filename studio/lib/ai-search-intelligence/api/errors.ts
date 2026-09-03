/**
 * Classified ASI API errors. Codes are stable for the client;
 * messages are user-safe and never include secrets or stack traces.
 */

export const ASI_ERROR_CODES = [
	'invalid_json',
	'invalid_operation',
	'invalid_url',
	'api_key',
	'provider_timeout',
	'rate_limit',
	'invalid_response',
	'network_error',
	'cancelled',
	'unavailable',
	'entitlement',
	'entitlement_quota',
] as const;

export type AsiErrorCode = (typeof ASI_ERROR_CODES)[number];

export class AsiServiceError extends Error {
	readonly code: AsiErrorCode;

	constructor(code: AsiErrorCode, message?: string) {
		super(message || asiSafeErrorMessage(code, 'en'));
		this.name = 'AsiServiceError';
		this.code = code;
	}
}

const SAFE_KO: Record<AsiErrorCode, string> = {
	invalid_json: '요청 형식이 올바르지 않습니다. 다시 시도해 주세요.',
	invalid_operation: '지원하지 않는 분석 요청입니다.',
	invalid_url: '올바른 사이트 URL을 입력해 주세요.',
	api_key: 'AI 분석을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
	provider_timeout: 'AI 분석을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
	rate_limit: '요청이 많아 잠시 대기해야 합니다. 잠시 후 다시 시도해 주세요.',
	invalid_response: 'AI 분석을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
	network_error: 'AI 분석을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
	cancelled: '요청이 취소되었습니다.',
	unavailable: 'AI 분석을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
	entitlement: '이 분석은 다음 단계에서 열 수 있습니다. 가입하거나 PRO에서 이어서 보세요.',
	entitlement_quota: '이번 기간 사용량을 모두 사용했습니다. 가입하거나 다음 달에 이어서 보세요.',
};

const SAFE_EN: Record<AsiErrorCode, string> = {
	invalid_json: 'The request format is invalid. Please try again.',
	invalid_operation: 'This analysis request is not supported.',
	invalid_url: 'Enter a valid site URL.',
	api_key: 'The AI analysis could not be completed. Please try again shortly.',
	provider_timeout: 'The AI analysis could not be completed. Please try again shortly.',
	rate_limit: 'Too many requests right now. Please wait a moment and try again.',
	invalid_response: 'The AI analysis could not be completed. Please try again shortly.',
	network_error: 'The AI analysis could not be completed. Please try again shortly.',
	cancelled: 'The request was cancelled.',
	unavailable: 'The AI analysis could not be completed. Please try again shortly.',
	entitlement: 'This analysis opens in the next step. Sign in or continue with PRO.',
	entitlement_quota: 'This period’s usage is used up. Sign in or continue next month.',
};

export function asiSafeErrorMessage(code: AsiErrorCode, locale: 'ko' | 'en' = 'ko'): string {
	return (locale === 'en' ? SAFE_EN : SAFE_KO)[code];
}

export function isAsiErrorCode(value: string | undefined): value is AsiErrorCode {
	return Boolean(value && (ASI_ERROR_CODES as readonly string[]).includes(value));
}

export function httpStatusForAsiError(code: AsiErrorCode): number {
	switch (code) {
		case 'invalid_json':
		case 'invalid_operation':
			return 400;
		case 'invalid_url':
			return 422;
		case 'entitlement':
		case 'entitlement_quota':
			return 403;
		case 'rate_limit':
			return 429;
		case 'cancelled':
			return 499;
		case 'provider_timeout':
			return 504;
		case 'api_key':
		case 'invalid_response':
			return 502;
		case 'network_error':
		case 'unavailable':
		default:
			return 503;
	}
}

export function classifyHttpStatus(status: number): AsiErrorCode {
	if (status === 401 || status === 403) return 'api_key';
	if (status === 429) return 'rate_limit';
	if (status === 408 || status === 504) return 'provider_timeout';
	if (status >= 400 && status < 500) return 'invalid_response';
	if (status >= 500) return 'unavailable';
	return 'unavailable';
}

export function classifyAsiThrown(error: unknown): AsiServiceError {
	if (error instanceof AsiServiceError) return error;
	const name = error instanceof Error ? error.name : '';
	const raw = error instanceof Error ? error.message : String(error || '');
	const lower = raw.toLowerCase();

	if (name === 'AbortError' || lower.includes('aborted') || lower.includes('timeout') || lower.includes('timed out')) {
		if (lower.includes('cancel')) return new AsiServiceError('cancelled');
		return new AsiServiceError('provider_timeout');
	}
	if (lower.includes('cancelled') || lower.includes('canceled')) {
		return new AsiServiceError('cancelled');
	}
	if (lower.includes('429') || lower.includes('rate limit') || lower.includes('too many requests')) {
		return new AsiServiceError('rate_limit');
	}
	if (
		lower.includes('401') ||
		lower.includes('403') ||
		lower.includes('invalid api key') ||
		lower.includes('incorrect api key') ||
		lower.includes('authentication') ||
		lower.includes('unauthorized')
	) {
		return new AsiServiceError('api_key');
	}
	if (
		lower.includes('404') ||
		lower.includes('not found') ||
		lower.includes('does not exist') ||
		lower.includes('invalid model') ||
		lower.includes('model_not_found')
	) {
		return new AsiServiceError('invalid_response');
	}
	if (
		lower.includes('empty') ||
		lower.includes('invalid json') ||
		lower.includes('unusable') ||
		lower.includes('parse')
	) {
		return new AsiServiceError('invalid_response');
	}
	if (
		name === 'TypeError' ||
		lower.includes('fetch') ||
		lower.includes('network') ||
		lower.includes('econnreset') ||
		lower.includes('enotfound')
	) {
		return new AsiServiceError('network_error');
	}
	return new AsiServiceError('unavailable');
}
