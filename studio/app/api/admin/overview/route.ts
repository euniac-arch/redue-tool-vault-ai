import { NextResponse } from 'next/server';
import { getAdminOverview } from '@/lib/admin-data';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';

/** GET /api/admin/overview — the four headline metric cards on `/admin`. */
export async function GET() {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	return NextResponse.json(await getAdminOverview());
}
