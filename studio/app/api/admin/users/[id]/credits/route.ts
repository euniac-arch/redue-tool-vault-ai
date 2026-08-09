import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

interface CreditAdjustBody {
	delta?: number;
	reason?: string;
}

/**
 * POST /api/admin/users/[id]/credits — the "크레딧 수동 지급/차감" action from
 * the member management table. `delta` may be positive (grant) or negative
 * (deduct); credits are clamped at 0.
 */
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

	const [updated] = await prisma.$transaction([
		prisma.user.update({ where: { id: target.id }, data: { creditsRemaining: nextCredits } }),
		prisma.creditTransaction.create({
			data: {
				userId: target.id,
				delta: appliedDelta,
				reason: body.reason?.trim() || `admin_adjust_by_${admin.email ?? admin.id}`,
			},
		}),
	]);

	return NextResponse.json({ ok: true, creditsRemaining: updated.creditsRemaining });
}
