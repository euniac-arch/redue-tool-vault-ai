import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

export const SUPPORTED_LOCALES = ['ko', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'ko';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

function normalizeLocale(value: string | undefined): SupportedLocale {
	return SUPPORTED_LOCALES.includes(value as SupportedLocale) ? (value as SupportedLocale) : DEFAULT_LOCALE;
}

/**
 * REDUE runs a single set of routes (no `/en`, `/ko` URL prefixes) — the
 * active locale is stored in a plain cookie and read here on every server
 * render, per next-intl's "without i18n routing" recipe.
 */
export default getRequestConfig(async () => {
	const store = await cookies();
	const locale = normalizeLocale(store.get(LOCALE_COOKIE)?.value);

	return {
		locale,
		messages: (await import(`../messages/${locale}.json`)).default,
	};
});
