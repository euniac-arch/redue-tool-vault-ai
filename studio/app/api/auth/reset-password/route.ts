import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { RESET_TOKEN_TTL_MS, isValidEmail, normalizeEmail, normalizeName, phonesMatch, resetIdentifier } from '@/lib/auth-account';
import { PASSWORD_RESET_MAIL_ERROR, sendPasswordResetMail } from '@/lib/auth-mail';
import { recordSecurityLog } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { findAccountByEmail, saveSharedResetToken } from '@/lib/server/account-lookup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

const RESET_NOTICE = '등록된 이메일이면 재설정 안내를 보냈습니다. 받은편지함과 스팸함을 확인해 주세요.';

/** POST /api/auth/reset-password — email a one-time reset link. */
export async function POST(request: Request) {
	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
	}

	const email = normalizeEmail(String(body.email ?? ''));
	const name = normalizeName(String(body.name ?? ''));
	const phone = String(body.phone ?? body.phoneNumber ?? body.mobile ?? '').replace(/\D/g, '');
	console.log('[reset-password] payload', {
		email,
		name,
		phone,
		rawKeys: Object.keys(body),
	});
	if (!isValidEmail(email)) {
		return NextResponse.json({ error: '올바른 이메일을 입력해 주세요.' }, { status: 400, headers: NO_STORE });
	}

	const user = await findAccountByEmail(email);
	console.log('[reset-password] query result', { matched: user ? 1 : 0, hasPassword: Boolean(user?.passwordHash) });
	if (!user) {
		return NextResponse.json({ ok: true, message: RESET_NOTICE }, { headers: NO_STORE });
	}
	if (name && user.name && normalizeName(user.name) !== name) {
		return NextResponse.json({ ok: true, message: RESET_NOTICE }, { headers: NO_STORE });
	}
	if (phone && user.phone && !phonesMatch(user.phone, phone)) {
		return NextResponse.json({ ok: true, message: RESET_NOTICE }, { headers: NO_STORE });
	}
	if (!user.passwordHash) {
		return NextResponse.json(
			{ error: '소셜 로그인 계정입니다. Google 또는 카카오로 로그인해 주세요.' },
			{ status: 400, headers: NO_STORE },
		);
	}

	const identifier = resetIdentifier(email);
	const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
	const rawToken = randomBytes(32).toString('hex');
	const tokenHash = hashToken(rawToken);
	let stored = false;
	try {
		await prisma.verificationToken.deleteMany({ where: { identifier } });
		await prisma.verificationToken.create({
			data: { identifier, token: tokenHash, expires },
		});
		stored = true;
	} catch (error) {
		console.error('[reset-password] local token save failed', error);
	}
	try {
		const saved = await saveSharedResetToken(email, tokenHash, expires);
		if (saved) stored = true;
	} catch (error) {
		console.error('[reset-password] shared token save failed', error);
	}
	if (!stored) {
		return NextResponse.json({ error: PASSWORD_RESET_MAIL_ERROR }, { status: 500, headers: NO_STORE });
	}

	try {
		await sendPasswordResetMail(email, rawToken);
	} catch (error) {
		console.error('[PASSWORD_RESET_MAIL_ERROR]:', error);
		return NextResponse.json({ error: PASSWORD_RESET_MAIL_ERROR }, { status: 500, headers: NO_STORE });
	}

	recordSecurityLog({
		eventType: 'PASSWORD_RESET',
		userEmail: email,
		userId: user.id,
		status: 'WARNING',
		details: '비밀번호 재설정 메일 발송',
		headers: request.headers,
	});

	return NextResponse.json({ ok: true, message: RESET_NOTICE }, { headers: NO_STORE });
}
