/**
 * Kakao Login error mapping + sanitized server logs.
 * Codes: https://developers.kakao.com/docs/latest/ko/kakaologin/trouble-shooting
 */

export const KAKAO_CALLBACK_PATH = '/api/auth/callback/kakao';

const KAKAO_ERROR_HINTS: Record<string, string> = {
	KOE004: '카카오 로그인이 비활성(OFF)입니다. 콘솔에서 카카오 로그인을 ON으로 켜세요.',
	KOE006: '등록되지 않은 Redirect URI입니다. 콘솔 REST API 키의 Redirect URI에 콜백 URL을 그대로 등록하세요.',
	KOE010: 'Client Secret이 없거나 틀립니다. 콘솔에서 Client Secret을 발급하고 상태를 "사용함"으로 두세요.',
	KOE101: '잘못된 앱 키입니다. KAKAO_CLIENT_ID에는 JavaScript 키가 아니라 REST API 키를 넣으세요.',
	KOE201: '지원하지 않는 response_type입니다. NextAuth 기본 authorize 요청을 확인하세요.',
	KOE205: '필수 동의 항목이 누락되었습니다. 카카오 로그인 동의 항목을 확인하세요.',
	KOE303: '인가 요청과 토큰 요청의 redirect_uri가 다릅니다. NEXTAUTH_URL과 콘솔 등록 URL을 맞추세요.',
	KOE320: '인가 코드가 만료·재사용·누락되었습니다. 로그인 버튼을 다시 눌러 새 인가 코드를 받으세요.',
};

const NEXTAUTH_ERROR_HINTS: Record<string, string> = {
	OAuthSignin: '카카오 인가 요청이 거부되었습니다. REST API 키와 Redirect URI(KOE006/KOE101)를 확인하세요.',
	OAuthCallback: '카카오 토큰/프로필 교환에 실패했습니다. Client Secret(KOE010), Redirect URI 일치(KOE303), 인가 코드 재사용(KOE320)을 확인하세요.',
	OAuthCreateAccount: '카카오 계정으로 사용자를 만들지 못했습니다. DB Account/User 제약을 확인하세요.',
	OAuthAccountNotLinked: '같은 이메일이 다른 로그인 방식으로 이미 연결되어 있습니다.',
	AccessDenied: '카카오 동의가 취소되었거나 거부되었습니다.',
	Configuration: '서버 인증 설정 오류입니다. NEXTAUTH_URL / NEXTAUTH_SECRET을 확인하세요.',
	Callback: 'OAuth 콜백 처리에 실패했습니다. 서버 로그의 [auth][kakao] 항목을 확인하세요.',
};

const REDACT_KEYS = new Set([
	'client_secret',
	'clientSecret',
	'access_token',
	'refresh_token',
	'id_token',
	'authorization',
	'code',
]);

export function getKakaoRedirectUri(baseUrl = process.env.NEXTAUTH_URL): string {
	const origin = (baseUrl || 'http://localhost:3000').replace(/\/$/, '');
	return `${origin}${KAKAO_CALLBACK_PATH}`;
}

export function extractKakaoErrorCode(value: unknown): string | null {
	if (!value) return null;
	const text = typeof value === 'string' ? value : safeJson(value);
	const match = text.match(/\bKOE\d{3}\b/i);
	return match ? match[0].toUpperCase() : null;
}

export function describeKakaoErrorCode(code: string | null | undefined): string | null {
	if (!code) return null;
	return KAKAO_ERROR_HINTS[code.toUpperCase()] ?? null;
}

export function describeNextAuthOAuthError(error: string | null | undefined): string | null {
	if (!error) return null;
	const kakaoHint = describeKakaoErrorCode(extractKakaoErrorCode(error));
	if (kakaoHint) return `${error}: ${kakaoHint}`;
	return NEXTAUTH_ERROR_HINTS[error] ?? `인증 오류(${error})`;
}

export function sanitizeAuthMeta(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sanitizeAuthMeta);
	if (!value || typeof value !== 'object') return value;
	if (value instanceof Error) {
		return {
			name: value.name,
			message: value.message,
			kakaoCode: extractKakaoErrorCode(value.message),
		};
	}
	const out: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
		out[key] = REDACT_KEYS.has(key) ? '[redacted]' : sanitizeAuthMeta(entry);
	}
	return out;
}

export function logKakaoAuthEvent(
	level: 'info' | 'warn' | 'error',
	message: string,
	meta?: unknown,
): void {
	const kakaoCode = extractKakaoErrorCode(meta) || extractKakaoErrorCode(message);
	const hint = describeKakaoErrorCode(kakaoCode);
	const payload = {
		kakaoCode,
		hint,
		redirectUri: getKakaoRedirectUri(),
		meta: sanitizeAuthMeta(meta),
	};
	if (level === 'error') console.error(`[auth][kakao] ${message}`, payload);
	else if (level === 'warn') console.warn(`[auth][kakao] ${message}`, payload);
	else console.info(`[auth][kakao] ${message}`, payload);
}

function safeJson(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}
