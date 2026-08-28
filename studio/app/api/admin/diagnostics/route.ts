import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { queryDiagnosticHistory } from '@/lib/admin/diagnostic-query';
import {
	PAGE_SIZE_OPTIONS,
	type DiagnosticCategory,
	type DiagnosticPageSize,
	type DiagnosticPeriod,
	type DiagnosticSortBy,
	type DiagnosticStatus,
} from '@/lib/admin/diagnostic-management';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function asCategory(value: string | null): DiagnosticCategory | 'all' {
	if (value === 'Medical' || value === 'Pet' || value === 'Commerce' || value === 'Corporate') return value;
	return 'all';
}

function asStatus(value: string | null): DiagnosticStatus | 'all' {
	if (value === 'critical' || value === 'warning' || value === 'good') return value;
	return 'all';
}

function asPeriod(value: string | null): DiagnosticPeriod {
	if (value === 'today' || value === '7d' || value === '30d') return value;
	return '30d';
}

function asPageSize(value: string | null): DiagnosticPageSize {
	const parsed = Number(value);
	return (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed) ? (parsed as DiagnosticPageSize) : 10;
}

function asSortBy(value: string | null): DiagnosticSortBy {
	if (value === 'createdAt:asc' || value === 'createdAt:desc') return value;
	if (value === 'createdAt') return 'createdAt:desc';
	return 'createdAt:desc';
}

/**
 * GET /api/admin/diagnostics
 * Query params: page, limit, search, category, status, period, sortBy
 */
export async function GET(request: Request) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	if (!isFirebaseAdminConfigured()) {
		return NextResponse.json({ error: 'Firebase가 설정되지 않았습니다.' }, { status: 503 });
	}

	try {
		const { searchParams } = new URL(request.url);
		const result = await queryDiagnosticHistory({
			filters: {
				query: searchParams.get('search') || searchParams.get('q') || '',
				category: asCategory(searchParams.get('category')),
				status: asStatus(searchParams.get('status')),
				period: asPeriod(searchParams.get('period')),
			},
			page: Math.max(1, Number(searchParams.get('page')) || 1),
			pageSize: asPageSize(searchParams.get('limit') || searchParams.get('pageSize')),
			sortBy: asSortBy(searchParams.get('sortBy')),
		});
		return NextResponse.json(result, {
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				Pragma: 'no-cache',
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : '진단 이력을 불러오지 못했습니다.';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
