import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

interface SignupBody {
	email?: string;
	password?: string;
	name?: string;
}

/**
 * POST /api/auth/signup — creates an email/password account. The Starter
 * plan (`planId: "starter"`, `creditsRemaining: 1`) comes from the Prisma
 * schema defaults; we additionally log it in the credit ledger so it shows
 * up alongside OAuth signups on /mypage.
 */
export async function POST(request: Request) {
	const body = (await request.json().catch(() => ({}))) as SignupBody;
	const email = body.email?.trim().toLowerCase();
	const password = body.password ?? '';
	const name = body.name?.trim() || null;

	if (!email || !email.includes('@')) {
		return NextResponse.json({ error: '올바른 이메일을 입력해 주세요.' }, { status: 400 });
	}
	if (password.length < 8) {
		return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
	}

	const existing = await prisma.user.findUnique({ where: { email } });
	if (existing) {
		return NextResponse.json({ error: '이미 가입된 이메일입니다. 로그인을 이용해 주세요.' }, { status: 409 });
	}

	const passwordHash = await bcrypt.hash(password, 10);

	const user = await prisma.user.create({
		data: { email, name, passwordHash, role: isAdminEmail(email) ? 'admin' : 'user' },
	});

	await prisma.creditTransaction.create({
		data: { userId: user.id, delta: 1, reason: 'signup_bonus' },
	});

	return NextResponse.json({ ok: true, email: user.email });
}
