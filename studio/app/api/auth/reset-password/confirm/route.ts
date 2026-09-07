import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { normalizeEmail, resetIdentifier, validatePasswordStrength } from '@/lib/auth-account';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/** POST /api/auth/reset-password/confirm — apply a new password with a valid token. */
export async function POST(request: Request) {
	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
	}

	const email = normalizeEmail(String(body.email ?? ''));
	const token = String(body.token ?? '').trim();
	const password = String(body.password ?? '');
	if (!email || !token) {
		return NextResponse.json({ error: '재설정 링크가 올바르지 않습니다.' }, { status: 400 });
	}

	const passwordError = validatePasswordStrength(password);
	if (passwordError) {
		return NextResponse.json({ error: passwordError }, { status: 400 });
	}

	const identifier = resetIdentifier(email);
	const record = await prisma.verificationToken.findUnique({
		where: { token: hashToken(token) },
	});
	if (!record || record.identifier !== identifier || record.expires.getTime() < Date.now()) {
		return NextResponse.json(
			{ error: '재설정 링크가 만료되었거나 올바르지 않습니다. 다시 요청해 주세요.' },
			{ status: 400 },
		);
	}

	const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
	if (!user) {
		return NextResponse.json({ error: '가입된 이메일이 아닙니다.' }, { status: 404 });
	}

	await prisma.$transaction([
		prisma.user.update({
			where: { id: user.id },
			data: { passwordHash: await bcrypt.hash(password, 10) },
		}),
		prisma.verificationToken.deleteMany({ where: { identifier } }),
	]);

	return NextResponse.json({ ok: true });
}
