import { IntlErrorCode, type IntlError } from 'next-intl';

/**
 * Generic copy shown instead of a raw, dot-separated translation key
 * (e.g. `audit.pageSpeed.guides.duplicateJquery.title`) whenever a message is
 * missing from `messages/*.json`. Never leak the key path to the UI.
 */
const MISSING_MESSAGE_FALLBACK = '번역 텍스트가 아직 준비되지 않았습니다.';
const FORMAT_ERROR_FALLBACK = '텍스트를 표시하는 중 오류가 발생했습니다.';

/**
 * Shared next-intl error-handling config. Plain, side-effect-free functions
 * so this module can be imported from both the server request config
 * (`i18n/request.ts`) and the client provider wrapper
 * (`components/IntlErrorHandlingProvider.tsx`) — `onError`/`getMessageFallback`
 * are functions and therefore aren't auto-inherited across the RSC boundary.
 */
export function onIntlError(error: IntlError) {
	if (error.code === IntlErrorCode.MISSING_MESSAGE) {
		console.error('[i18n] missing message:', error.message);
	} else {
		console.error('[i18n]', error);
	}
}

export function getIntlMessageFallback({ error }: { namespace?: string; key: string; error: IntlError }) {
	return error.code === IntlErrorCode.MISSING_MESSAGE ? MISSING_MESSAGE_FALLBACK : FORMAT_ERROR_FALLBACK;
}
