import type { LiveFailureKind } from '@/types/live-engine-check';

/**
 * Provider error classification for live checks.
 *
 * The HTTP status alone is not enough. Perplexity returns HTTP 401 with
 * `type: "insufficient_quota"` when credits run out, Gemini returns HTTP 402 with
 * `status: "RESOURCE_EXHAUSTED"`, and OpenAI returns HTTP 429 for both a rate limit
 * and an exhausted quota. So the provider's error type, code, and message decide first.
 */

export interface ProviderErrorInfo {
	httpStatus: number;
	/** Provider error `type` (OpenAI, Anthropic, Perplexity). */
	type?: string;
	/** Provider error `code` (string or number). */
	code?: string;
	/** Google-style `status` such as RESOURCE_EXHAUSTED. */
	providerStatus?: string;
	message: string;
}

export interface LiveFailureDetail {
	kind: LiveFailureKind;
	httpStatus?: number;
	providerCode?: string;
	requestId?: string;
}

const HARD_BILLING =
	/insufficient[_ ]?quota|credit balance|credits?\b.{0,24}(depleted|exhausted|too low|insufficient|run out)|prepay|add credits|out of credits|insufficient (funds|balance)|payment required|billing (is )?(not|disabled)|requires? (a )?(paid|billing)/i;
const TEMPORARY_LIMIT = /per (minute|second)|retry in|retrydelay|try again (in|later)|too many requests|rate[ _-]?limit|requests? per/i;
const SOFT_QUOTA = /quota|billing|payment/i;
const AUTH_HINT = /api[ _-]?key|unauthori[sz]ed|invalid x-api-key|authentication|permission[ _]denied|forbidden|invalid[_ ]token/i;
const MODEL_HINT = /not[_ ]found|no longer available|does not exist|invalid model|unsupported model|model.{0,40}(deprecated|retired|unavailable)/i;

function asText(value: unknown): string | undefined {
	if (typeof value === 'string' && value.trim()) return value.trim();
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	return undefined;
}

/** Removes anything that looks like a credential before it is logged or shown. */
export function scrubSecrets(text: string): string {
	return text
		.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[redacted]')
		.replace(/\bsk-[A-Za-z0-9_-]{16,}/g, '[redacted]')
		.replace(/\bpplx-[A-Za-z0-9]{16,}/g, '[redacted]')
		.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
		.replace(/([?&](?:key|api_key|apikey)=)[^&\s]+/gi, '$1[redacted]');
}

/** Reads the provider's own error fields out of a response body. */
export function extractProviderError(httpStatus: number, data: unknown, fallbackMessage: string): ProviderErrorInfo {
	const root = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
	const err = root.error && typeof root.error === 'object' ? (root.error as Record<string, unknown>) : {};
	const message = asText(err.message) ?? asText(root.message) ?? (typeof root.error === 'string' ? root.error.trim() : '');
	return {
		httpStatus,
		type: asText(err.type) ?? asText(root.type),
		code: asText(err.code),
		providerStatus: asText(err.status),
		message: scrubSecrets(message || fallbackMessage),
	};
}

export function classifyProviderError(info: ProviderErrorInfo): LiveFailureKind {
	const hay = `${info.type ?? ''} ${info.code ?? ''} ${info.providerStatus ?? ''} ${info.message}`;

	if (info.httpStatus === 402 || HARD_BILLING.test(hay)) return 'billing';

	const rateLimited = info.httpStatus === 429 || info.httpStatus === 529 || /rate_limit|overloaded/i.test(`${info.type ?? ''} ${info.code ?? ''}`);
	if (rateLimited && (TEMPORARY_LIMIT.test(hay) || !SOFT_QUOTA.test(hay))) return 'rate_limit';
	if (SOFT_QUOTA.test(hay) && (rateLimited || /resource_exhausted/i.test(info.providerStatus ?? ''))) return 'billing';

	if (
		info.httpStatus === 401 ||
		info.httpStatus === 403 ||
		/unauthenticated|permission_denied/i.test(info.providerStatus ?? '') ||
		/authentication|permission|invalid_api_key/i.test(info.type ?? '') ||
		(info.httpStatus === 400 && AUTH_HINT.test(info.message))
	) {
		return 'auth';
	}

	if (info.httpStatus === 404 || MODEL_HINT.test(hay)) return 'model_unavailable';
	if (info.httpStatus === 400 || info.httpStatus === 422 || /invalid_argument|invalid_request/i.test(hay)) return 'bad_request';
	if (info.httpStatus >= 500) return 'provider_error';
	return 'unknown';
}

/** Kinds that apply to every model, so trying another model only burns the time budget. */
export function stopsModelFallback(kind: LiveFailureKind): boolean {
	return kind === 'billing' || kind === 'auth' || kind === 'rate_limit' || kind === 'missing_key';
}

const KIND_MESSAGE_KO: Record<LiveFailureKind, string> = {
	missing_key: 'API 키가 설정되지 않았습니다.',
	auth: 'API 키가 거부되었거나 권한이 없습니다. 키 값과 권한을 확인하세요.',
	billing: 'API 크레딧 또는 계정 사용 한도가 소진되었습니다. 결제·크레딧 설정을 확인하세요.',
	rate_limit: '일시적인 호출 한도를 초과했습니다. 잠시 후 다시 시도하세요.',
	model_unavailable: '요청한 모델을 사용할 수 없습니다. 모델명 지원 종료 여부를 확인하세요.',
	bad_request: 'API 요청 형식이 거부되었습니다.',
	timeout: '응답 시간이 초과되었습니다.',
	network: '네트워크 오류로 API에 연결하지 못했습니다.',
	empty_body: 'AI 응답 본문을 확인하지 못했습니다.',
	parse_error: 'AI 응답 형식을 해석하지 못했습니다.',
	provider_error: 'AI 제공사 서버 오류가 발생했습니다.',
	unknown: 'AI 호출이 실패했습니다.',
};

/** Short Korean explanation with the provider's own message appended for traceability. */
export function describeFailure(engineLabel: string, kind: LiveFailureKind, providerMessage?: string): string {
	const base = `${engineLabel}: ${KIND_MESSAGE_KO[kind]}`;
	const tail = providerMessage ? scrubSecrets(providerMessage).replace(/\s+/g, ' ').slice(0, 180) : '';
	return tail ? `${base} (${tail})` : base;
}
