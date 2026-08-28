/**
 * Quiet admin API helper. 401/403 are not thrown as generic Errors so
 * pollers can stop without flooding the console. Callers must gate with
 * `canFetchAdmin` / `enabled: true` so unauthenticated pages never hit
 * these endpoints.
 */

export type AdminApiResult<T> =
	| { ok: true; data: T }
	| { ok: false; status: number; forbidden: boolean; unauthorized: boolean; message: string };

export type AdminApiInit = RequestInit & {
	/** When false (or omitted for `/api/admin/logs`), the request is not sent. */
	enabled?: boolean;
};

export function isAdminForbiddenStatus(status: number): boolean {
	return status === 401 || status === 403;
}

function isAdminLogsUrl(url: string): boolean {
	return url === '/api/admin/logs' || url.startsWith('/api/admin/logs?');
}

function isBrowserPublicOrNonAdminPath(): boolean {
	if (typeof window === 'undefined') return true;
	const pathname = window.location.pathname || '';
	if (!pathname || pathname === '/') return true;
	if (pathname === '/login' || pathname.startsWith('/login/')) return true;
	if (pathname === '/auth' || pathname.startsWith('/auth/')) return true;
	return pathname !== '/admin' && !pathname.startsWith('/admin/');
}

function skippedResult(message: string): AdminApiResult<never> {
	return {
		ok: false,
		status: 0,
		forbidden: true,
		unauthorized: false,
		message,
	};
}

export async function fetchAdminApi<T>(url: string, init?: AdminApiInit): Promise<AdminApiResult<T>> {
	const { enabled, ...requestInit } = init ?? {};

	if (enabled === false) {
		return skippedResult('관리자 세션이 준비되지 않았습니다.');
	}

	// `/api/admin/logs` is polled; never send it unless the caller opted in
	// AND the browser is actually on an admin route.
	if (isAdminLogsUrl(url)) {
		if (enabled !== true) {
			return skippedResult('관리자 세션이 준비되지 않았습니다.');
		}
		if (isBrowserPublicOrNonAdminPath()) {
			return skippedResult('관리자 페이지에서만 조회할 수 있습니다.');
		}
	}

	const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin', ...requestInit });
	const body = (await res.json().catch(() => ({}))) as { error?: string } & T;

	if (isAdminForbiddenStatus(res.status)) {
		return {
			ok: false,
			status: res.status,
			forbidden: true,
			unauthorized: res.status === 401,
			message: typeof body.error === 'string' ? body.error : '권한이 없습니다.',
		};
	}

	if (!res.ok) {
		return {
			ok: false,
			status: res.status,
			forbidden: false,
			unauthorized: false,
			message: typeof body.error === 'string' ? body.error : `요청에 실패했습니다. (${res.status})`,
		};
	}

	return { ok: true, data: body as T };
}
