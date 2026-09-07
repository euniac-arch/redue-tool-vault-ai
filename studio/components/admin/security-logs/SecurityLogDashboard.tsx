'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Loader2, RefreshCw, Search, TriangleAlert } from 'lucide-react';
import {
	EMPTY_SECURITY_LOG_KPI,
	EVENT_TYPE_LABEL,
	GUEST_EMAIL,
	PAGE_SIZE,
	SECURITY_EVENT_TYPES,
	formatIpCountry,
	formatTimestamp,
	type SecurityEventType,
	type SecurityLog,
	type SecurityLogFilters,
	type SecurityLogKpi,
	type SecurityLogStatus,
} from '@/lib/admin/security-log-management';
import { exportSecurityLogsCsv, fetchSecurityKpi, fetchSecurityLogs } from '@/lib/admin/security-log-service';
import { useAdminSession } from '@/lib/admin/use-admin-session';
import { SecurityLogKpiCards } from './SecurityLogKpiCards';
import { LogEventBadge, LogStatusBadge } from './security-log-badges';

const STATUS_OPTIONS: { value: SecurityLogFilters['status']; label: string }[] = [
	{ value: 'all', label: '전체' },
	{ value: 'SUCCESS', label: '성공' },
	{ value: 'FAIL', label: '실패' },
	{ value: 'WARNING', label: '의심' },
];

const SELECT_CLASS =
	'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10';

type Toast = { id: number; message: string; tone?: 'default' | 'error' };

function TableSkeleton() {
	return (
		<>
			{Array.from({ length: 8 }).map((_, index) => (
				<tr key={`skel-${index}`} className="border-b border-slate-100 last:border-0">
					{Array.from({ length: 7 }).map((__, cell) => (
						<td key={cell} className="px-4 py-3">
							<div className="h-3.5 w-full max-w-[9rem] animate-pulse rounded bg-slate-100" />
						</td>
					))}
				</tr>
			))}
		</>
	);
}

export function SecurityLogDashboard() {
	const { canFetchAdmin } = useAdminSession();
	const [kpi, setKpi] = useState<SecurityLogKpi>(EMPTY_SECURITY_LOG_KPI);
	const [kpiLoading, setKpiLoading] = useState(true);
	const [items, setItems] = useState<SecurityLog[]>([]);
	const [total, setTotal] = useState(0);
	const [totalPages, setTotalPages] = useState(1);
	const [loading, setLoading] = useState(true);
	const [exporting, setExporting] = useState(false);
	const [query, setQuery] = useState('');
	const [eventType, setEventType] = useState<SecurityLogFilters['eventType']>('all');
	const [status, setStatus] = useState<SecurityLogFilters['status']>('all');
	const [from, setFrom] = useState('');
	const [to, setTo] = useState('');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
	const [page, setPage] = useState(1);
	const [toasts, setToasts] = useState<Toast[]>([]);
	const requestIdRef = useRef(0);

	const filters: SecurityLogFilters = useMemo(
		() => ({ query, eventType, status, from, to }),
		[query, eventType, status, from, to],
	);

	const pushToast = useCallback((message: string, tone: Toast['tone'] = 'default') => {
		const id = Date.now() + Math.random();
		setToasts((prev) => [...prev, { id, message, tone }]);
		window.setTimeout(() => {
			setToasts((prev) => prev.filter((item) => item.id !== id));
		}, 2400);
	}, []);

	const reloadKpi = useCallback(async () => {
		if (!canFetchAdmin) return;
		setKpiLoading(true);
		try {
			setKpi(await fetchSecurityKpi(canFetchAdmin));
		} catch {
			setKpi(EMPTY_SECURITY_LOG_KPI);
		} finally {
			setKpiLoading(false);
		}
	}, [canFetchAdmin]);

	const reload = useCallback(async () => {
		if (!canFetchAdmin) return;
		const requestId = ++requestIdRef.current;
		setLoading(true);
		try {
			const result = await fetchSecurityLogs({
				filters,
				sortDir,
				page,
				pageSize: PAGE_SIZE,
				enabled: canFetchAdmin,
			});
			if (requestId !== requestIdRef.current) return;
			setItems(result.items);
			setTotal(result.total);
			setTotalPages(result.totalPages);
			if (result.page !== page) setPage(result.page);
		} catch (error) {
			if (requestId !== requestIdRef.current) return;
			pushToast(error instanceof Error ? error.message : '접속 로그를 불러오지 못했습니다.', 'error');
		} finally {
			if (requestId === requestIdRef.current) setLoading(false);
		}
	}, [canFetchAdmin, filters, sortDir, page, pushToast]);

	useEffect(() => {
		void reloadKpi();
	}, [reloadKpi]);

	useEffect(() => {
		void reload();
	}, [reload]);

	useEffect(() => {
		setPage(1);
	}, [query, eventType, status, from, to]);

	const handleRefresh = useCallback(() => {
		void reloadKpi();
		void reload();
	}, [reload, reloadKpi]);

	const handleExport = useCallback(async () => {
		setExporting(true);
		try {
			const { filename } = await exportSecurityLogsCsv(items);
			pushToast(`${filename} 다운로드를 시작합니다. (현재 페이지 · ${items.length}건)`);
		} catch (error) {
			pushToast(error instanceof Error ? error.message : 'CSV 내보내기에 실패했습니다.', 'error');
		} finally {
			setExporting(false);
		}
	}, [items, pushToast]);

	const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
	const rangeEnd = Math.min(page * PAGE_SIZE, total);

	return (
		<div className="flex flex-col gap-5">
			<SecurityLogKpiCards kpi={kpi} loading={kpiLoading} />

			<section className="rounded-xl border border-slate-200 bg-white shadow-sm">
				<div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						<div className="relative min-w-0 flex-1">
							<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
							<input
								type="search"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder="IP 주소 / 계정 이메일 / 상세 검색"
								className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
							/>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<label className="flex items-center gap-1.5">
								<span className="hidden text-[11px] font-semibold text-slate-400 sm:inline">이벤트</span>
								<select
									className={SELECT_CLASS}
									value={eventType}
									onChange={(event) => setEventType(event.target.value as SecurityLogFilters['eventType'])}
									aria-label="이벤트 유형 필터"
								>
									<option value="all">전체 이벤트</option>
									{SECURITY_EVENT_TYPES.map((value) => (
										<option key={value} value={value}>
											{EVENT_TYPE_LABEL[value as SecurityEventType]}
										</option>
									))}
								</select>
							</label>
							<label className="flex items-center gap-1.5">
								<span className="hidden text-[11px] font-semibold text-slate-400 sm:inline">상태</span>
								<select
									className={SELECT_CLASS}
									value={status}
									onChange={(event) => setStatus(event.target.value as SecurityLogFilters['status'])}
									aria-label="상태 필터"
								>
									{STATUS_OPTIONS.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</label>
							<button
								type="button"
								onClick={handleRefresh}
								className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
							>
								<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
								새로고침
							</button>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<label className="flex items-center gap-1.5">
							<span className="text-[11px] font-semibold text-slate-400">시작일</span>
							<input
								type="date"
								value={from}
								onChange={(event) => setFrom(event.target.value)}
								className={SELECT_CLASS}
								aria-label="시작일"
							/>
						</label>
						<label className="flex items-center gap-1.5">
							<span className="text-[11px] font-semibold text-slate-400">종료일</span>
							<input
								type="date"
								value={to}
								onChange={(event) => setTo(event.target.value)}
								className={SELECT_CLASS}
								aria-label="종료일"
							/>
						</label>
						<button
							type="button"
							onClick={() => setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
							className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
						>
							{sortDir === 'desc' ? '최신순' : '오래된순'}
						</button>
						<button
							type="button"
							disabled={exporting || items.length === 0}
							onClick={handleExport}
							className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
							로그 내보내기 (CSV)
						</button>
					</div>
				</div>

				<div className="overflow-x-auto">
					<table className="w-full min-w-[1080px] text-left text-sm">
						<thead>
							<tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
								<th className="px-4 py-3 font-semibold">일시</th>
								<th className="px-4 py-3 font-semibold">이벤트</th>
								<th className="px-4 py-3 font-semibold">사용자</th>
								<th className="px-4 py-3 font-semibold">IP / 국가</th>
								<th className="px-4 py-3 font-semibold">브라우저/기기</th>
								<th className="px-4 py-3 font-semibold">상태</th>
								<th className="px-4 py-3 font-semibold">상세</th>
							</tr>
						</thead>
						<tbody>
							{loading ? (
								<TableSkeleton />
							) : items.length === 0 ? (
								<tr>
									<td colSpan={7} className="px-4 py-16 text-center">
										<div className="mx-auto flex max-w-sm flex-col items-center gap-2">
											<p className="text-sm font-semibold text-slate-800">조건에 맞는 접속 로그가 없습니다</p>
											<p className="text-xs text-slate-500">
												로그인, 관리자 접근, API 쿼터 이벤트가 발생하면 이곳에 자동으로 쌓입니다.
											</p>
										</div>
									</td>
								</tr>
							) : (
								items.map((log) => (
									<tr
										key={log.id}
										className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/80 ${
											log.status === 'FAIL' ? 'bg-rose-50/30' : ''
										}`}
									>
										<td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] tabular-nums text-slate-500">
											{formatTimestamp(log.timestamp)}
										</td>
										<td className="px-4 py-3">
											<LogEventBadge eventType={log.eventType} />
										</td>
										<td className="px-4 py-3">
											<p
												className={`truncate text-xs font-medium ${
													log.userEmail === GUEST_EMAIL ? 'italic text-slate-400' : 'text-slate-800'
												}`}
											>
												{log.userEmail}
											</p>
										</td>
										<td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700">
											{formatIpCountry(log.ipAddress, log.country)}
										</td>
										<td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{log.device}</td>
										<td className="px-4 py-3">
											<LogStatusBadge status={log.status as SecurityLogStatus} />
										</td>
										<td className="max-w-[22rem] px-4 py-3 text-xs text-slate-600">
											<p className="truncate" title={log.details}>
												{log.details || '-'}
											</p>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
					<p className="text-xs text-slate-500">
						{total.toLocaleString('ko-KR')}건 중 {rangeStart}–{rangeEnd}
					</p>
					<div className="flex items-center gap-1.5">
						<button
							type="button"
							disabled={page <= 1}
							onClick={() => setPage((prev) => Math.max(1, prev - 1))}
							className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
						>
							<ChevronLeft className="h-3.5 w-3.5" />
							이전
						</button>
						<span className="min-w-[4.5rem] text-center text-xs font-semibold text-slate-600">
							{page} / {totalPages}
						</span>
						<button
							type="button"
							disabled={page >= totalPages}
							onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
							className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
						>
							다음
							<ChevronRight className="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			</section>

			{toasts.length > 0 && (
				<div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
					{toasts.map((toast) => (
						<div
							key={toast.id}
							className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-lg ${
								toast.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-700'
							}`}
						>
							{toast.tone === 'error' && <TriangleAlert className="h-3.5 w-3.5" />}
							{toast.message}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
