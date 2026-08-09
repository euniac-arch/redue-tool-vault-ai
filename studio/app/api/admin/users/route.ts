import { NextResponse } from 'next/server';
import { getAdminUsersData } from '@/lib/admin-data';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';

/**
 * GET /api/admin/users — member management table rows, including per-user
 * lifetime payment total and API cost so the row can show a margin
 * (payment amount - cumulative cost_usd * exchange rate).
 */
export async function GET() {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	return NextResponse.json({ users: await getAdminUsersData() });
}
