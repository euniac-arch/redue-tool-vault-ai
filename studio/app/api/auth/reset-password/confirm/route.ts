import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { normalizeEmail, resetIdentifier, validatePasswordStrength } from '@/lib/auth-account';
import { recordSecurityLog } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { deleteSharedResetToken, findAccountByEmail, readSharedResetToken } from '@/lib/server/account-lookup';
import { updateDurablePasswordByEmail } from '@/lib/server/app-users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
	console.log('[reset-password/confirm] payload', {
		email,
		hasToken: Boolean(token),
		passwordLength: password.length,
	});
	if (!email || !token) {
		return NextResponse.json({ error: '재설정 링크가 올바르지 않습니다.' }, { status: 400 });
	}

	const passwordError = validatePasswordStrength(password);
	if (passwordError) {
		return NextResponse.json({ error: passwordError }, { status: 400 });
	}

	const identifier = resetIdentifier(email);
	const tokenHash = hashToken(token);
	const shared = await readSharedResetToken(email);
	const sharedValid = Boolean(shared && shared.tokenHash === tokenHash && new Date(shared.expires).getTime() >= Date.now());
	const record = await prisma.verificationToken.findUnique({ where: { token: tokenHash } }).catch((error) => {
		console.error('[reset-password/confirm] local token lookup failed', error);
		return null;
	});
	const localValid = Boolean(record && record.identifier === identifier && record.expires.getTime() >= Date.now());
	console.log('[reset-password/confirm] token result', { sharedValid, localValid });
	if (!sharedValid && !localValid) {
		return NextResponse.json(
			{ error: '재설정 링크가 만료되었거나 올바르지 않습니다. 다시 요청해 주세요.' },
			{ status: 400 },
		);
	}

	const account = await findAccountByEmail(email);
	console.log('[reset-password/confirm] account result', { matched: account ? 1 : 0 });
	if (!account) {
		return NextResponse.json({ error: '가입된 이메일이 아닙니다.' }, { status: 404 });
	}

	const passwordHash = await bcrypt.hash(password, 10);
	const prismaUser = await prisma.user.findUnique({ where: { email }, select: { id: true } }).catch(() => null);
	if (prismaUser) {
		await prisma.user.update({ where: { id: prismaUser.id }, data: { passwordHash } });
	}
	await updateDurablePasswordByEmail(email, passwordHash).catch((error) => {
		console.error('[reset-password/confirm] shared password update failed', error);
	});
	await prisma.verificationToken.deleteMany({ where: { identifier } }).catch((error) => {
		console.error('[reset-password/confirm] local token delete failed', error);
	});
	await deleteSharedResetToken(email);

	recordSecurityLog({
		eventType: 'PASSWORD_RESET',
		userEmail: email,
		userId: account.id,
		status: 'SUCCESS',
		details: '비밀번호 재설정 완료',
		headers: request.headers,
	});

	return NextResponse.json({ ok: true });
}
