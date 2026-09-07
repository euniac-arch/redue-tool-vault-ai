import 'server-only';

import type { Notice, NoticeDraft, NoticeFilters, NoticeSortKey, NoticeStatus, NoticeTarget, NoticeType, SortDirection } from '@/lib/admin/notice-management';
import { prisma } from '@/lib/prisma';

function formatCreatedAt(value: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function asNoticeType(value: string): NoticeType {
	if (value === 'system' || value === 'event') return value;
	return 'notice';
}

function asNoticeTarget(value: string): NoticeTarget {
	if (value === 'user' || value === 'admin') return value;
	return 'all';
}

function asNoticeStatus(value: string): NoticeStatus {
	if (value === 'published' || value === 'archived') return value;
	return 'draft';
}

function toNotice(row: {
	id: string;
	type: string;
	title: string;
	content: string;
	target: string;
	isPinned: boolean;
	isPopup: boolean;
	status: string;
	createdAt: Date;
}): Notice {
	return {
		id: row.id,
		type: asNoticeType(row.type),
		title: row.title,
		content: row.content,
		target: asNoticeTarget(row.target),
		isPinned: row.isPinned,
		isPopup: row.isPopup,
		status: asNoticeStatus(row.status),
		createdAt: formatCreatedAt(row.createdAt),
	};
}

export async function queryNotices(input: {
	filters: NoticeFilters;
	sortKey: NoticeSortKey;
	sortDir: SortDirection;
	page: number;
	pageSize: number;
}) {
	const q = input.filters.query.trim();
	const where = {
		...(input.filters.type !== 'all' ? { type: input.filters.type } : {}),
		...(input.filters.status !== 'all' ? { status: input.filters.status } : {}),
		...(q
			? {
					OR: [{ title: { contains: q } }, { content: { contains: q } }],
				}
			: {}),
	};

	const total = await prisma.notice.count({ where });
	const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
	const page = Math.min(Math.max(1, input.page), totalPages);

	const rows = await prisma.notice.findMany({
		where,
		orderBy: [
			{ isPinned: 'desc' },
			input.sortKey === 'title' ? { title: input.sortDir } : { createdAt: input.sortDir },
		],
		skip: (page - 1) * input.pageSize,
		take: input.pageSize,
	});

	return {
		items: rows.map(toNotice),
		total,
		page,
		pageSize: input.pageSize,
		totalPages,
	};
}

export async function createNoticeRow(draft: NoticeDraft, authorId?: string | null): Promise<Notice> {
	const row = await prisma.notice.create({
		data: {
			type: draft.type,
			title: draft.title.trim(),
			content: draft.content.trim(),
			target: draft.target,
			isPinned: draft.isPinned,
			isPopup: draft.isPopup,
			status: draft.status,
			authorId: authorId || null,
		},
	});
	return toNotice(row);
}

export async function updateNoticeRow(id: string, draft: Partial<NoticeDraft>): Promise<Notice | null> {
	const existing = await prisma.notice.findUnique({ where: { id } });
	if (!existing) return null;
	const row = await prisma.notice.update({
		where: { id },
		data: {
			...(draft.type ? { type: draft.type } : {}),
			...(draft.title != null ? { title: draft.title.trim() } : {}),
			...(draft.content != null ? { content: draft.content.trim() } : {}),
			...(draft.target ? { target: draft.target } : {}),
			...(draft.isPinned != null ? { isPinned: draft.isPinned } : {}),
			...(draft.isPopup != null ? { isPopup: draft.isPopup } : {}),
			...(draft.status ? { status: draft.status } : {}),
		},
	});
	return toNotice(row);
}

export async function deleteNoticeRow(id: string): Promise<boolean> {
	try {
		await prisma.notice.delete({ where: { id } });
		return true;
	} catch {
		return false;
	}
}
