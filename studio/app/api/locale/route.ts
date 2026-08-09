import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { LOCALE_COOKIE, SUPPORTED_LOCALES } from '@/i18n/request';

export const runtime = 'nodejs';

interface LocaleBody {
	locale?: string;
}

/** POST /api/locale — the KR|EN switcher writes here, then the caller does a full refresh/reload. */
export async function POST(request: Request) {
	const body = (await request.json().catch(() => ({}))) as LocaleBody;
	if (!body.locale || !SUPPORTED_LOCALES.includes(body.locale as (typeof SUPPORTED_LOCALES)[number])) {
		return NextResponse.json({ error: 'Unsupported locale' }, { status: 400 });
	}

	const store = await cookies();
	store.set(LOCALE_COOKIE, body.locale, { path: '/', maxAge: 60 * 60 * 24 * 365 });

	return NextResponse.json({ ok: true, locale: body.locale });
}
