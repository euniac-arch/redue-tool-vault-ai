import { NextResponse, type NextRequest } from 'next/server';
import { getAdminLogsData } from '@/lib/admin-data';
import { getAdminAccessState } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/logs — "실시간 주입 로그" table. Polled client-side every
 * few seconds by `AdminInjectionLog` for a lightweight real-time feel
 * without standing up a websocket/SSE channel.
 *
 * Auth: JWT is read from the request cookies (`getServerSession` can be
 * null in App Router handlers after Kakao/Google). Missing session → 401;
 * signed-in non-admin → 403. Grant: `ADMIN_EMAILS` + DB `role=admin` +
 * bootstrap master id.
 */
export async function GET(req: NextRequest) {
	const access = await getAdminAccessState(req);
	if (access.state === 'unauthenticated') {
		return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
	}
	if (access.state !== 'ok') {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	return NextResponse.json({ logs: await getAdminLogsData() });
}
