import { fetchAdminApi } from '@/lib/admin/admin-api';
import { toSystemLogCsv, type SortDirection, type SystemLog, type SystemLogFilters, type SystemLogKpi } from './system-log-management';

export type FetchSystemLogsParams = {
	filters: SystemLogFilters;
	sortDir: SortDirection;
	page: number;
	pageSize: number;
	enabled?: boolean;
};

export type FetchSystemLogsResult = {
	items: SystemLog[];
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

export async function fetchSystemLogs(params: FetchSystemLogsParams): Promise<FetchSystemLogsResult> {
	const query = new URLSearchParams({
		q: params.filters.query,
		module: params.filters.module,
		sortDir: params.sortDir,
		page: String(params.page),
		pageSize: String(params.pageSize),
	});
	return unwrap<FetchSystemLogsResult>(`/api/admin/system-logs?${query.toString()}`, {
		enabled: params.enabled,
	}, '작업 내역을 불러오지 못했습니다.');
}

export async function fetchSystemLogKpi(): Promise<SystemLogKpi> {
	return unwrap<SystemLogKpi>('/api/admin/system-logs/kpi', undefined, '작업 통계를 불러오지 못했습니다.');
}

export async function exportSystemLogsCsv(rows: SystemLog[]): Promise<{ filename: string }> {
	const filename = `system-logs-${new Date().toISOString().slice(0, 10)}.csv`;
	const result = await fetch('/api/admin/system-logs/export', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'same-origin',
		body: JSON.stringify({ ids: rows.map((row) => row.id) }),
	});
	if (!result.ok) {
		const csv = toSystemLogCsv(rows);
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
