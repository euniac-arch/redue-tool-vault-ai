import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { cascadeDeleteAllAudits, cascadeDeleteAudits } from '@/lib/audit/delete-audit-cascade';

export const runtime = 'nodejs';

function revalidateAuditViews() {
	revalidatePath('/audit/history');
	revalidatePath('/admin/projects');
	revalidatePath('/audit/result');
}

/**
 * POST /api/admin/projects/bulk-delete
 * Body: { ids?: string[], all?: boolean }
 *
 * Hard-deletes Firestore `audit_projects` and matching Prisma Project / AuditLead
 * rows so /audit/history cannot resurface deleted diagnostics.
 * TEMP: requireAdmin bypassed while login is incomplete.
 */
export async function POST(request: Request) {
	const body = (await request.json().catch(() => null)) as { ids?: string[]; all?: boolean } | null;

	try {
		if (body?.all === true) {
			const result = await cascadeDeleteAllAudits();
			revalidateAuditViews();
			return NextResponse.json({
				ok: true,
				deleted: Math.max(
					result.firestoreDeleted,
					result.projectsDeleted,
					result.auditLeadsDeleted,
					result.auditReportsDeleted,
				),
				all: true,
				firestoreDeleted: result.firestoreDeleted,
				prismaDeleted: result.projectsDeleted,
				auditLeadsDeleted: result.auditLeadsDeleted,
				auditReportsDeleted: result.auditReportsDeleted,
			});
		}

		const list = Array.isArray(body?.ids)
			? [...new Set(body!.ids!.map((id) => String(id || '').trim()).filter(Boolean))]
			: [];

		if (list.length === 0) {
			return NextResponse.json(
				{ error: true, code: 'MISSING_IDS', message: '삭제할 프로젝트 ID가 필요합니다.' },
				{ status: 400 },
			);
		}

		const result = await cascadeDeleteAudits(list);
		revalidateAuditViews();
		return NextResponse.json({
			ok: true,
			deleted: Math.max(
				result.firestoreDeleted,
				result.projectsDeleted,
				result.auditLeadsDeleted,
				result.auditReportsDeleted,
			),
			ids: list,
			all: false,
			firestoreDeleted: result.firestoreDeleted,
			prismaDeleted: result.projectsDeleted,
			auditLeadsDeleted: result.auditLeadsDeleted,
			auditReportsDeleted: result.auditReportsDeleted,
		});
	} catch (err) {
		console.error('[admin/projects/bulk-delete] failed:', err);
		return NextResponse.json(
			{
				error: true,
				code: 'DELETE_FAILED',
				message: err instanceof Error ? err.message : '프로젝트 삭제에 실패했습니다.',
			},
			{ status: 500 },
		);
	}
}
