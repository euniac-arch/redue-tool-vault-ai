import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { writeAdminAuditLog } from '@/lib/admin/admin-audit-log';
import type { NoticeDraft } from '@/lib/admin/notice-management';
import { deleteNoticeRow, updateNoticeRow } from '@/lib/admin/notice-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const body = (await request.json().catch(() => ({}))) as Partial<NoticeDraft>;
	const notice = await updateNoticeRow(params.id, body);
	if (!notice) return NextResponse.json({ error: '공지를 찾을 수 없습니다.' }, { status: 404 });

	await writeAdminAuditLog({
		admin,
		module: 'CONTENT',
		actionDetail: body.status
			? `공지 상태 변경 — ${notice.title} → ${body.status}`
			: `공지 수정 — ${notice.title}`,
	});
	return NextResponse.json(notice);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const ok = await deleteNoticeRow(params.id);
	if (!ok) return NextResponse.json({ error: '공지를 찾을 수 없습니다.' }, { status: 404 });

	await writeAdminAuditLog({
		admin,
		module: 'CONTENT',
		actionDetail: `공지 삭제 — ${params.id}`,
	});
	return NextResponse.json({ id: params.id });
}
