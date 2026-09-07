import { NextResponse } from 'next/server';
import { maskEmail, normalizeName, normalizePhone } from '@/lib/auth-account';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/** POST /api/auth/find-account — look up a masked email by name + phone. */
export async function POST(request: Request) {
	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
	}

	const name = normalizeName(String(body.name ?? ''));
	const phone = normalizePhone(String(body.phone ?? ''));
	if (!name || phone.length < 8) {
		return NextResponse.json({ error: '가입 시 등록한 이름과 연락처를 입력해 주세요.' }, { status: 400 });
	}

	const candidates = await prisma.user.findMany({
		where: { phone },
		select: { email: true, name: true },
	});
	const matched = candidates.find((user) => normalizeName(user.name || '') === name && user.email);

	if (!matched?.email) {
		return NextResponse.json(
			{ error: '입력하신 정보와 일치하는 계정을 찾을 수 없습니다.' },
			{ status: 404 },
		);
	}

	return NextResponse.json({ email: maskEmail(matched.email) });
}
