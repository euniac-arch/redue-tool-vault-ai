import { NextResponse } from 'next/server';
import { maskEmail, normalizeName, normalizePhone } from '@/lib/auth-account';
import { findAccountsByNameAndPhone } from '@/lib/server/account-lookup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

/** POST /api/auth/find-account — look up a masked email by name + phone. */
export async function POST(request: Request) {
	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400, headers: NO_STORE });
	}

	const name = normalizeName(String(body.name ?? ''));
	const phone = normalizePhone(String(body.phone ?? body.phoneNumber ?? body.mobile ?? body.tel ?? ''));
	console.log('[find-account] payload', {
		name,
		phone,
		rawKeys: Object.keys(body),
	});

	if (!name || phone.length < 8) {
		return NextResponse.json({ error: '가입 시 등록한 이름과 연락처를 입력해 주세요.' }, { status: 400, headers: NO_STORE });
	}

	const matches = await findAccountsByNameAndPhone(name, phone);
	console.log('[find-account] query result', { matched: matches.length });

	const matched = matches.filter((user) => user.email);
	if (matched.length === 0) {
		return NextResponse.json(
			{ error: '입력하신 정보와 일치하는 계정을 찾을 수 없습니다.' },
			{ status: 404, headers: NO_STORE },
		);
	}

	const emails = matched.map((user) => maskEmail(user.email));
	return NextResponse.json({ email: emails[0], emails }, { headers: NO_STORE });
}
