import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { persistDiagnosticFromReport } from '@/lib/admin/diagnostic-persist';
import { queryDiagnosticDetail } from '@/lib/admin/diagnostic-query';
import { isDiagnosticRerunTarget } from '@/lib/admin/diagnostic-management';
import { authOptions } from '@/lib/auth';
import { coerceHttpUrl } from '@/lib/audit/normalize-url';
import {
	buildAuditProjectCreateInput,
	updateAuditProject,
	addAuditProject,
} from '@/lib/firebase/audit-projects';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { auditSite } from '@/lib/site-auditor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/**
 * POST /api/admin/diagnostics/:id/rerun
 * Re-triggers the diagnosis engine for the stored domain and upserts Firestore.
 */
export async function POST(request: Request, context: { params: { id: string } }) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}
	if (!isFirebaseAdminConfigured()) {
		return NextResponse.json({ error: 'Firebase가 설정되지 않았습니다.' }, { status: 503 });
	}

	const id = String(context.params?.id || '').trim();
	if (!id) {
		return NextResponse.json({ error: '진단 ID가 필요합니다.' }, { status: 400 });
	}

	let bodyDomain = '';
	try {
		const body = (await request.json()) as { domain?: string };
		bodyDomain = typeof body?.domain === 'string' ? body.domain.trim() : '';
	} catch {
		bodyDomain = '';
	}

	const existing = await queryDiagnosticDetail(id);
	if (!existing && !bodyDomain) {
		return NextResponse.json({ error: `진단 이력(${id})을 찾을 수 없습니다.` }, { status: 404 });
	}

	const rawTarget = [existing?.url, existing?.domain, bodyDomain].find((value) =>
		isDiagnosticRerunTarget(value),
	) || '';
	let targetUrl: string;
	try {
		targetUrl = coerceHttpUrl(rawTarget).toString();
	} catch {
		return NextResponse.json({ error: '재진단할 도메인이 올바르지 않습니다.' }, { status: 400 });
	}

	try {
		const report = await auditSite(targetUrl, 'ko', {
			forceRefresh: true,
			fullAudit: true,
			fullAuditDepth: 'deep',
		});
		const session = await getServerSession(authOptions).catch(() => null);
		const requestedBy = admin.email || session?.user?.email || existing?.requestedBy || 'Guest';

		const saved = await persistDiagnosticFromReport({
			report,
			requestedBy,
			userId: admin.id,
			userType: 'admin',
			replaceId: existing?.id || id,
			auditProjectId: existing?.id || id,
			overwrite: true,
		});

		try {
			const projectInput = buildAuditProjectCreateInput(report, {
				userType: 'admin',
				userId: admin.id,
				userAgent: request.headers.get('user-agent'),
			});
			const updated = existing ? await updateAuditProject(existing.id, projectInput) : null;
			if (!updated) {
				await addAuditProject(projectInput);
			}
		} catch (error) {
			console.error('[admin/diagnostics/rerun] audit_projects sync failed:', error);
		}

		if (!saved) {
			return NextResponse.json({ error: '재진단 결과를 저장하지 못했습니다.' }, { status: 500 });
		}
		return NextResponse.json(saved);
	} catch (error) {
		const message = error instanceof Error ? error.message : '재진단을 실행하지 못했습니다.';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
