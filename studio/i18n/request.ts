import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { getIntlMessageFallback, onIntlError } from './intl-error-handling';
import { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES, type SupportedLocale } from './locales';

export { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES, type SupportedLocale } from './locales';

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
		onError: onIntlError,
		// Guards server-rendered translations (getTranslations/generateMetadata,
		// etc.) against leaking raw `namespace.key` strings when a message is
		// missing — see components/IntlErrorHandlingProvider.tsx for the
		// client-side equivalent.
		getMessageFallback: getIntlMessageFallback,
	};
});
