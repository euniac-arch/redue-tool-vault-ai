/**
 * Admin "회원관리" data-access layer.
 *
 * This module is the single seam between the UI (`UserManagementDashboard`)
 * and the member data source. Every read/write goes through the functions
 * below instead of touching the mock array directly, so that once Kakao /
 * Google social login is wired to Prisma, swapping the mock implementation
 * for real HTTP calls only requires editing this file:
 *
 *   fetchAdminUsers   -> GET   /api/admin/users
 *   updateUserStatus  -> PATCH /api/admin/users/:id   { status }
 *   updateUserRole    -> PATCH /api/admin/users/:id   { role }
 *   updateUserMemo    -> PATCH /api/admin/users/:id   { memo }
 *   updateUserCredits -> POST  /api/admin/users/:id/credits { delta }
 *   deleteUser        -> DELETE /api/admin/users/:id
 *
 * Toggle `USE_MOCK` (or wire it to an env flag) once the real endpoints
 * exist. The mock branch simulates network latency and mutates an
 * in-memory store so the dashboard behaves exactly like it would against a
 * real backend (loading states, optimistic-safe updates, 404s, etc).
 */
import {
	MOCK_ADMIN_MEMBERS,
	cloneMembers,
	filterMembers,
	paginateMembers,
	sortMembers,
	type AdminMember,
	type MemberFilters,
	type MemberRole,
	type MemberSortKey,
	type MemberStatus,
	type SortDirection,
} from './user-management';

const USE_MOCK = true;
const MOCK_LATENCY_MS = 350;

function delay<T>(value: T, ms = MOCK_LATENCY_MS): Promise<T> {
	return new Promise((resolve) => {
		setTimeout(() => resolve(value), ms);
	});
}

/** In-memory "database". Replace with real fetches once the API ships. */
let memberStore: AdminMember[] = cloneMembers(MOCK_ADMIN_MEMBERS);

/** Test-only escape hatch to reset the mock store between test runs. */
export function __resetAdminUsersMockStore() {
	memberStore = cloneMembers(MOCK_ADMIN_MEMBERS);
}

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
};

export type FetchAdminUsersResult = {
	items: AdminMember[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
};

/** GET /api/admin/users — paginated, filtered, sorted member list. */
export async function fetchAdminUsers(params: FetchAdminUsersParams): Promise<FetchAdminUsersResult> {
	if (!USE_MOCK) {
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
		const res = await fetch(`/api/admin/users?${query.toString()}`);
		if (!res.ok) throw new Error('회원 목록을 불러오지 못했습니다.');
		return res.json();
	}

	const filtered = filterMembers(memberStore, params.filters);
	const sorted = sortMembers(filtered, params.sortKey, params.sortDir);
	const totalPages = Math.max(1, Math.ceil(sorted.length / params.pageSize));
	const safePage = Math.min(Math.max(1, params.page), totalPages);
	const items = paginateMembers(sorted, safePage, params.pageSize);

	return delay({
		items: cloneMembers(items),
		total: sorted.length,
		page: safePage,
		pageSize: params.pageSize,
		totalPages,
	});
}

function mutateMember(id: string, updater: (member: AdminMember) => AdminMember): AdminMember {
	const index = memberStore.findIndex((member) => member.id === id);
	if (index === -1) throw new AdminUserNotFoundError(id);
	const updated = updater(memberStore[index]);
	memberStore = [...memberStore.slice(0, index), updated, ...memberStore.slice(index + 1)];
	return updated;
}

/** PATCH /api/admin/users/:id  { status } — suspend / reinstate / withdraw. */
export async function updateUserStatus(id: string, status: MemberStatus): Promise<AdminMember> {
	if (!USE_MOCK) {
		const res = await fetch(`/api/admin/users/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status }),
		});
		if (!res.ok) throw new Error('계정 상태를 변경하지 못했습니다.');
		return res.json();
	}

	const updated = mutateMember(id, (member) => ({ ...member, status }));
	return delay(cloneMembers([updated])[0]);
}

/** PATCH /api/admin/users/:id  { role } — promote / demote admin access. */
export async function updateUserRole(id: string, role: MemberRole): Promise<AdminMember> {
	if (!USE_MOCK) {
		const res = await fetch(`/api/admin/users/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ role }),
		});
		if (!res.ok) throw new Error('회원 권한을 변경하지 못했습니다.');
		return res.json();
	}

	const updated = mutateMember(id, (member) => ({ ...member, role }));
	return delay(cloneMembers([updated])[0]);
}

/** PATCH /api/admin/users/:id  { memo } — admin-only operational note. */
export async function updateUserMemo(id: string, memo: string): Promise<AdminMember> {
	if (!USE_MOCK) {
		const res = await fetch(`/api/admin/users/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ memo }),
		});
		if (!res.ok) throw new Error('메모를 저장하지 못했습니다.');
		return res.json();
	}

	const updated = mutateMember(id, (member) => ({ ...member, memo }));
	return delay(cloneMembers([updated])[0], 200);
}

/** POST /api/admin/users/:id/credits  { delta } — manual credit grant/reclaim. */
export async function updateUserCredits(id: string, delta: number): Promise<AdminMember> {
	if (!USE_MOCK) {
		const res = await fetch(`/api/admin/users/${id}/credits`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ delta }),
		});
		if (!res.ok) throw new Error('크레딧을 변경하지 못했습니다.');
		return res.json();
	}

	const updated = mutateMember(id, (member) => {
		const nextRemaining = Math.max(0, member.credits_remaining + delta);
		const nextTotal = Math.max(member.credits_total, nextRemaining);
		return { ...member, credits_remaining: nextRemaining, credits_total: nextTotal };
	});
	return delay(cloneMembers([updated])[0]);
}

/** DELETE /api/admin/users/:id — permanently remove a member record. */
export async function deleteUser(id: string): Promise<{ id: string }> {
	if (!USE_MOCK) {
		const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
		if (!res.ok) throw new Error('회원을 삭제하지 못했습니다.');
		return res.json();
	}

	const exists = memberStore.some((member) => member.id === id);
	if (!exists) throw new AdminUserNotFoundError(id);
	memberStore = memberStore.filter((member) => member.id !== id);
	return delay({ id });
}
