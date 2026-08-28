import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { buildMockApiQuotaSnapshot } from '@/lib/admin/api-quota';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/usage/quota — API 사용량 및 쿼터 관리 대시보드 데이터.
 *
 * TODO(backend): replace `buildMockApiQuotaSnapshot()` with a real usage-log
 * aggregation query once the backend usage-logging pipeline lands. The response
 * shape (`ApiQuotaSnapshot`) is the agreed contract, so no frontend changes
 * should be required when this swap happens.
 */
export async function GET() {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	return NextResponse.json(buildMockApiQuotaSnapshot());
}
