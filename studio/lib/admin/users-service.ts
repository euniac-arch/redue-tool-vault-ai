import { fetchAdminApi } from '@/lib/admin/admin-api';
import type {
	AdminMember,
	MemberFilters,
	MemberRole,
	MemberSortKey,
	MemberStatus,
	SortDirection,
	UserKpiSummary,
} from './user-management';

export class AdminUserNotFoundError extends Error {
	constructor(id: string) {
		super(`회원(${id})을 찾을 수 없습니다.`);
		this.name = 'AdminUserNotFoundError';
	}
}

export type FetchAdminUsersParams = {
	filters: MemberFilters;
	sortKey: MemberSortKey;
	sortDir: SortDirection;
	page: number;
	pageSize: number;
	enabled?: boolean;
};

export type FetchAdminUsersResult = {
	items: AdminMember[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
	kpi?: UserKpiSummary;
};

async function unwrap<T>(url: string, init?: RequestInit & { enabled?: boolean }, fallback = '요청에 실패했습니다.'): Promise<T> {
	const result = await fetchAdminApi<T>(url, init);
	if (!result.ok) {
		if (result.status === 404) throw new AdminUserNotFoundError(url);
		throw new Error(result.message || fallback);
	}
	return result.data;
}

export async function fetchAdminUsers(params: FetchAdminUsersParams): Promise<FetchAdminUsersResult> {
	const query = new URLSearchParams({
		q: params.filters.query,
		plan: params.filters.plan,
		provider: params.filters.provider,
		status: params.filters.status,
		sortKey: params.sortKey,
		sortDir: params.sortDir,
		page: String(params.page),
		pageSize: String(params.pageSize),
	});
	return unwrap<FetchAdminUsersResult>(`/api/admin/users?${query.toString()}`, {
		enabled: params.enabled,
	}, '회원 목록을 불러오지 못했습니다.');
}

export async function updateUserStatus(id: string, status: MemberStatus): Promise<AdminMember> {
	return unwrap<AdminMember>(`/api/admin/users/${encodeURIComponent(id)}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ status }),
	}, '계정 상태를 변경하지 못했습니다.');
}

export async function updateUserRole(id: string, role: MemberRole): Promise<AdminMember> {
	return unwrap<AdminMember>(`/api/admin/users/${encodeURIComponent(id)}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ role }),
	}, '회원 권한을 변경하지 못했습니다.');
}

export async function updateUserMemo(id: string, memo: string): Promise<AdminMember> {
	return unwrap<AdminMember>(`/api/admin/users/${encodeURIComponent(id)}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ memo }),
	}, '메모를 저장하지 못했습니다.');
}

export async function updateUserCredits(id: string, delta: number): Promise<AdminMember> {
	return unwrap<AdminMember>(`/api/admin/users/${encodeURIComponent(id)}/credits`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ delta }),
	}, '크레딧을 변경하지 못했습니다.');
}

export async function deleteUser(id: string): Promise<{ id: string }> {
	return unwrap<{ id: string }>(`/api/admin/users/${encodeURIComponent(id)}`, {
		method: 'DELETE',
	}, '회원을 삭제하지 못했습니다.');
}
