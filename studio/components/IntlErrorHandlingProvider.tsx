'use client';

import { NextIntlClientProvider, useLocale, useMessages, useNow, useTimeZone } from 'next-intl';
import { getIntlMessageFallback, onIntlError } from '@/i18n/intl-error-handling';

/**
 * `onError`/`getMessageFallback` are functions, so next-intl can't pass them
 * from the server request config across the RSC boundary automatically.
 * This client-only wrapper adds the missing error-handling callbacks so
 * `useTranslations(...)` in client components (e.g. PageSpeedSolutionGuide)
 * never renders a raw `a.b.c` key when a translation is missing.
 *
 * Unlike the outer `NextIntlClientProvider` in `app/layout.tsx` (which is
 * rendered server-side and can infer `locale`/`messages`/etc. from the
 * request config), this one runs purely on the client and does NOT
 * auto-inherit those props from its parent — so they must be re-read via
 * hooks and forwarded explicitly, or `NextIntlClientProvider` throws
 * "Couldn't infer the `locale` prop".
 */
export function IntlErrorHandlingProvider({ children }: { children: React.ReactNode }) {
	const locale = useLocale();
	const messages = useMessages();
	const timeZone = useTimeZone();
	const now = useNow();

	return (
		<NextIntlClientProvider
			locale={locale}
			messages={messages}
			timeZone={timeZone}
			now={now}
			onError={onIntlError}
			getMessageFallback={getIntlMessageFallback}
		>
			{children}
		</NextIntlClientProvider>
	);
}
