import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { buildSecurityLogKpi } from '@/lib/admin/security-log-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}
	return NextResponse.json(await buildSecurityLogKpi());
}
