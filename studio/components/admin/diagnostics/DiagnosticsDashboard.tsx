'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Eye, RefreshCw, Search, TriangleAlert } from 'lucide-react';
import {
	applyDiagnosticRerunToList,
	CATEGORY_LABEL,
	EMPTY_DIAGNOSTIC_KPI,
	PAGE_SIZE_OPTIONS,
	PERIOD_LABEL,
	STATUS_LABEL,
	toDiagnosticRecord,
	type DiagnosticCategory,
	type DiagnosticFilters,
	type DiagnosticKpi,
	type DiagnosticPageSize,
	type DiagnosticPeriod,
	type DiagnosticRecord,
	type DiagnosticStatus,
} from '@/lib/admin/diagnostic-management';
import {
	fetchDiagnosticDetail,
	fetchDiagnosticHistory,
	rerunDiagnostic,
	type DiagnosticDetail,
} from '@/lib/admin/diagnosticService';
import { DiagnosticReportDrawer } from './DiagnosticReportDrawer';
import { DiagnosticKpiCards } from './DiagnosticKpiCards';
import { DiagnosticCategoryBadge, DiagnosticScoreBadge } from './diagnostic-badges';
import {
	AUDIT_HISTORY_SYNC_CHANNEL,
	AUDIT_HISTORY_SYNC_KEY,
} from '@/lib/audit-history-storage';

const CATEGORY_OPTIONS: { value: DiagnosticFilters['category']; label: string }[] = [
	{ value: 'all', label: '전체' },
	{ value: 'Medical', label: CATEGORY_LABEL.Medical },
	{ value: 'Pet', label: CATEGORY_LABEL.Pet },
	{ value: 'Commerce', label: CATEGORY_LABEL.Commerce },
	{ value: 'Corporate', label: CATEGORY_LABEL.Corporate },
];

const STATUS_OPTIONS: { value: DiagnosticFilters['status']; label: string }[] = [
	{ value: 'all', label: '전체' },
	{ value: 'critical', label: STATUS_LABEL.critical },
	{ value: 'warning', label: STATUS_LABEL.warning },
	{ value: 'good', label: STATUS_LABEL.good },
];

const PERIOD_OPTIONS: { value: DiagnosticPeriod; label: string }[] = [
	{ value: 'today', label: PERIOD_LABEL.today },
	{ value: '7d', label: PERIOD_LABEL['7d'] },
	{ value: '30d', label: PERIOD_LABEL['30d'] },
];

const SELECT_CLASS =
	'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-500';

type Toast = { id: number; message: string; tone?: 'default' | 'error' };

export function DiagnosticsDashboard() {
	const [kpi, setKpi] = useState<DiagnosticKpi>(EMPTY_DIAGNOSTIC_KPI);
	const [items, setItems] = useState<DiagnosticRecord[]>([]);
	const [total, setTotal] = useState(0);
	const [totalPages, setTotalPages] = useState(1);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const [category, setCategory] = useState<DiagnosticFilters['category']>('all');
	const [status, setStatus] = useState<DiagnosticFilters['status']>('all');
	const [period, setPeriod] = useState<DiagnosticPeriod>('30d');
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState<DiagnosticPageSize>(10);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [drawerId, setDrawerId] = useState<string | null>(null);
	const [drawerDetail, setDrawerDetail] = useState<DiagnosticDetail | null>(null);
	const [drawerLoading, setDrawerLoading] = useState(false);
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [toasts, setToasts] = useState<Toast[]>([]);
	const requestIdRef = useRef(0);
	const detailRequestRef = useRef(0);
	const seededDetailRef = useRef<DiagnosticDetail | null>(null);

	const filters: DiagnosticFilters = useMemo(
		() => ({ query, category, status, period }),
		[query, category, status, period],
	);

	const pushToast = useCallback((message: string, tone: Toast['tone'] = 'default') => {
		const id = Date.now() + Math.random();
		setToasts((prev) => [...prev, { id, message, tone }]);
		window.setTimeout(() => {
			setToasts((prev) => prev.filter((item) => item.id !== id));
		}, 2400);
	}, []);

	const reload = useCallback(async (opts?: { silent?: boolean }) => {
		const requestId = ++requestIdRef.current;
		if (opts?.silent) setRefreshing(true);
		else setLoading(true);
		setError(null);
		try {
			const result = await fetchDiagnosticHistory({ filters, page, pageSize });
			if (requestId !== requestIdRef.current) return;
			setItems(result.items);
			setTotal(result.totalCount ?? result.total);
			setTotalPages(result.totalPages);
			setKpi(result.kpi);
			if (result.page !== page) setPage(result.page);
			setSelectedIds((prev) => prev.filter((id) => result.items.some((row) => row.id === id)));
		} catch (loadError) {
			if (requestId !== requestIdRef.current) return;
			const message = loadError instanceof Error ? loadError.message : '진단 이력을 불러오지 못했습니다.';
			setError(message);
			pushToast(message, 'error');
		} finally {
			if (requestId === requestIdRef.current) {
				setLoading(false);
				setRefreshing(false);
			}
		}
	}, [filters, page, pageSize, pushToast]);

	useEffect(() => {
		reload();
	}, [reload]);

	useEffect(() => {
		const timers: number[] = [];
		const refresh = () => {
			void reload({ silent: true });
			timers.push(window.setTimeout(() => void reload({ silent: true }), 1200));
			timers.push(window.setTimeout(() => void reload({ silent: true }), 3500));
		};
		const onVisible = () => {
			if (document.visibilityState === 'visible') void reload({ silent: true });
		};
		const onStorage = (event: StorageEvent) => {
			if (event.key === AUDIT_HISTORY_SYNC_KEY) refresh();
		};
		window.addEventListener(AUDIT_HISTORY_SYNC_CHANNEL, refresh);
		window.addEventListener('storage', onStorage);
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('focus', onVisible);
		let channel: BroadcastChannel | null = null;
		try {
			channel = new BroadcastChannel(AUDIT_HISTORY_SYNC_CHANNEL);
			channel.onmessage = refresh;
		} catch {
			channel = null;
		}
		return () => {
			window.removeEventListener(AUDIT_HISTORY_SYNC_CHANNEL, refresh);
			window.removeEventListener('storage', onStorage);
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('focus', onVisible);
			channel?.close();
			for (const id of timers) window.clearTimeout(id);
		};
	}, [reload]);

	useEffect(() => {
		setPage(1);
	}, [query, category, status, period, pageSize]);

	useEffect(() => {
		if (!drawerId) {
			setDrawerDetail(null);
			return;
		}
		if (seededDetailRef.current?.id === drawerId) {
			setDrawerDetail(seededDetailRef.current);
			seededDetailRef.current = null;
			setDrawerLoading(false);
			return;
		}
		const requestId = ++detailRequestRef.current;
		setDrawerLoading(true);
		fetchDiagnosticDetail(drawerId)
			.then((detail) => {
				if (requestId !== detailRequestRef.current) return;
				setDrawerDetail(detail);
			})
			.catch((error) => {
				if (requestId !== detailRequestRef.current) return;
				pushToast(error instanceof Error ? error.message : '리포트를 불러오지 못했습니다.', 'error');
				setDrawerId(null);
			})
			.finally(() => {
				if (requestId === detailRequestRef.current) setDrawerLoading(false);
			});
	}, [drawerId, pushToast]);

	const pageIds = items.map((row) => row.id);
	const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
	const somePageSelected = pageIds.some((id) => selectedIds.includes(id));

	function toggleAllRows() {
		if (allPageSelected) {
			setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
			return;
		}
		setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
	}

	function toggleRow(id: string) {
		setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
	}

	async function copyShareUrl(url: string) {
		try {
			const absolute = url.startsWith('http') ? url : new URL(url, window.location.origin).toString();
			await navigator.clipboard.writeText(absolute);
			pushToast('리포트 공유 링크를 복사했습니다.');
		} catch {
			pushToast('클립보드 복사에 실패했습니다.', 'error');
		}
	}

	async function handleRerun(id: string, domain?: string) {
		setPendingId(id);
		try {
			const created = await rerunDiagnostic(id, { domain });
			const listRow = toDiagnosticRecord(created);
			setItems((prev) => applyDiagnosticRerunToList(prev, listRow));
			seededDetailRef.current = created;
			setDrawerDetail(created);
			setDrawerId(created.id);
			pushToast(`${created.siteName} 재진단 완료 · 종합 ${created.totalScore}점`);
			void reload({ silent: true });
		} catch (error) {
			pushToast(error instanceof Error ? error.message : '재진단에 실패했습니다.', 'error');
		} finally {
			setPendingId(null);
		}
	}

	function downloadMockPdf(detail: DiagnosticDetail) {
		const lines = [
			'REDUE GEO Diagnostic Report (Mock PDF)',
			`ID: ${detail.id}`,
			`Site: ${detail.siteName} (${detail.domain})`,
			`Total: ${detail.totalScore} / GEO: ${detail.geoScore} / Schema: ${detail.schemaScore}`,
			`Knowledge Graph: ${detail.knowledgeGraphScore} / Local SoV: ${detail.localSovScore}`,
			'',
			detail.summary,
			'',
			'Issues',
			...detail.issues.map((issue) => `- ${issue}`),
			'',
			'Recommendations',
			...detail.recommendations.map((item) => `- [${item.priority}] ${item.title}: ${item.description}`),
			'',
			detail.reportShareUrl,
		];
		const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/plain;charset=utf-8' });
		const href = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = href;
		link.download = `${detail.id}-report.txt`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(href);
		pushToast('Mock PDF(텍스트) 다운로드를 시작합니다.');
	}

	const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
	const rangeEnd = Math.min(page * pageSize, total);
	const hasActiveFilters = Boolean(query.trim()) || category !== 'all' || status !== 'all' || period !== '30d';
	const showEmptyCatalog = !loading && !error && kpi.totalCount === 0 && !hasActiveFilters;
	const showFilteredEmpty = !loading && !error && items.length === 0 && !showEmptyCatalog;

	return (
		<div className="flex flex-col gap-5">
			<div className="flex justify-end">
				<button
					type="button"
					onClick={() => reload({ silent: !loading })}
					disabled={loading || refreshing}
					className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
				>
					<RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
					새로고침
				</button>
			</div>

			<DiagnosticKpiCards kpi={kpi} loading={loading && items.length === 0} />

			{error ? (
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
					<span className="inline-flex items-center gap-2">
						<TriangleAlert className="h-4 w-4" />
						{error}
					</span>
					<button
						type="button"
						onClick={() => reload()}
						className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"
					>
						<RefreshCw className="h-3.5 w-3.5" />
						재시도
					</button>
				</div>
			) : null}

			<section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
				<div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-700">
					<div className="relative min-w-0">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
						<input
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="도메인 또는 사이트명 검색"
							className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:bg-slate-800"
						/>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<FilterSelect
							label="업종"
							value={category}
							options={CATEGORY_OPTIONS}
							onChange={(value) => setCategory(value as DiagnosticCategory | 'all')}
						/>
						<FilterSelect
							label="상태"
							value={status}
							options={STATUS_OPTIONS}
							onChange={(value) => setStatus(value as DiagnosticStatus | 'all')}
						/>
						<FilterSelect
							label="기간"
							value={period}
							options={PERIOD_OPTIONS}
							onChange={(value) => setPeriod(value as DiagnosticPeriod)}
						/>
						{selectedIds.length > 0 ? (
							<span className="ml-auto text-xs font-semibold text-slate-500 dark:text-slate-400">
								{selectedIds.length}건 선택됨
							</span>
						) : null}
					</div>
				</div>

				<div className="overflow-x-auto">
					<table className="w-full min-w-[1080px] text-left text-sm">
						<thead>
							<tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-700/60 dark:text-slate-400">
								<th className="w-10 px-4 py-3">
									<input
										type="checkbox"
										checked={allPageSelected}
										ref={(node) => {
											if (node) node.indeterminate = !allPageSelected && somePageSelected;
										}}
										onChange={toggleAllRows}
										aria-label="현재 페이지 전체 선택"
										className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 accent-slate-900 dark:border-slate-500"
									/>
								</th>
								<th className="px-4 py-3 font-semibold">진단번호</th>
								<th className="px-4 py-3 font-semibold">사이트명</th>
								<th className="px-4 py-3 font-semibold">업종</th>
								<th className="px-4 py-3 font-semibold">종합점수</th>
								<th className="px-4 py-3 font-semibold">주요 감점 이슈</th>
								<th className="px-4 py-3 font-semibold">진단일시</th>
								<th className="px-4 py-3 font-semibold">액션</th>
							</tr>
						</thead>
						<tbody>
							{loading ? (
								Array.from({ length: 6 }).map((_, index) => (
									<tr key={`skeleton-${index}`} className="border-b border-slate-100 dark:border-slate-700">
										{Array.from({ length: 8 }).map((__, cell) => (
											<td key={cell} className="px-4 py-3">
												<div className="h-4 w-full max-w-[9rem] animate-pulse rounded bg-slate-100 dark:bg-slate-700" />
											</td>
										))}
									</tr>
								))
							) : error ? (
								<tr>
									<td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
										데이터를 불러오지 못했습니다. 재시도 후 다시 확인하세요.
									</td>
								</tr>
							) : showEmptyCatalog ? (
								<tr>
									<td colSpan={8} className="px-4 py-16 text-center">
										<p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
											조회된 진단 이력이 없습니다
										</p>
										<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
											사이트 진단이 완료되면 이 목록에 자동으로 저장됩니다.
										</p>
									</td>
								</tr>
							) : showFilteredEmpty ? (
								<tr>
									<td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
										조건에 맞는 진단 이력이 없습니다.
									</td>
								</tr>
							) : (
								items.map((row) => {
									const selected = selectedIds.includes(row.id);
									return (
										<tr
											key={row.id}
											onClick={() => setDrawerId(row.id)}
											className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50/80 dark:border-slate-700 dark:hover:bg-slate-700/50 ${
												selected ? 'bg-slate-50 dark:bg-slate-700/30' : ''
											}`}
										>
											<td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
												<input
													type="checkbox"
													checked={selected}
													onChange={() => toggleRow(row.id)}
													aria-label={`${row.id} 선택`}
													className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 accent-slate-900 dark:border-slate-500"
												/>
											</td>
											<td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
												{row.id}
											</td>
											<td className="px-4 py-3">
												<p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.siteName}</p>
												<a
													href={`https://${row.domain}`}
													target="_blank"
													rel="noopener noreferrer"
													onClick={(event) => event.stopPropagation()}
													className="mt-0.5 inline-block text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
												>
													{row.domain}
												</a>
											</td>
											<td className="px-4 py-3">
												<DiagnosticCategoryBadge category={row.category} />
											</td>
											<td className="px-4 py-3">
												<DiagnosticScoreBadge score={row.totalScore} />
											</td>
											<td className="px-4 py-3">
												<div className="flex max-w-[280px] flex-wrap gap-1">
													{row.issues.slice(0, 2).map((issue) => (
														<span
															key={issue}
															className="inline-flex max-w-full truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700/70 dark:text-slate-300"
														>
															{issue}
														</span>
													))}
													{row.issues.length > 2 ? (
														<span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
															+{row.issues.length - 2}
														</span>
													) : null}
												</div>
											</td>
											<td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
												{row.createdAt}
											</td>
											<td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
												<div className="flex items-center gap-1">
													<button
														type="button"
														onClick={() => setDrawerId(row.id)}
														className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
														title="리포트 보기"
														aria-label={`${row.id} 리포트 보기`}
													>
														<Eye className="h-3.5 w-3.5" />
													</button>
													<button
														type="button"
														onClick={() => copyShareUrl(row.reportShareUrl)}
														className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
														title="공유 링크 복사"
														aria-label={`${row.id} 공유 링크 복사`}
													>
														<Copy className="h-3.5 w-3.5" />
													</button>
													<button
														type="button"
														disabled={pendingId === row.id}
														onClick={(event) => {
															event.stopPropagation();
															void handleRerun(row.id, row.domain);
														}}
														className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-cyan-900/60 dark:bg-cyan-950/40 dark:text-cyan-300 dark:hover:bg-cyan-950/70"
														title="재진단"
														aria-label={`${row.id} 재진단`}
													>
														<RefreshCw className={`h-3.5 w-3.5 ${pendingId === row.id ? 'animate-spin' : ''}`} />
													</button>
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
					<div className="flex flex-wrap items-center gap-3">
						<p className="text-xs text-slate-500 dark:text-slate-400">
							{total.toLocaleString('ko-KR')}건 중 {rangeStart}–{rangeEnd}
						</p>
						<label className="flex items-center gap-1.5">
							<span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">보기</span>
							<select
								className={SELECT_CLASS}
								value={pageSize}
								onChange={(event) => setPageSize(Number(event.target.value) as DiagnosticPageSize)}
								aria-label="페이지당 행 수"
							>
								{PAGE_SIZE_OPTIONS.map((size) => (
									<option key={size} value={size}>
										{size}개
									</option>
								))}
							</select>
						</label>
					</div>
					<div className="flex items-center gap-1.5">
						<button
							type="button"
							disabled={page <= 1}
							onClick={() => setPage((prev) => Math.max(1, prev - 1))}
							className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
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
							className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
						>
							다음
							<ChevronRight className="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			</section>

			<DiagnosticReportDrawer
				open={drawerId !== null}
				loading={drawerLoading}
				detail={drawerDetail}
				onClose={() => setDrawerId(null)}
				onCopyLink={copyShareUrl}
				onDownloadPdf={downloadMockPdf}
			/>

			{toasts.length > 0 && (
				<div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
					{toasts.map((toast) => (
						<div
							key={toast.id}
							className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-lg ${
								toast.tone === 'error'
									? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/70 dark:text-rose-300'
									: 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
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

function FilterSelect({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: string;
	options: { value: string; label: string }[];
	onChange: (value: string) => void;
}) {
	return (
		<label className="flex items-center gap-1.5">
			<span className="hidden text-[11px] font-semibold text-slate-400 sm:inline dark:text-slate-500">{label}</span>
			<select className={SELECT_CLASS} value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</label>
	);
}
