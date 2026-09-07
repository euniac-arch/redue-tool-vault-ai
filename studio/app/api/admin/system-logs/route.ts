import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import type { SystemLogFilters, SystemLogModule } from '@/lib/admin/system-log-management';
import { querySystemLogs } from '@/lib/admin/system-log-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseModule(value: string | null): SystemLogFilters['module'] {
	if (value === 'USER_MGMT' || value === 'CONTENT' || value === 'SYSTEM_CONFIG' || value === 'AUTH') {
		return value as SystemLogModule;
	}
	return 'all';
}

export async function GET(request: Request) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const url = new URL(request.url);
	const page = Number(url.searchParams.get('page') || '1');
	const pageSize = Number(url.searchParams.get('pageSize') || '10');

	return NextResponse.json(
		await querySystemLogs({
			filters: {
				query: url.searchParams.get('q') || '',
				module: parseModule(url.searchParams.get('module')),
			},
			sortDir: url.searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc',
			page: Number.isFinite(page) ? page : 1,
			pageSize: Number.isFinite(pageSize) ? pageSize : 10,
		}),
	);
}
