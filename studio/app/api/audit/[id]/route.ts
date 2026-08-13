import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import {
	deleteAuditProjectsByIds,
	getAuditProjectById,
} from '@/lib/firebase/audit-projects';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { prisma } from '@/lib/prisma';
import type { AuditReport } from '@/lib/site-auditor';

export const runtime = 'nodejs';

const DELETED_OR_MISSING = '삭제되었거나 존재하지 않는 진단 내역입니다.';

/**
 * GET /api/audit/[id] — load a previously saved free-audit report.
 * Prefers Firestore `audit_projects`, then falls back to Prisma AuditLead.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
	const id = params.id?.trim();
	if (!id) {
		return NextResponse.json({ error: '진단 ID가 필요합니다.' }, { status: 400 });
	}

	const firestoreDoc = await getAuditProjectById(id).catch(() => null);
	if (firestoreDoc?.auditPayload?.report) {
		return NextResponse.json({
			id: firestoreDoc.id,
			createdAt: firestoreDoc.createdAt,
			score: firestoreDoc.score,
			issueCount: firestoreDoc.issueCount,
			report: firestoreDoc.auditPayload.report,
			source: 'firestore',
		});
	}

	// When Firestore is authoritative and the doc is gone, do not resurrect via Prisma.
	if (isFirebaseAdminConfigured()) {
		return NextResponse.json(
			{ error: DELETED_OR_MISSING, code: 'DELETED_OR_MISSING' },
			{ status: 404 },
		);
	}

	const lead = await prisma.auditLead.findUnique({
		where: { id },
		select: {
			id: true,
			url: true,
			score: true,
			maxScore: true,
			statusLabel: true,
			reportJson: true,
			createdAt: true,
		},
	});

	if (!lead) {
		return NextResponse.json(
			{ error: DELETED_OR_MISSING, code: 'DELETED_OR_MISSING' },
			{ status: 404 },
		);
	}

	let report: AuditReport;
	try {
		report = JSON.parse(lead.reportJson) as AuditReport;
	} catch {
		return NextResponse.json({ error: '저장된 진단 데이터가 손상되었습니다.' }, { status: 500 });
	}

	return NextResponse.json({
		id: lead.id,
		createdAt: lead.createdAt.toISOString(),
		report,
		source: 'prisma',
	});
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

	const lead = await prisma.auditLead.findUnique({
		where: { id },
		select: { id: true, userId: true },
	});

	let firestoreDeleted = 0;
	if (isFirebaseAdminConfigured()) {
		const fsResult = await deleteAuditProjectsByIds([id]);
		firestoreDeleted = fsResult.deleted;
	}

	if (!lead) {
		if (firestoreDeleted > 0) {
			revalidatePath('/audit/history');
			revalidatePath('/admin/projects');
		}
		return NextResponse.json({ ok: true, deleted: firestoreDeleted > 0, firestoreDeleted });
	}

	if (lead.userId !== session.user.id) {
		return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
	}

	await prisma.auditLead.delete({ where: { id } });
	revalidatePath('/audit/history');
	revalidatePath('/admin/projects');
	return NextResponse.json({ ok: true, deleted: true, firestoreDeleted });
}
