import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { writeAdminAuditLog } from '@/lib/admin/admin-audit-log';
import { findAdminMember } from '@/lib/admin/user-query';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

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

	const target = await prisma.user.findUnique({ where: { id: params.id } });
	if (!target) {
		return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
	}

	const nextCredits = Math.max(0, target.creditsRemaining + delta);
	const appliedDelta = nextCredits - target.creditsRemaining;

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

	await writeAdminAuditLog({
		admin,
		module: 'USER_MGMT',
		actionDetail: `회원 크레딧 ${appliedDelta >= 0 ? '지급' : '회수'} — ${target.email || target.id} ${appliedDelta >= 0 ? '+' : ''}${appliedDelta}`,
	});

	const member = await findAdminMember(target.id);
	return NextResponse.json(member);
}
