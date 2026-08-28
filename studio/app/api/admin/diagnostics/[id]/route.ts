import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { queryDiagnosticDetail } from '@/lib/admin/diagnostic-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/diagnostics/:id
 */
export async function GET(_request: Request, context: { params: { id: string } }) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const id = String(context.params?.id || '').trim();
	if (!id) {
		return NextResponse.json({ error: '진단 ID가 필요합니다.' }, { status: 400 });
	}

	try {
		const detail = await queryDiagnosticDetail(id);
		if (!detail) {
			return NextResponse.json({ error: `진단 이력(${id})을 찾을 수 없습니다.` }, { status: 404 });
		}
		return NextResponse.json(detail);
	} catch (error) {
		const message = error instanceof Error ? error.message : '진단 리포트를 불러오지 못했습니다.';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
