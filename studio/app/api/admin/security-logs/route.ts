import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import {
	isSecurityEventType,
	isSecurityLogStatus,
	type SecurityLogFilters,
} from '@/lib/admin/security-log-management';
import { querySecurityLogs } from '@/lib/admin/security-log-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseEventType(value: string | null): SecurityLogFilters['eventType'] {
	if (value === 'LOGIN_FAILED') return 'LOGIN_FAIL';
	return isSecurityEventType(value) ? value : 'all';
}

function parseStatus(value: string | null): SecurityLogFilters['status'] {
	if (value === 'info') return 'SUCCESS';
	if (value === 'critical') return 'FAIL';
	if (value === 'warning') return 'WARNING';
	return isSecurityLogStatus(value) ? value : 'all';
}

export async function GET(request: Request) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const url = new URL(request.url);
	const page = Number(url.searchParams.get('page') || '1');
	const pageSize = Number(url.searchParams.get('pageSize') || '25');
	const clampedPageSize = Math.min(50, Math.max(20, Number.isFinite(pageSize) ? pageSize : 25));

	return NextResponse.json(
		await querySecurityLogs({
			filters: {
				query: url.searchParams.get('q') || '',
				eventType: parseEventType(url.searchParams.get('eventType')),
				status: parseStatus(url.searchParams.get('status')),
				from: url.searchParams.get('from') || '',
				to: url.searchParams.get('to') || '',
			},
			sortDir: url.searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc',
			page: Number.isFinite(page) ? page : 1,
			pageSize: clampedPageSize,
		}),
	);
}
