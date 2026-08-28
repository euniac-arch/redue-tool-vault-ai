/**
 * Admin "보안 및 접속 로그 관리" data-access layer.
 *
 * This module is the single seam between the UI (`SecurityLogDashboard`)
 * and the auth/audit-log data source. Swapping the mock implementation for
 * real HTTP calls only requires editing this file:
 *
 *   fetchSecurityLogs  -> GET /api/admin/security-logs
 *   fetchSecurityKpi   -> GET /api/admin/security-logs/kpi
 *   exportSecurityLogsCsv -> GET /api/admin/security-logs/export (CSV stream)
 *
 * Toggle `USE_MOCK` (or wire it to an env flag) once the real endpoints
 * exist.
 */
import {
	MOCK_SECURITY_LOGS,
	SECURITY_LOG_KPI_MOCK,
	cloneSecurityLogs,
	filterSecurityLogs,
	paginateSecurityLogs,
	sortSecurityLogs,
	toCsv,
	type SecurityLog,
	type SecurityLogFilters,
	type SecurityLogKpi,
	type SortDirection,
} from './security-log-management';

const USE_MOCK = true;
const MOCK_LATENCY_MS = 300;

function delay<T>(value: T, ms = MOCK_LATENCY_MS): Promise<T> {
	return new Promise((resolve) => {
		setTimeout(() => resolve(value), ms);
	});
}

const logStore: SecurityLog[] = cloneSecurityLogs(MOCK_SECURITY_LOGS);

export type FetchSecurityLogsParams = {
	filters: SecurityLogFilters;
	sortDir: SortDirection;
	page: number;
	pageSize: number;
};

export type FetchSecurityLogsResult = {
	items: SecurityLog[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
};

/** GET /api/admin/security-logs — paginated, filtered, sorted access log list. */
export async function fetchSecurityLogs(params: FetchSecurityLogsParams): Promise<FetchSecurityLogsResult> {
	if (!USE_MOCK) {
		const query = new URLSearchParams({
			q: params.filters.query,
			severity: params.filters.severity,
			sortDir: params.sortDir,
			page: String(params.page),
			pageSize: String(params.pageSize),
		});
		const res = await fetch(`/api/admin/security-logs?${query.toString()}`);
		if (!res.ok) throw new Error('접속 로그를 불러오지 못했습니다.');
		return res.json();
	}

	const filtered = filterSecurityLogs(logStore, params.filters);
	const sorted = sortSecurityLogs(filtered, params.sortDir);
	const totalPages = Math.max(1, Math.ceil(sorted.length / params.pageSize));
	const safePage = Math.min(Math.max(1, params.page), totalPages);
	const items = paginateSecurityLogs(sorted, safePage, params.pageSize);

	return delay({
		items: cloneSecurityLogs(items),
		total: sorted.length,
		page: safePage,
		pageSize: params.pageSize,
		totalPages,
	});
}

/** GET /api/admin/security-logs/kpi — today's login/abnormal/blocked-IP summary. */
export async function fetchSecurityKpi(): Promise<SecurityLogKpi> {
	if (!USE_MOCK) {
		const res = await fetch('/api/admin/security-logs/kpi');
		if (!res.ok) throw new Error('보안 통계를 불러오지 못했습니다.');
		return res.json();
	}
	return delay({ ...SECURITY_LOG_KPI_MOCK }, 200);
}

/**
 * GET /api/admin/security-logs/export — CSV export of the (already
 * filtered) rows currently shown in the dashboard. Mock implementation
 * builds the CSV client-side and triggers a browser download.
 */
export async function exportSecurityLogsCsv(rows: SecurityLog[]): Promise<{ filename: string }> {
	const filename = `security-logs-${new Date().toISOString().slice(0, 10)}.csv`;
	if (!USE_MOCK) {
		const res = await fetch('/api/admin/security-logs/export', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ids: rows.map((row) => row.id) }),
		});
		if (!res.ok) throw new Error('CSV를 내보내지 못했습니다.');
		const blob = await res.blob();
		downloadBlob(blob, filename);
		return { filename };
	}

	const csv = toCsv(rows);
	const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
	downloadBlob(blob, filename);
	return delay({ filename }, 150);
}

function downloadBlob(blob: Blob, filename: string) {
	if (typeof document === 'undefined') return;
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}
