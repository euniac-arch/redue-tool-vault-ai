import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { isContactInquiryStatus } from '@/lib/admin/inquiry-management';
import { deleteContactLead, findContactLead, updateContactLeadStatus } from '@/lib/server/contact-leads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

/** GET /api/admin/inquiries/:id */
export async function GET(_request: Request, context: RouteContext) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const id = String(context.params?.id || '').trim();
	if (!id) {
		return NextResponse.json({ error: '문의 ID가 필요합니다.' }, { status: 400 });
	}

	const inquiry = findContactLead(id);
	if (!inquiry) {
		return NextResponse.json({ error: '문의 내역을 찾을 수 없습니다.' }, { status: 404 });
	}
	return NextResponse.json({ inquiry });
}

/** PATCH /api/admin/inquiries/:id — update processing status. */
export async function PATCH(request: Request, context: RouteContext) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const id = String(context.params?.id || '').trim();
	if (!id) {
		return NextResponse.json({ error: '문의 ID가 필요합니다.' }, { status: 400 });
	}

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
	}

	const status = String(body.status ?? '').trim();
	if (!isContactInquiryStatus(status)) {
		return NextResponse.json({ error: '유효하지 않은 처리 상태입니다.' }, { status: 400 });
	}

	const inquiry = updateContactLeadStatus(id, status);
	if (!inquiry) {
		return NextResponse.json({ error: '문의 내역을 찾을 수 없습니다.' }, { status: 404 });
	}
	return NextResponse.json({ inquiry });
}

/** DELETE /api/admin/inquiries/:id */
export async function DELETE(_request: Request, context: RouteContext) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const id = String(context.params?.id || '').trim();
	if (!id) {
		return NextResponse.json({ error: '문의 ID가 필요합니다.' }, { status: 400 });
	}

	const inquiry = deleteContactLead(id);
	if (!inquiry) {
		return NextResponse.json({ error: '문의 내역을 찾을 수 없습니다.' }, { status: 404 });
	}
	return NextResponse.json({ ok: true, id: inquiry.id });
}
