import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import type { InquiryFilterStatus } from '@/lib/admin/inquiry-management';
import { queryContactLeads } from '@/lib/server/contact-leads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseFilterStatus(value: string | null): InquiryFilterStatus {
	if (value === 'pending' || value === 'completed') return value;
	return 'all';
}

/** GET /api/admin/inquiries — paginated work-inquiry list. */
export async function GET(request: Request) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const url = new URL(request.url);
	const page = Number(url.searchParams.get('page') || '1');
	const pageSize = Number(url.searchParams.get('pageSize') || '10');

	return NextResponse.json(
		queryContactLeads({
			q: url.searchParams.get('q') || '',
			status: parseFilterStatus(url.searchParams.get('status')),
			page: Number.isFinite(page) ? page : 1,
			pageSize: Number.isFinite(pageSize) ? pageSize : 10,
		}),
	);
}
