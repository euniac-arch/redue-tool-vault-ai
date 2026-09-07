import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { writeAdminAuditLog } from '@/lib/admin/admin-audit-log';
import { normalizeSubscriptionPlanId } from '@/lib/admin/subscription-management';
import { updateUserPlan } from '@/lib/admin/subscription-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const body = (await request.json().catch(() => ({}))) as { planId?: string };
	if (!body.planId) {
		return NextResponse.json({ error: 'planId가 필요합니다.' }, { status: 400 });
	}

	const planId = normalizeSubscriptionPlanId(body.planId);
	const row = await updateUserPlan(params.id, planId);
	if (!row) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });

	await writeAdminAuditLog({
		admin,
		module: 'USER_MGMT',
		actionDetail: `구독 플랜 수동 조정 — ${row.email || row.id} → ${row.planLabel}`,
	});

	return NextResponse.json(row);
}
