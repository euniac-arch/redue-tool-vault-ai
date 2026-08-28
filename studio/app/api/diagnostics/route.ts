import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { persistDiagnosticFromReport } from '@/lib/admin/diagnostic-persist';
import { authOptions } from '@/lib/auth';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import type { AuditReport } from '@/lib/site-auditor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DiagnosticsPostBody = {
	report?: AuditReport;
	requestedBy?: string;
	replaceId?: string;
	auditProjectId?: string;
	overwrite?: boolean;
	userId?: string;
	userType?: string;
};

/**
 * POST /api/diagnostics
 * Persist a completed site diagnosis into Firestore `diagnostics`.
 */
export async function POST(request: Request) {
	if (!isFirebaseAdminConfigured()) {
		return NextResponse.json({ error: 'Firebase가 설정되지 않았습니다.' }, { status: 503 });
	}

	let body: DiagnosticsPostBody;
	try {
		body = (await request.json()) as DiagnosticsPostBody;
	} catch {
		return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
	}

	if (!body.report?.url) {
		return NextResponse.json({ error: '진단 리포트(report)가 필요합니다.' }, { status: 400 });
	}

	let sessionEmail: string | null = null;
	let sessionUserId: string | null = null;
	try {
		const session = await getServerSession(authOptions);
		sessionEmail = session?.user?.email ?? null;
		sessionUserId = session?.user?.id ?? null;
	} catch {
		// Guest scans are allowed to persist.
	}

	try {
		const saved = await persistDiagnosticFromReport({
			report: body.report,
			requestedBy: body.requestedBy || sessionEmail,
			userId: body.userId || sessionUserId,
			userType: body.userType,
			replaceId: body.replaceId,
			auditProjectId: body.auditProjectId,
			overwrite: Boolean(body.overwrite || body.replaceId),
		});
		if (!saved) {
			return NextResponse.json({ error: '진단 이력을 저장하지 못했습니다.' }, { status: 500 });
		}
		return NextResponse.json({ item: saved, id: saved.id });
	} catch (error) {
		const message = error instanceof Error ? error.message : '진단 이력을 저장하지 못했습니다.';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
