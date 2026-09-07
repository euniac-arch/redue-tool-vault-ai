import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { writeAdminAuditLog } from '@/lib/admin/admin-audit-log';
import type { ApiConfig, TestableTarget } from '@/lib/admin/apiConfigService';
import { testApiConnectionTarget } from '@/lib/admin/api-settings-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const body = (await request.json().catch(() => ({}))) as {
		target?: TestableTarget;
		draft?: Pick<ApiConfig, 'firebase' | 'llm' | 'social'>;
	};
	if (body.target !== 'firebase' && body.target !== 'llm' && body.target !== 'kakao' && body.target !== 'google') {
		return NextResponse.json({ error: '유효한 테스트 대상이 아닙니다.' }, { status: 400 });
	}

	const result = await testApiConnectionTarget(body.target, body.draft);
	await writeAdminAuditLog({
		admin,
		module: 'SYSTEM_CONFIG',
		actionDetail: `연동 테스트 — ${body.target} ${result.ok ? '성공' : '실패'}`,
		result: result.ok ? 'SUCCESS' : 'INFO',
	});
	return NextResponse.json(result);
}
