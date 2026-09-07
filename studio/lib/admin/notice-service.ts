import { fetchAdminApi } from '@/lib/admin/admin-api';
import type { Notice, NoticeDraft, NoticeFilters, NoticeSortKey, NoticeStatus, SortDirection } from './notice-management';

export class AdminNoticeNotFoundError extends Error {
	constructor(id: string) {
		super(`공지(${id})를 찾을 수 없습니다.`);
		this.name = 'AdminNoticeNotFoundError';
	}
}

export type FetchNoticesParams = {
	filters: NoticeFilters;
	sortKey: NoticeSortKey;
	sortDir: SortDirection;
	page: number;
	pageSize: number;
	enabled?: boolean;
};

export type FetchNoticesResult = {
	items: Notice[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
};

async function unwrap<T>(url: string, init?: RequestInit & { enabled?: boolean }, fallback = '요청에 실패했습니다.'): Promise<T> {
	const result = await fetchAdminApi<T>(url, init);
	if (!result.ok) {
		if (result.status === 404) throw new AdminNoticeNotFoundError(url);
		throw new Error(result.message || fallback);
	}
	return result.data;
}

export async function fetchNoticeList(params: FetchNoticesParams): Promise<FetchNoticesResult> {
	const query = new URLSearchParams({
		q: params.filters.query,
		type: params.filters.type,
		status: params.filters.status,
		sortKey: params.sortKey,
		sortDir: params.sortDir,
		page: String(params.page),
		pageSize: String(params.pageSize),
	});
	return unwrap<FetchNoticesResult>(`/api/admin/notices?${query.toString()}`, {
		enabled: params.enabled,
	}, '공지 목록을 불러오지 못했습니다.');
}

export const fetchNotices = fetchNoticeList;

export async function createNotice(draft: NoticeDraft): Promise<Notice> {
	return unwrap<Notice>('/api/admin/notices', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(draft),
	}, '공지를 등록하지 못했습니다.');
}

export async function updateNotice(id: string, draft: NoticeDraft): Promise<Notice> {
	return unwrap<Notice>(`/api/admin/notices/${encodeURIComponent(id)}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(draft),
	}, '공지를 수정하지 못했습니다.');
}

export async function toggleNoticeStatus(id: string, status: NoticeStatus): Promise<Notice> {
	return unwrap<Notice>(`/api/admin/notices/${encodeURIComponent(id)}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ status }),
	}, '공지 상태를 변경하지 못했습니다.');
}

export async function deleteNotice(id: string): Promise<{ id: string }> {
	return unwrap<{ id: string }>(`/api/admin/notices/${encodeURIComponent(id)}`, {
		method: 'DELETE',
	}, '공지를 삭제하지 못했습니다.');
}

export function __resetAdminNoticesMockStore() {
	/* no-op: notices now persist in Prisma */
}
