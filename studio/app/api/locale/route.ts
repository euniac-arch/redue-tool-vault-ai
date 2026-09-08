import { NextResponse } from 'next/server';
import { isSupportedLocale, LOCALE_COOKIE } from '@/i18n/locales';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LocaleBody {
	locale?: string;
}

/** POST /api/locale — persist KO/EN on a Set-Cookie response, then the caller refreshes. */
export async function POST(request: Request) {
	const body = (await request.json().catch(() => ({}))) as LocaleBody;
	if (!isSupportedLocale(body.locale)) {
		return NextResponse.json({ error: 'Unsupported locale' }, { status: 400 });
	}

	const response = NextResponse.json({ ok: true, locale: body.locale });
	response.cookies.set(LOCALE_COOKIE, body.locale, {
		path: '/',
		maxAge: 60 * 60 * 24 * 365,
		sameSite: 'lax',
	});
	return response;
}
