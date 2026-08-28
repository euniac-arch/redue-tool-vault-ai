'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Loader2, Search, TriangleAlert } from 'lucide-react';
import {
	SECURITY_LOG_KPI_MOCK,
	formatTimestamp,
	type SecurityLog,
	type SecurityLogFilters,
	type SecurityLogKpi,
} from '@/lib/admin/security-log-management';
import { exportSecurityLogsCsv, fetchSecurityKpi, fetchSecurityLogs } from '@/lib/admin/security-log-service';
import { SecurityLogKpiCards } from './SecurityLogKpiCards';
import { LogActionBadge, LogOutcomeBadge, SeverityBadge } from './security-log-badges';

const SEVERITY_OPTIONS: { value: SecurityLogFilters['severity']; label: string }[] = [
	{ value: 'all', label: '전체' },
	{ value: 'info', label: '정상' },
	{ value: 'warning', label: '경고' },
	{ value: 'critical', label: '위험' },
];

const SELECT_CLASS =
	'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-500';

const PAGE_SIZE = 10;

type Toast = { id: number; message: string; tone?: 'default' | 'error' };

export function SecurityLogDashboard() {
	const [kpi, setKpi] = useState<SecurityLogKpi>(SECURITY_LOG_KPI_MOCK);
	const [items, setItems] = useState<SecurityLog[]>([]);
	const [total, setTotal] = useState(0);
	const [totalPages, setTotalPages] = useState(1);
	const [loading, setLoading] = useState(true);
	const [exporting, setExporting] = useState(false);
	const [query, setQuery] = useState('');
	const [severity, setSeverity] = useState<SecurityLogFilters['severity']>('all');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
	const [page, setPage] = useState(1);
	const [toasts, setToasts] = useState<Toast[]>([]);
	const requestIdRef = useRef(0);

	const filters: SecurityLogFilters = useMemo(() => ({ query, severity }), [query, severity]);

	const pushToast = useCallback((message: string, tone: Toast['tone'] = 'default') => {
		const id = Date.now() + Math.random();
		setToasts((prev) => [...prev, { id, message, tone }]);
		window.setTimeout(() => {
			setToasts((prev) => prev.filter((item) => item.id !== id));
		}, 2400);
	}, []);

	useEffect(() => {
		fetchSecurityKpi()
			.then(setKpi)
			.catch(() => setKpi(SECURITY_LOG_KPI_MOCK));
	}, []);

	const reload = useCallback(async () => {
		const requestId = ++requestIdRef.current;
		setLoading(true);
		try {
			const result = await fetchSecurityLogs({ filters, sortDir, page, pageSize: PAGE_SIZE });
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [filters, sortDir, page]);

	useEffect(() => {
		reload();
	}, [reload]);

	useEffect(() => {
		setPage(1);
	}, [query, severity]);

	const handleExport = useCallback(async () => {
		setExporting(true);
		try {
			const { filename } = await exportSecurityLogsCsv(items);
			pushToast(`${filename} 다운로드를 시작합니다. (현재 필터 · ${items.length}건)`);
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
			<SecurityLogKpiCards kpi={kpi} />

			<section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:bg-slate-800 dark:border-slate-700">
				<div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between dark:border-slate-700">
					<div className="relative min-w-0 flex-1">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
						<input
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="IP 주소 / 계정 이메일 검색"
							className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:bg-slate-800"
						/>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<label className="flex items-center gap-1.5">
							<span className="hidden text-[11px] font-semibold text-slate-400 sm:inline dark:text-slate-500">심각도</span>
							<select
								className={SELECT_CLASS}
								value={severity}
								onChange={(event) => setSeverity(event.target.value as SecurityLogFilters['severity'])}
								aria-label="심각도 필터"
							>
								{SEVERITY_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</label>
						<button
							type="button"
							onClick={() => setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
							className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700"
						>
							{sortDir === 'desc' ? '최신순' : '오래된순'}
						</button>
						<button
							type="button"
							disabled={exporting || items.length === 0}
							onClick={handleExport}
							className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700"
						>
							{exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
							로그 내보내기 (CSV)
						</button>
					</div>
				</div>

				<div className="overflow-x-auto">
					<table className="w-full min-w-[1080px] text-left text-sm">
						<thead>
							<tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-700/60 dark:text-slate-400 dark:border-slate-700">
								<th className="px-4 py-3 font-semibold">일시</th>
								<th className="px-4 py-3 font-semibold">계정</th>
								<th className="px-4 py-3 font-semibold">IP 주소</th>
								<th className="px-4 py-3 font-semibold">접속 위치</th>
								<th className="px-4 py-3 font-semibold">접속 환경</th>
								<th className="px-4 py-3 font-semibold">액션</th>
								<th className="px-4 py-3 font-semibold">심각도</th>
								<th className="px-4 py-3 font-semibold">상태</th>
							</tr>
						</thead>
						<tbody>
							{loading ? (
								<tr>
									<td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
										<span className="inline-flex items-center gap-2">
											<Loader2 className="h-4 w-4 animate-spin" />
											접속 로그를 불러오는 중…
										</span>
									</td>
								</tr>
							) : items.length === 0 ? (
								<tr>
									<td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
										조건에 맞는 로그가 없습니다.
									</td>
								</tr>
							) : (
								items.map((log) => (
									<tr
										key={log.id}
										className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/80  dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:bg-slate-700/50${
											log.severity === 'critical' ? 'bg-rose-50/40' : ''
										}`}
									>
										<td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
											{formatTimestamp(log.timestamp)}
										</td>
										<td className="px-4 py-3">
											<p
												className={`truncate text-xs font-medium ${
													log.userEmail === '비회원/Guest' ? 'text-slate-400 italic dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'
												}`}
											>
												{log.userEmail}
											</p>
										</td>
										<td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200">{log.ipAddress}</td>
										<td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{log.location}</td>
										<td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{log.device}</td>
										<td className="px-4 py-3">
											<LogActionBadge action={log.action} />
										</td>
										<td className="px-4 py-3">
											<SeverityBadge severity={log.severity} />
										</td>
										<td className="px-4 py-3">
											<LogOutcomeBadge severity={log.severity} />
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
					<p className="text-xs text-slate-500 dark:text-slate-400">
						{total.toLocaleString('ko-KR')}건 중 {rangeStart}–{rangeEnd}
					</p>
					<div className="flex items-center gap-1.5">
						<button
							type="button"
							disabled={page <= 1}
							onClick={() => setPage((prev) => Math.max(1, prev - 1))}
							className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
						>
							<ChevronLeft className="h-3.5 w-3.5" />
							이전
						</button>
						<span className="min-w-[4.5rem] text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
							{page} / {totalPages}
						</span>
						<button
							type="button"
							disabled={page >= totalPages}
							onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
							className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
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
								toast.tone === 'error'
									? 'border-rose-200 bg-rose-50 text-rose-700'
									: 'border-slate-200 bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
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
