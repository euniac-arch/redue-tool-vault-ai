import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { validatePasswordStrength } from '@/lib/auth-account';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/** PATCH /api/user/change-password — signed-in member updates their password. */
export async function PATCH(request: Request) {
	const session = await getServerSession(authOptions).catch(() => null);
	const userId = session?.user?.id?.trim() || '';
	const email = session?.user?.email?.trim() || '';
	if (!userId && !email) {
		return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
	}

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
	}

	const currentPassword = String(body.currentPassword ?? '');
	const newPassword = String(body.newPassword ?? '');
	if (!currentPassword || !newPassword) {
		return NextResponse.json({ error: '현재 비밀번호와 새 비밀번호를 입력해 주세요.' }, { status: 400 });
	}
	if (currentPassword === newPassword) {
		return NextResponse.json({ error: '새 비밀번호는 현재 비밀번호와 달라야 합니다.' }, { status: 400 });
	}

	const passwordError = validatePasswordStrength(newPassword);
	if (passwordError) {
		return NextResponse.json({ error: passwordError }, { status: 400 });
	}

	const user = userId
		? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, passwordHash: true } })
		: await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } });

	if (!user) {
		return NextResponse.json({ error: '계정 정보를 찾을 수 없습니다.' }, { status: 404 });
	}
	if (!user.passwordHash) {
		return NextResponse.json(
			{ error: '소셜 로그인 계정은 비밀번호를 변경할 수 없습니다. Google 또는 카카오로 로그인해 주세요.' },
			{ status: 400 },
		);
	}

	const matches = await bcrypt.compare(currentPassword, user.passwordHash);
	if (!matches) {
		return NextResponse.json({ error: '현재 비밀번호가 일치하지 않습니다.' }, { status: 400 });
	}

	await prisma.user.update({
		where: { id: user.id },
		data: { passwordHash: await bcrypt.hash(newPassword, 10) },
	});

	return NextResponse.json({ ok: true, message: '비밀번호가 성공적으로 변경되었습니다.' });
}
