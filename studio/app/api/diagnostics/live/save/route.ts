import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { persistLiveDiagnosticResult } from '@/lib/admin/live-diagnostic-persist';
import type { LiveDiagnosticResult } from '@/lib/admin/liveDiagnosticTypes';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SaveBody = {
	result?: LiveDiagnosticResult;
};

/**
 * POST /api/diagnostics/live/save
 * Persist a completed live diagnostic into Firestore `diagnostics`.
 */
export async function POST(request: Request) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}
	if (!isFirebaseAdminConfigured()) {
		return NextResponse.json({ error: 'Firebase가 설정되지 않았습니다.' }, { status: 503 });
	}

	let body: SaveBody;
	try {
		body = (await request.json()) as SaveBody;
	} catch {
		return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
	}

	if (!body.result?.url || !body.result.siteName) {
		return NextResponse.json({ error: '저장할 진단 결과가 없습니다.' }, { status: 400 });
	}

	try {
		const saved = await persistLiveDiagnosticResult(body.result, {
			requestedBy: admin.email || admin.name || 'Admin',
			userId: admin.id,
		});
		return NextResponse.json({
			id: saved.id,
			reportShareUrl: `/admin/diagnostics?id=${encodeURIComponent(saved.id)}`,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : '진단 이력을 저장하지 못했습니다.';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
