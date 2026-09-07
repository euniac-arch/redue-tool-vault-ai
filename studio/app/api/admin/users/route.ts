import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { buildUserKpi, queryAdminMembers } from '@/lib/admin/user-query';
import type { MemberFilters, MemberSortKey, SortDirection } from '@/lib/admin/user-management';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parsePlan(value: string | null): MemberFilters['plan'] {
	if (value === 'Free' || value === 'Pro' || value === 'Enterprise') return value;
	return 'all';
}

function parseProvider(value: string | null): MemberFilters['provider'] {
	if (value === 'email' || value === 'kakao' || value === 'google' || value === 'naver') return value;
	return 'all';
}

function parseStatus(value: string | null): MemberFilters['status'] {
	if (value === 'active' || value === 'suspended' || value === 'withdrawn') return value;
	return 'all';
}

function parseSortKey(value: string | null): MemberSortKey {
	if (value === 'credits_remaining' || value === 'last_audit_score') return value;
	return 'created_at';
}

export async function GET(request: Request) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const url = new URL(request.url);
	const page = Number(url.searchParams.get('page') || '1');
	const pageSize = Number(url.searchParams.get('pageSize') || '10');
	const filters: MemberFilters = {
		query: url.searchParams.get('q') || '',
		plan: parsePlan(url.searchParams.get('plan')),
		provider: parseProvider(url.searchParams.get('provider')),
		status: parseStatus(url.searchParams.get('status')),
	};

	const [list, kpi] = await Promise.all([
		queryAdminMembers({
			filters,
			sortKey: parseSortKey(url.searchParams.get('sortKey')),
			sortDir: (url.searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc') as SortDirection,
			page: Number.isFinite(page) ? page : 1,
			pageSize: Number.isFinite(pageSize) ? pageSize : 10,
		}),
		buildUserKpi(),
	]);

	return NextResponse.json({ ...list, kpi });
}
