import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { normalizeSubscriptionPlanId } from '@/lib/admin/subscription-management';
import { querySubscriptions } from '@/lib/admin/subscription-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const url = new URL(request.url);
	const page = Number(url.searchParams.get('page') || '1');
	const pageSize = Number(url.searchParams.get('pageSize') || '10');
	const planRaw = url.searchParams.get('plan') || 'all';
	const plan = planRaw === 'all' ? 'all' : normalizeSubscriptionPlanId(planRaw);

	return NextResponse.json(
		await querySubscriptions({
			filters: { query: url.searchParams.get('q') || '', plan },
			page: Number.isFinite(page) ? page : 1,
			pageSize: Number.isFinite(pageSize) ? pageSize : 10,
		}),
	);
}
