/**
 * Admin "진단 이력 및 리포트 조회" data-access layer.
 *
 *   fetchDiagnosticHistory -> GET  /api/admin/diagnostics
 *   fetchDiagnosticDetail  -> GET  /api/admin/diagnostics/:id
 *   rerunDiagnostic        -> POST /api/admin/diagnostics/:id/rerun
 */
import { fromKpiSummary, type DiagnosticDetail, type DiagnosticFilters, type DiagnosticKpi, type DiagnosticPageSize, type DiagnosticRecord, type DiagnosticSortBy } from './diagnostic-management';

export class DiagnosticNotFoundError extends Error {
	constructor(id: string) {
		super(`진단 이력(${id})을 찾을 수 없습니다.`);
		this.name = 'DiagnosticNotFoundError';
	}
}

export type FetchDiagnosticHistoryParams = {
	filters: DiagnosticFilters;
	page: number;
	pageSize: DiagnosticPageSize;
	sortBy?: DiagnosticSortBy;
};

export type FetchDiagnosticHistoryResult = {
	items: DiagnosticRecord[];
	total: number;
	totalCount: number;
	page: number;
	pageSize: number;
	totalPages: number;
	kpi: DiagnosticKpi;
	kpiSummary: {
		totalCount: number;
		todayCount: number;
		avgGeoScore: number;
		reportCount: number;
	};
};

async function readError(res: Response, fallback: string): Promise<string> {
	try {
		const body = (await res.json()) as { error?: string };
		if (body?.error) return body.error;
	} catch {
		// ignore
	}
	return fallback;
}

/** GET /api/admin/diagnostics */
export async function fetchDiagnosticHistory(
	params: FetchDiagnosticHistoryParams,
): Promise<FetchDiagnosticHistoryResult> {
	const query = new URLSearchParams({
		search: params.filters.query,
		category: params.filters.category,
		status: params.filters.status,
		period: params.filters.period,
		page: String(params.page),
		limit: String(params.pageSize),
		sortBy: params.sortBy || 'createdAt:desc',
	});
	const res = await fetch(`/api/admin/diagnostics?${query.toString()}`, { cache: 'no-store' });
	if (!res.ok) throw new Error(await readError(res, '진단 이력을 불러오지 못했습니다.'));
	const data = (await res.json()) as {
		items?: DiagnosticRecord[];
		totalCount?: number;
		total?: number;
		page?: number;
		pageSize?: number;
		totalPages?: number;
		kpiSummary?: FetchDiagnosticHistoryResult['kpiSummary'];
		kpi?: DiagnosticKpi;
	};
	const kpiSummary = data.kpiSummary || {
		totalCount: data.kpi?.totalCount ?? 0,
		todayCount: data.kpi?.todayCount ?? 0,
		avgGeoScore: data.kpi?.averageGeoScore ?? 0,
		reportCount: data.kpi?.prescriptionCount ?? 0,
	};
	const totalCount = Number(data.totalCount ?? data.total ?? 0);
	return {
		items: Array.isArray(data.items) ? data.items : [],
		total: totalCount,
		totalCount,
		page: Number(data.page) || params.page,
		pageSize: Number(data.pageSize) || params.pageSize,
		totalPages: Number(data.totalPages) || 1,
		kpi: fromKpiSummary(kpiSummary),
		kpiSummary,
	};
}

/** GET /api/admin/diagnostics/:id */
export async function fetchDiagnosticDetail(id: string): Promise<DiagnosticDetail> {
	const res = await fetch(`/api/admin/diagnostics/${encodeURIComponent(id)}`, { cache: 'no-store' });
	if (res.status === 404) throw new DiagnosticNotFoundError(id);
	if (!res.ok) throw new Error(await readError(res, '진단 리포트를 불러오지 못했습니다.'));
	return res.json();
}

/** POST /api/admin/diagnostics/:id/rerun — path is the record id; body.domain is optional host/URL. */
export async function rerunDiagnostic(
	id: string,
	opts?: { domain?: string },
): Promise<DiagnosticDetail> {
	const res = await fetch(`/api/admin/diagnostics/${encodeURIComponent(id)}/rerun`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		cache: 'no-store',
		body: JSON.stringify({ domain: opts?.domain || undefined }),
	});
	if (res.status === 404) throw new DiagnosticNotFoundError(id);
	if (!res.ok) throw new Error(await readError(res, '재진단을 실행하지 못했습니다.'));
	return res.json();
}

export type {
	DiagnosticDetail,
	DiagnosticFilters,
	DiagnosticKpi,
	DiagnosticPageSize,
	DiagnosticRecord,
};
