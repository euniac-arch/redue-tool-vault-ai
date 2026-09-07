import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { writeAdminAuditLog } from '@/lib/admin/admin-audit-log';
import type { ApiConfig } from '@/lib/admin/apiConfigService';
import { extraIntegrationStatus, getPublicApiConfig, saveApiConfigOverrides } from '@/lib/admin/api-settings-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}
	return NextResponse.json({
		...getPublicApiConfig(),
		integrations: extraIntegrationStatus(),
	});
}

export async function PUT(request: Request) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const body = (await request.json().catch(() => ({}))) as Partial<Pick<ApiConfig, 'firebase' | 'llm' | 'social'>>;
	if (!body.firebase || !body.llm || !body.social) {
		return NextResponse.json({ error: 'firebase / llm / social 설정이 필요합니다.' }, { status: 400 });
	}

	const result = saveApiConfigOverrides({
		firebase: body.firebase,
		llm: body.llm,
		social: body.social,
	});

	await writeAdminAuditLog({
		admin,
		module: 'SYSTEM_CONFIG',
		actionDetail: 'API Key & Firebase 연동 설정 저장',
	});

	return NextResponse.json(result);
}
