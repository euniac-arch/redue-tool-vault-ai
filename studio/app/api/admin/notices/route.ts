import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { writeAdminAuditLog } from '@/lib/admin/admin-audit-log';
import type { NoticeDraft, NoticeFilters, NoticeSortKey, NoticeStatus, NoticeType, SortDirection } from '@/lib/admin/notice-management';
import { createNoticeRow, queryNotices } from '@/lib/admin/notice-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseType(value: string | null): NoticeFilters['type'] {
	if (value === 'notice' || value === 'system' || value === 'event') return value;
	return 'all';
}

function parseStatus(value: string | null): NoticeFilters['status'] {
	if (value === 'published' || value === 'draft' || value === 'archived') return value;
	return 'all';
}

export async function GET(request: Request) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const url = new URL(request.url);
	const page = Number(url.searchParams.get('page') || '1');
	const pageSize = Number(url.searchParams.get('pageSize') || '8');

	return NextResponse.json(
		await queryNotices({
			filters: {
				query: url.searchParams.get('q') || '',
				type: parseType(url.searchParams.get('type')),
				status: parseStatus(url.searchParams.get('status')),
			},
			sortKey: (url.searchParams.get('sortKey') === 'title' ? 'title' : 'createdAt') as NoticeSortKey,
			sortDir: (url.searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc') as SortDirection,
			page: Number.isFinite(page) ? page : 1,
			pageSize: Number.isFinite(pageSize) ? pageSize : 8,
		}),
	);
}

export async function POST(request: Request) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const body = (await request.json().catch(() => ({}))) as Partial<NoticeDraft>;
	if (!body.title?.trim() || !body.content?.trim()) {
		return NextResponse.json({ error: '제목과 본문을 입력해 주세요.' }, { status: 400 });
	}

	const draft: NoticeDraft = {
		type: (body.type as NoticeType) || 'notice',
		title: body.title.trim(),
		content: body.content.trim(),
		target: body.target || 'all',
		isPinned: Boolean(body.isPinned),
		isPopup: Boolean(body.isPopup),
		status: (body.status as NoticeStatus) || 'draft',
	};

	const notice = await createNoticeRow(draft, admin.id);
	await writeAdminAuditLog({
		admin,
		module: 'CONTENT',
		actionDetail: `공지사항 ${draft.status === 'published' ? '게시' : '임시저장'} — ${notice.title}`,
		result: draft.status === 'published' ? 'SUCCESS' : 'PENDING',
	});
	return NextResponse.json(notice);
}
