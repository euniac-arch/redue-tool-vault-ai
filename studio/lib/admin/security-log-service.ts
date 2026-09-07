/**
 * Admin "보안 및 접속 로그 관리" data-access layer.
 */
import { fetchAdminApi } from '@/lib/admin/admin-api';
import {
	toCsv,
	type SecurityLog,
	type SecurityLogFilters,
	type SecurityLogKpi,
	type SortDirection,
} from './security-log-management';

export type FetchSecurityLogsParams = {
	filters: SecurityLogFilters;
	sortDir: SortDirection;
	page: number;
	pageSize: number;
	enabled?: boolean;
};

export type FetchSecurityLogsResult = {
	items: SecurityLog[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
};

async function unwrap<T>(url: string, init?: RequestInit & { enabled?: boolean }, fallback = '요청에 실패했습니다.'): Promise<T> {
	const result = await fetchAdminApi<T>(url, init);
	if (!result.ok) throw new Error(result.message || fallback);
	return result.data;
}

export async function fetchSecurityLogs(params: FetchSecurityLogsParams): Promise<FetchSecurityLogsResult> {
	const query = new URLSearchParams({
		q: params.filters.query,
		eventType: params.filters.eventType,
		status: params.filters.status,
		from: params.filters.from,
		to: params.filters.to,
		sortDir: params.sortDir,
		page: String(params.page),
		pageSize: String(params.pageSize),
	});
	return unwrap<FetchSecurityLogsResult>(
		`/api/admin/security-logs?${query.toString()}`,
		{ enabled: params.enabled },
		'접속 로그를 불러오지 못했습니다.',
	);
}

export async function fetchSecurityKpi(enabled?: boolean): Promise<SecurityLogKpi> {
	return unwrap<SecurityLogKpi>('/api/admin/security-logs/kpi', { enabled }, '보안 통계를 불러오지 못했습니다.');
}

export async function exportSecurityLogsCsv(rows: SecurityLog[]): Promise<{ filename: string }> {
	const filename = `security-logs-${new Date().toISOString().slice(0, 10)}.csv`;
	const result = await fetch('/api/admin/security-logs/export', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'same-origin',
		body: JSON.stringify({ ids: rows.map((row) => row.id) }),
	});
	if (!result.ok) {
		const csv = toCsv(rows);
		downloadBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }), filename);
		return { filename };
	}
	const blob = await result.blob();
	downloadBlob(blob, filename);
	return { filename };
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
