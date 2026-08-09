import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getAdminAuditLeads } from '@/lib/admin-data';

export const runtime = 'nodejs';

/** GET /api/admin/audit-leads — Step 7 lead-magnet follow-up list. */
export async function GET() {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	return NextResponse.json({ leads: await getAdminAuditLeads() });
}
