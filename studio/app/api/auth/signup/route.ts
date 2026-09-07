import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { USER_FREE_CREDITS } from '@/lib/audit/free-audit-quota';
import { normalizePhone, validatePasswordStrength } from '@/lib/auth-account';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

interface SignupBody {
	email?: string;
	password?: string;
	name?: string;
	phone?: string;
}

/**
 * POST /api/auth/signup — creates an email/password account. The Starter
 * plan (`planId: "starter"`, `creditsRemaining: USER_FREE_CREDITS`) comes from
 * the Prisma schema defaults; we additionally log it in the credit ledger so it
 * shows up alongside OAuth signups on /mypage.
 */
export async function POST(request: Request) {
	const body = (await request.json().catch(() => ({}))) as SignupBody;
	const email = body.email?.trim().toLowerCase();
	const password = body.password ?? '';
	const name = body.name?.trim() || null;
	const phone = normalizePhone(body.phone ?? '');

	if (!email || !email.includes('@')) {
		return NextResponse.json({ error: '올바른 이메일을 입력해 주세요.' }, { status: 400 });
	}
	if (!name) {
		return NextResponse.json({ error: '이름을 입력해 주세요.' }, { status: 400 });
	}
	if (phone.length < 8) {
		return NextResponse.json({ error: '아이디 찾기에 사용할 연락처를 입력해 주세요.' }, { status: 400 });
	}
	const passwordError = validatePasswordStrength(password);
	if (passwordError) {
		return NextResponse.json({ error: passwordError }, { status: 400 });
	}

	const existing = await prisma.user.findUnique({ where: { email } });
	if (existing) {
		return NextResponse.json({ error: '이미 가입된 이메일입니다. 로그인을 이용해 주세요.' }, { status: 409 });
	}

	const passwordHash = await bcrypt.hash(password, 10);

	const user = await prisma.user.create({
		data: {
			email,
			name,
			phone,
			passwordHash,
			role: isAdminEmail(email) ? 'admin' : 'user',
			creditsRemaining: USER_FREE_CREDITS,
		},
	});

	await prisma.creditTransaction.create({
		data: { userId: user.id, delta: USER_FREE_CREDITS, reason: 'signup_bonus' },
	});

	return NextResponse.json({ ok: true, email: user.email });
}
