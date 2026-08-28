/**
 * Admin "공지사항 및 시스템 알림 관리" data-access layer.
 *
 * This module is the single seam between the UI (`NoticeManagementDashboard`)
 * and the notice data source. Every read/write goes through the functions
 * below instead of touching the mock array directly, so swapping the mock
 * implementation for real HTTP calls only requires editing this file:
 *
 *   fetchNoticeList    -> GET    /api/admin/notices
 *   fetchNotices       -> GET    /api/admin/notices  (alias)
 *   createNotice       -> POST   /api/admin/notices
 *   updateNotice       -> PATCH  /api/admin/notices/:id
 *   toggleNoticeStatus -> PATCH  /api/admin/notices/:id  { status }
 *   deleteNotice       -> DELETE /api/admin/notices/:id
 *
 * Toggle `USE_MOCK` (or wire it to an env flag) once the real endpoints
 * exist. The mock branch simulates network latency and mutates an
 * in-memory store so the dashboard behaves exactly like it would against a
 * real backend.
 */
import {
	MOCK_NOTICES,
	cloneNotices,
	filterNotices,
	nowAsCreatedAt,
	paginateNotices,
	sortNotices,
	type Notice,
	type NoticeDraft,
	type NoticeFilters,
	type NoticeSortKey,
	type NoticeStatus,
	type SortDirection,
} from './notice-management';

const USE_MOCK = true;
const MOCK_LATENCY_MS = 300;

function delay<T>(value: T, ms = MOCK_LATENCY_MS): Promise<T> {
	return new Promise((resolve) => {
		setTimeout(() => resolve(value), ms);
	});
}

let noticeStore: Notice[] = cloneNotices(MOCK_NOTICES);
let nextSeq = noticeStore.length + 1;

/** Test-only escape hatch to reset the mock store between test runs. */
export function __resetAdminNoticesMockStore() {
	noticeStore = cloneNotices(MOCK_NOTICES);
	nextSeq = noticeStore.length + 1;
}

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
};

export type FetchNoticesResult = {
	items: Notice[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
};

/** GET /api/admin/notices — paginated, filtered, sorted notice list. */
export async function fetchNoticeList(params: FetchNoticesParams): Promise<FetchNoticesResult> {
	if (!USE_MOCK) {
		const query = new URLSearchParams({
			q: params.filters.query,
			type: params.filters.type,
			status: params.filters.status,
			sortKey: params.sortKey,
			sortDir: params.sortDir,
			page: String(params.page),
			pageSize: String(params.pageSize),
		});
		const res = await fetch(`/api/admin/notices?${query.toString()}`);
		if (!res.ok) throw new Error('공지 목록을 불러오지 못했습니다.');
		return res.json();
	}

	const filtered = filterNotices(noticeStore, params.filters);
	const sorted = sortNotices(filtered, params.sortKey, params.sortDir);
	const totalPages = Math.max(1, Math.ceil(sorted.length / params.pageSize));
	const safePage = Math.min(Math.max(1, params.page), totalPages);
	const items = paginateNotices(sorted, safePage, params.pageSize);

	return delay({
		items: cloneNotices(items),
		total: sorted.length,
		page: safePage,
		pageSize: params.pageSize,
		totalPages,
	});
}

/** @deprecated Prefer `fetchNoticeList`. Kept so existing callers keep compiling. */
export const fetchNotices = fetchNoticeList;

function mutateNotice(id: string, updater: (notice: Notice) => Notice): Notice {
	const index = noticeStore.findIndex((notice) => notice.id === id);
	if (index === -1) throw new AdminNoticeNotFoundError(id);
	const updated = updater(noticeStore[index]);
	noticeStore = [...noticeStore.slice(0, index), updated, ...noticeStore.slice(index + 1)];
	return updated;
}

/** POST /api/admin/notices — create a new notice (draft or published). */
export async function createNotice(draft: NoticeDraft): Promise<Notice> {
	if (!USE_MOCK) {
		const res = await fetch('/api/admin/notices', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(draft),
		});
		if (!res.ok) throw new Error('공지를 등록하지 못했습니다.');
		return res.json();
	}

	const created: Notice = {
		...draft,
		id: `NTC-${2031 + nextSeq++}`,
		createdAt: nowAsCreatedAt(),
	};
	noticeStore = [created, ...noticeStore];
	return delay({ ...created });
}

/** PATCH /api/admin/notices/:id — update an existing notice's fields. */
export async function updateNotice(id: string, draft: NoticeDraft): Promise<Notice> {
	if (!USE_MOCK) {
		const res = await fetch(`/api/admin/notices/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(draft),
		});
		if (!res.ok) throw new Error('공지를 수정하지 못했습니다.');
		return res.json();
	}

	const updated = mutateNotice(id, (notice) => ({ ...notice, ...draft }));
	return delay(cloneNotices([updated])[0]);
}

/** PATCH /api/admin/notices/:id  { status } — publish / unpublish toggle. */
export async function toggleNoticeStatus(id: string, status: NoticeStatus): Promise<Notice> {
	if (!USE_MOCK) {
		const res = await fetch(`/api/admin/notices/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status }),
		});
		if (!res.ok) throw new Error('공지 상태를 변경하지 못했습니다.');
		return res.json();
	}

	const updated = mutateNotice(id, (notice) => ({ ...notice, status }));
	return delay(cloneNotices([updated])[0], 180);
}

/** DELETE /api/admin/notices/:id — permanently remove a notice. */
export async function deleteNotice(id: string): Promise<{ id: string }> {
	if (!USE_MOCK) {
		const res = await fetch(`/api/admin/notices/${id}`, { method: 'DELETE' });
		if (!res.ok) throw new Error('공지를 삭제하지 못했습니다.');
		return res.json();
	}

	const exists = noticeStore.some((notice) => notice.id === id);
	if (!exists) throw new AdminNoticeNotFoundError(id);
	noticeStore = noticeStore.filter((notice) => notice.id !== id);
	return delay({ id });
}
