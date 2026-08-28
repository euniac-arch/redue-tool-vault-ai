/**
 * Admin "시스템 운영 및 작업 내역" data-access layer.
 *
 *   fetchSystemLogs     -> GET  /api/admin/system-logs
 *   fetchSystemLogKpi   -> GET  /api/admin/system-logs/kpi
 *   exportSystemLogsCsv -> POST /api/admin/system-logs/export
 *
 * Toggle `USE_MOCK` once the real endpoints exist.
 */
import {
	MOCK_SYSTEM_LOGS,
	cloneSystemLogs,
	filterSystemLogs,
	paginateSystemLogs,
	sortSystemLogs,
	summarizeSystemLogs,
	toSystemLogCsv,
	type SortDirection,
	type SystemLog,
	type SystemLogFilters,
	type SystemLogKpi,
} from './system-log-management';

const USE_MOCK = true;
const MOCK_LATENCY_MS = 280;

function delay<T>(value: T, ms = MOCK_LATENCY_MS): Promise<T> {
	return new Promise((resolve) => {
		setTimeout(() => resolve(value), ms);
	});
}

const logStore: SystemLog[] = cloneSystemLogs(MOCK_SYSTEM_LOGS);

export type FetchSystemLogsParams = {
	filters: SystemLogFilters;
	sortDir: SortDirection;
	page: number;
	pageSize: number;
};

export type FetchSystemLogsResult = {
	items: SystemLog[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
};

/** GET /api/admin/system-logs */
export async function fetchSystemLogs(params: FetchSystemLogsParams): Promise<FetchSystemLogsResult> {
	if (!USE_MOCK) {
		const query = new URLSearchParams({
			q: params.filters.query,
			module: params.filters.module,
			sortDir: params.sortDir,
			page: String(params.page),
			pageSize: String(params.pageSize),
		});
		const res = await fetch(`/api/admin/system-logs?${query.toString()}`);
		if (!res.ok) throw new Error('작업 내역을 불러오지 못했습니다.');
		return res.json();
	}

	const filtered = filterSystemLogs(logStore, params.filters);
	const sorted = sortSystemLogs(filtered, params.sortDir);
	const totalPages = Math.max(1, Math.ceil(sorted.length / params.pageSize));
	const safePage = Math.min(Math.max(1, params.page), totalPages);
	const items = paginateSystemLogs(sorted, safePage, params.pageSize);

	return delay({
		items: cloneSystemLogs(items),
		total: sorted.length,
		page: safePage,
		pageSize: params.pageSize,
		totalPages,
	});
}

/** GET /api/admin/system-logs/kpi */
export async function fetchSystemLogKpi(): Promise<SystemLogKpi> {
	if (!USE_MOCK) {
		const res = await fetch('/api/admin/system-logs/kpi');
		if (!res.ok) throw new Error('작업 통계를 불러오지 못했습니다.');
		return res.json();
	}
	return delay(summarizeSystemLogs(logStore), 160);
}

/** POST /api/admin/system-logs/export — mock CSV download of the current rows. */
export async function exportSystemLogsCsv(rows: SystemLog[]): Promise<{ filename: string }> {
	const filename = `system-logs-${new Date().toISOString().slice(0, 10)}.csv`;
	if (!USE_MOCK) {
		const res = await fetch('/api/admin/system-logs/export', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ids: rows.map((row) => row.id) }),
		});
		if (!res.ok) throw new Error('CSV를 내보내지 못했습니다.');
		const blob = await res.blob();
		downloadBlob(blob, filename);
		return { filename };
	}

	const csv = toSystemLogCsv(rows);
	const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
	downloadBlob(blob, filename);
	return delay({ filename }, 140);
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
