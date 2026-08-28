import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { cascadeDeleteAudits } from '@/lib/audit/delete-audit-cascade';
import { loadSavedAuditReport } from '@/lib/audit/load-saved-report';

export const runtime = 'nodejs';

const DELETED_OR_MISSING = '삭제되었거나 존재하지 않는 진단 내역입니다.';

/**
 * GET /api/audit/[id] — load a previously saved free-audit report.
 * Prefers Firestore `audit_projects`, then Prisma AuditReport / AuditLead.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
	const id = params.id?.trim();
	if (!id) {
		return NextResponse.json({ error: '진단 ID가 필요합니다.' }, { status: 400 });
	}

	const saved = await loadSavedAuditReport(id);
	if (saved) {
		return NextResponse.json({
			id: saved.id,
			createdAt: saved.createdAt,
			score: saved.score,
			issueCount: saved.issueCount,
			report: saved.report,
			source: saved.source,
		});
	}

	return NextResponse.json(
		{ error: DELETED_OR_MISSING, code: 'DELETED_OR_MISSING' },
		{ status: 404 },
	);
}

/**
 * DELETE /api/audit/[id] — remove a diagnosis everywhere it was registered:
 * Firestore `audit_projects`, Prisma Project (admin workspace), AuditLead,
 * and AuditReport. Guest history ids and admin project ids often differ, so
 * the cascade also matches by URL. Login is not required — possession of the
 * diagnosis id is enough (same as public scan / share-link).
 */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
	const id = params.id?.trim();
	if (!id) {
		return NextResponse.json({ error: '진단 ID가 필요합니다.' }, { status: 400 });
	}

	try {
		const result = await cascadeDeleteAudits([id]);
		revalidatePath('/audit/history');
		revalidatePath('/admin/projects');
		revalidatePath('/audit/result');
		revalidatePath(`/report/${id}`);
		return NextResponse.json({
			ok: true,
			deleted: result.deleted,
			firestoreDeleted: result.firestoreDeleted,
			prismaDeleted: result.projectsDeleted,
			auditLeadsDeleted: result.auditLeadsDeleted,
			auditReportsDeleted: result.auditReportsDeleted,
		});
	} catch (err) {
		console.error('[audit/:id] DELETE cascade failed:', err);
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : '삭제에 실패했습니다.' },
			{ status: 500 },
		);
	}
}
