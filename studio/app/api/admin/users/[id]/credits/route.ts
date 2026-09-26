import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { writeAdminAuditLog } from '@/lib/admin/admin-audit-log';
import { findAdminMember } from '@/lib/admin/user-query';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { prisma } from '@/lib/prisma';
import { findDurableUserById, updateDurableUser } from '@/lib/server/app-users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

interface CreditAdjustBody {
	delta?: number;
	reason?: string;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const body = (await request.json().catch(() => ({}))) as CreditAdjustBody;
	const delta = Number(body.delta);
	if (!Number.isFinite(delta) || delta === 0) {
		return NextResponse.json({ error: '유효한 delta 값이 필요합니다 (0이 아닌 정수).' }, { status: 400 });
	}

	const target = await prisma.user.findUnique({ where: { id: params.id } }).catch((error) => {
		console.error('[admin/users] credit lookup failed', { id: params.id, error });
		return null;
	});
	const durable = target || !isFirebaseAdminConfigured() ? null : await findDurableUserById(params.id);
	if (!target && !durable) {
		return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404, headers: NO_STORE });
	}

	const currentCredits = target?.creditsRemaining ?? durable!.creditsRemaining;
	const nextCredits = Math.max(0, currentCredits + delta);
	const appliedDelta = nextCredits - currentCredits;
	const email = target?.email || durable!.email;

	if (target) {
		await prisma.$transaction([
			prisma.user.update({ where: { id: target.id }, data: { creditsRemaining: nextCredits } }),
			prisma.creditTransaction.create({
				data: {
					userId: target.id,
					delta: appliedDelta,
					reason: body.reason?.trim() || `admin_adjust_by_${admin.email ?? admin.id}`,
				},
			}),
		]);
	}
	if (isFirebaseAdminConfigured()) {
		await updateDurableUser(params.id, { creditsRemaining: nextCredits }).catch((error) => {
			console.error('[admin/users] shared credit update failed', { id: params.id, error });
			if (!target) throw error;
		});
	}

	await writeAdminAuditLog({
		admin,
		module: 'USER_MGMT',
		actionDetail: `회원 크레딧 ${appliedDelta >= 0 ? '지급' : '회수'} — ${email || params.id} ${appliedDelta >= 0 ? '+' : ''}${appliedDelta}`,
	});

	const member = await findAdminMember(params.id);
	return NextResponse.json(member, { headers: NO_STORE });
}
