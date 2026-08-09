import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { AuditReport } from '@/lib/site-auditor';

export const runtime = 'nodejs';

/**
 * GET /api/audit/[id] — load a previously saved free-audit report by AuditLead id.
 * Public by design (shareable result links); cuid ids are unguessable enough for this use case.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
	const id = params.id?.trim();
	if (!id) {
		return NextResponse.json({ error: '진단 ID가 필요합니다.' }, { status: 400 });
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
		return NextResponse.json({ error: '진단 내역을 찾을 수 없습니다.' }, { status: 404 });
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
	});
}

/**
 * DELETE /api/audit/[id] — remove a history row owned by the signed-in user.
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

	if (!lead) {
		return NextResponse.json({ ok: true, deleted: false });
	}

	if (lead.userId !== session.user.id) {
		return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
	}

	await prisma.auditLead.delete({ where: { id } });
	return NextResponse.json({ ok: true, deleted: true });
}
