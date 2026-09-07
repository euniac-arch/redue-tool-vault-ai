import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { RESET_TOKEN_TTL_MS, isValidEmail, normalizeEmail, resetIdentifier } from '@/lib/auth-account';
import { sendPasswordResetMail } from '@/lib/auth-mail';
import { recordSecurityLog } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

function requestOrigin(request: Request): string {
	try {
		return new URL(request.url).origin;
	} catch {
		return '';
	}
}

/** POST /api/auth/reset-password — email a one-time reset link. */
export async function POST(request: Request) {
	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
	}

	const email = normalizeEmail(String(body.email ?? ''));
	if (!isValidEmail(email)) {
		return NextResponse.json({ error: '올바른 이메일을 입력해 주세요.' }, { status: 400 });
	}

	const user = await prisma.user.findUnique({
		where: { email },
		select: { id: true, passwordHash: true },
	});
	if (!user) {
		return NextResponse.json({ error: '가입된 이메일이 아닙니다.' }, { status: 404 });
	}
	if (!user.passwordHash) {
		return NextResponse.json(
			{ error: '소셜 로그인 계정입니다. Google 또는 카카오로 로그인해 주세요.' },
			{ status: 400 },
		);
	}

	const identifier = resetIdentifier(email);
	await prisma.verificationToken.deleteMany({ where: { identifier } });

	const rawToken = randomBytes(32).toString('hex');
	await prisma.verificationToken.create({
		data: {
			identifier,
			token: hashToken(rawToken),
			expires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
		},
	});

	try {
		const sent = await sendPasswordResetMail(email, rawToken, requestOrigin(request));
		if (!sent) {
			return NextResponse.json(
				{ error: '메일 발송 설정이 되어 있지 않습니다. 관리자에게 문의해 주세요.' },
				{ status: 503 },
			);
		}
	} catch (error) {
		console.error('[reset-password] 메일 발송 실패:', error);
		return NextResponse.json({ error: '재설정 메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 });
	}

	recordSecurityLog({
		eventType: 'PASSWORD_RESET',
		userEmail: email,
		userId: user.id,
		status: 'WARNING',
		details: '비밀번호 재설정 메일 발송',
		headers: request.headers,
	});

	return NextResponse.json({ ok: true, message: '비밀번호 재설정 링크가 이메일로 발송되었습니다.' });
}
