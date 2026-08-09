import { NextResponse } from 'next/server';
import { getAdminLogsData } from '@/lib/admin-data';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';

/**
 * GET /api/admin/logs — "실시간 주입 로그" table. Polled client-side every
 * few seconds by `AdminInjectionLog` for a lightweight real-time feel
 * without standing up a websocket/SSE channel.
 */
export async function GET() {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	return NextResponse.json({ logs: await getAdminLogsData() });
}
