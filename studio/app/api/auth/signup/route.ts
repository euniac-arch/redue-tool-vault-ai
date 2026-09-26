import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { USER_FREE_CREDITS } from '@/lib/audit/free-audit-quota';
import { normalizePhone, validatePasswordStrength } from '@/lib/auth-account';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { prisma } from '@/lib/prisma';
import { isReadOnlyDeployRuntime } from '@/lib/server/writable-data-dir';
import {
	findDurableUserByEmail,
	upsertDurableUser,
	type DurableAppUser,
} from '@/lib/server/app-users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

interface SignupBody {
	email?: string;
	password?: string;
	name?: string;
	phone?: string;
}

function isUniqueConstraint(error: unknown): boolean {
	return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002';
}

/**
 * POST /api/auth/signup — creates an email/password account.
 * On Vercel the SQLite file is per-instance, so the shared Firestore row is
 * what the admin member list reads.
 */
export async function POST(request: Request) {
	try {
		const body = (await request.json().catch(() => ({}))) as SignupBody;
		const email = body.email?.trim().toLowerCase();
		const password = body.password ?? '';
		const name = body.name?.trim() || '';
		const phone = normalizePhone(body.phone ?? '');

		if (!email || !email.includes('@')) {
			return NextResponse.json({ error: '올바른 이메일을 입력해 주세요.' }, { status: 400, headers: NO_STORE });
		}
		if (!name) {
			return NextResponse.json({ error: '이름을 입력해 주세요.' }, { status: 400, headers: NO_STORE });
		}
		if (phone.length < 8) {
			return NextResponse.json({ error: '아이디 찾기에 사용할 연락처를 입력해 주세요.' }, { status: 400, headers: NO_STORE });
		}
		const passwordError = validatePasswordStrength(password);
		if (passwordError) {
			return NextResponse.json({ error: passwordError }, { status: 400, headers: NO_STORE });
		}

		if (isReadOnlyDeployRuntime() && !isFirebaseAdminConfigured()) {
			console.error('[signup] durable user store is not configured on this deploy');
			return NextResponse.json(
				{ error: '회원 저장소가 설정되지 않아 가입을 완료할 수 없습니다. 관리자에게 문의해 주세요.' },
				{ status: 500, headers: NO_STORE },
			);
		}

		const [existingPrisma, existingDurable] = await Promise.all([
			prisma.user.findUnique({ where: { email } }).catch((error) => {
				console.error('[signup] existing user lookup failed', { email, error });
				return null;
			}),
			findDurableUserByEmail(email),
		]);
		if (existingPrisma || existingDurable) {
			return NextResponse.json(
				{ error: '이미 가입된 이메일입니다. 로그인을 이용해 주세요.' },
				{ status: 409, headers: NO_STORE },
			);
		}

		const passwordHash = await bcrypt.hash(password, 10);
		const role = isAdminEmail(email) ? 'admin' : 'user';
		let userId: string = randomUUID();
		let createdAt = new Date().toISOString();

		try {
			const user = await prisma.user.create({
				data: {
					email,
					name,
					phone,
					passwordHash,
					role,
					status: 'active',
					planId: 'starter',
					creditsRemaining: USER_FREE_CREDITS,
				},
			});
			userId = user.id;
			createdAt = user.createdAt.toISOString();
			await prisma.creditTransaction.create({
				data: { userId: user.id, delta: USER_FREE_CREDITS, reason: 'signup_bonus' },
			});
		} catch (error) {
			console.error('[signup] prisma create failed', { email, error });
			if (isUniqueConstraint(error)) {
				return NextResponse.json(
					{ error: '이미 가입된 이메일입니다. 로그인을 이용해 주세요.' },
					{ status: 409, headers: NO_STORE },
				);
			}
			if (!isFirebaseAdminConfigured()) {
				return NextResponse.json(
					{ error: '회원 정보를 저장하지 못했습니다. 입력값을 확인한 뒤 다시 시도해 주세요.' },
					{ status: 500, headers: NO_STORE },
				);
			}
		}

		if (isFirebaseAdminConfigured()) {
			const record: DurableAppUser = {
				id: userId,
				email,
				name,
				phone,
				passwordHash,
				role,
				planId: 'starter',
				creditsRemaining: USER_FREE_CREDITS,
				status: 'active',
				memo: '',
				image: null,
				provider: 'email',
				createdAt,
				lastLoginAt: null,
			};
			try {
				await upsertDurableUser(record);
			} catch (error) {
				console.error('[signup] shared user write failed', { email, userId, error });
				return NextResponse.json(
					{ error: '회원 정보를 저장소에 기록하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
					{ status: 500, headers: NO_STORE },
				);
			}
		}

		console.info('[signup] user created', { email, userId, role, phoneDigits: phone.length });
		return NextResponse.json({ ok: true, email }, { headers: NO_STORE });
	} catch (error) {
		console.error('[signup] unexpected failure', error);
		return NextResponse.json(
			{ error: '회원가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
			{ status: 500, headers: NO_STORE },
		);
	}
}
