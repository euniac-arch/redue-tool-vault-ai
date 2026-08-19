import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { deleteAuditProjectsByIds } from '@/lib/firebase/audit-projects';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { prisma } from '@/lib/prisma';
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
 * DELETE /api/audit/[id] — remove a history row owned by the signed-in user.
 * Also clears the matching Firestore `audit_projects` doc when Admin SDK is available.
 * Guest history is deleted client-side via localStorage only.
 */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
	const id = params.id?.trim();
	if (!id) {
		return NextResponse.json({ error: '진단 ID가 필요합니다.' }, { status: 400 });
	}

	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
	}

	const [lead, savedReport] = await Promise.all([
		prisma.auditLead.findUnique({
			where: { id },
			select: { id: true, userId: true },
		}),
		prisma.auditReport.findUnique({
			where: { id },
			select: { id: true, userId: true },
		}),
	]);

	let firestoreDeleted = 0;
	if (isFirebaseAdminConfigured()) {
		const fsResult = await deleteAuditProjectsByIds([id]);
		firestoreDeleted = fsResult.deleted;
	}

	if (savedReport) {
		if (savedReport.userId !== session.user.id) {
			return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
		}
		await prisma.auditReport.delete({ where: { id } }).catch(() => null);
	}

	if (!lead) {
		if (firestoreDeleted > 0 || savedReport) {
			revalidatePath('/audit/history');
			revalidatePath('/admin/projects');
			revalidatePath(`/report/${id}`);
		}
		return NextResponse.json({
			ok: true,
			deleted: firestoreDeleted > 0 || Boolean(savedReport),
			firestoreDeleted,
		});
	}

	if (lead.userId && lead.userId !== session.user.id) {
		return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
	}

	await prisma.auditLead.delete({ where: { id } });
	revalidatePath('/audit/history');
	revalidatePath('/admin/projects');
	revalidatePath(`/report/${id}`);
	return NextResponse.json({ ok: true, deleted: true, firestoreDeleted });
}
