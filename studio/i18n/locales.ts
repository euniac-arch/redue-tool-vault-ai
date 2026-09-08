export const SUPPORTED_LOCALES = ['ko', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'ko';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isSupportedLocale(value: string | undefined | null): value is SupportedLocale {
	return Boolean(value && SUPPORTED_LOCALES.includes(value as SupportedLocale));
}

export function persistLocaleCookie(locale: SupportedLocale) {
	if (typeof document === 'undefined') return;
	document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}
