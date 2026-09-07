'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Clock3,
	Eye,
	ExternalLink,
	Loader2,
	Mail,
	MessageSquare,
	Search,
	Trash2,
	TriangleAlert,
} from 'lucide-react';
import { useAdminSession } from '@/lib/admin/use-admin-session';
import {
	INQUIRY_PAGE_SIZE,
	INQUIRY_STATUS_OPTIONS,
	applicantLabel,
	displayOrDash,
	formatInquiryDateTime,
	formatInquiryNumber,
	type ContactInquiry,
	type ContactInquiryStatus,
	type InquiryFilterStatus,
	type InquirySummary,
} from '@/lib/admin/inquiry-management';
import { deleteAdminInquiry, fetchAdminInquiries, updateAdminInquiryStatus } from '@/lib/admin/inquiry-service';
import { InquiryDetailModal } from './InquiryDetailModal';
import { InquiryStatusBadge } from './inquiry-badges';

const STATUS_TABS: { value: InquiryFilterStatus; label: string }[] = [
	{ value: 'all', label: '전체' },
	{ value: 'pending', label: '미확인' },
	{ value: 'completed', label: '답변완료' },
];

const CARD = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-800 dark:border-slate-700';

type Toast = { id: number; message: string; tone?: 'default' | 'error' };

const EMPTY_SUMMARY: InquirySummary = { total: 0, pending: 0, active: 0, completed: 0 };

export function InquiryManagementDashboard() {
	const { canFetchAdmin } = useAdminSession();
	const [items, setItems] = useState<ContactInquiry[]>([]);
	const [summary, setSummary] = useState<InquirySummary>(EMPTY_SUMMARY);
	const [total, setTotal] = useState(0);
	const [totalPages, setTotalPages] = useState(1);
	const [loading, setLoading] = useState(true);
	const [query, setQuery] = useState('');
	const [debouncedQuery, setDebouncedQuery] = useState('');
	const [status, setStatus] = useState<InquiryFilterStatus>('all');
	const [page, setPage] = useState(1);
	const [selected, setSelected] = useState<ContactInquiry | null>(null);
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [toasts, setToasts] = useState<Toast[]>([]);
	const requestIdRef = useRef(0);

	useEffect(() => {
		const timer = window.setTimeout(() => setDebouncedQuery(query), 250);
		return () => window.clearTimeout(timer);
	}, [query]);

	const pushToast = useCallback((message: string, tone: Toast['tone'] = 'default') => {
		const id = Date.now() + Math.random();
		setToasts((prev) => [...prev, { id, message, tone }]);
		window.setTimeout(() => {
			setToasts((prev) => prev.filter((item) => item.id !== id));
		}, 2400);
	}, []);

	const reload = useCallback(async () => {
		if (!canFetchAdmin) return;
		const requestId = ++requestIdRef.current;
		setLoading(true);
		try {
			const result = await fetchAdminInquiries({
				query: debouncedQuery,
				status,
				page,
				pageSize: INQUIRY_PAGE_SIZE,
				enabled: canFetchAdmin,
			});
			if (requestId !== requestIdRef.current) return;
			setItems(result.items);
			setTotal(result.total);
			setTotalPages(result.totalPages);
			setSummary(result.summary);
			if (result.page !== page) setPage(result.page);
			setSelected((prev) => (prev ? result.items.find((item) => item.id === prev.id) || prev : null));
		} catch (error) {
			if (requestId !== requestIdRef.current) return;
			pushToast(error instanceof Error ? error.message : '문의 목록을 불러오지 못했습니다.', 'error');
		} finally {
			if (requestId === requestIdRef.current) setLoading(false);
		}
	}, [canFetchAdmin, debouncedQuery, page, pushToast, status]);

	useEffect(() => {
		reload();
	}, [reload]);

	useEffect(() => {
		setPage(1);
	}, [debouncedQuery, status]);

	const handleStatusChange = useCallback(
		async (id: string, nextStatus: ContactInquiryStatus) => {
			setPendingId(id);
			try {
				const updated = await updateAdminInquiryStatus(id, nextStatus, canFetchAdmin);
				setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
				setSelected((prev) => (prev?.id === id ? updated : prev));
				pushToast(`처리 상태가 "${statusActionLabel(nextStatus)}"로 변경되었습니다.`);
				await reload();
			} catch (error) {
				pushToast(error instanceof Error ? error.message : '상태 변경에 실패했습니다.', 'error');
			} finally {
				setPendingId(null);
			}
		},
		[canFetchAdmin, pushToast, reload],
	);

	const handleDelete = useCallback(
		async (id: string) => {
			const target = items.find((item) => item.id === id) || selected;
			if (typeof window !== 'undefined' && !window.confirm(`접수번호 ${formatInquiryNumber(id)} 문의를 삭제하시겠습니까?`)) {
				return;
			}
			setPendingId(id);
			try {
				await deleteAdminInquiry(id, canFetchAdmin);
				setSelected((prev) => (prev?.id === id ? null : prev));
				pushToast(`${target ? applicantLabel(target) : '문의'} 건이 삭제되었습니다.`);
				await reload();
			} catch (error) {
				pushToast(error instanceof Error ? error.message : '삭제에 실패했습니다.', 'error');
			} finally {
				setPendingId(null);
			}
		},
		[canFetchAdmin, items, pushToast, reload, selected],
	);

	const handleDeleteFromModal = useCallback(
		async (id: string) => {
			setPendingId(id);
			try {
				await deleteAdminInquiry(id, canFetchAdmin);
				setSelected(null);
				pushToast('문의 건이 삭제되었습니다.');
				await reload();
			} catch (error) {
				pushToast(error instanceof Error ? error.message : '삭제에 실패했습니다.', 'error');
			} finally {
				setPendingId(null);
			}
		},
		[canFetchAdmin, pushToast, reload],
	);

	const rangeStart = total === 0 ? 0 : (page - 1) * INQUIRY_PAGE_SIZE + 1;
	const rangeEnd = Math.min(page * INQUIRY_PAGE_SIZE, total);
	const selectedPending = selected ? pendingId === selected.id : false;

	const kpis = useMemo(
		() => [
			{ label: '전체 접수', value: summary.total, icon: MessageSquare, tone: 'bg-slate-100 text-slate-600' },
			{ label: '미확인', value: summary.pending, icon: Clock3, tone: 'bg-amber-50 text-amber-600' },
			{ label: '처리중', value: summary.active, icon: Eye, tone: 'bg-sky-50 text-sky-600' },
			{ label: '답변완료', value: summary.completed, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
		],
		[summary],
	);

	return (
		<div className="flex flex-col gap-5">
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{kpis.map((kpi) => {
					const Icon = kpi.icon;
					return (
						<div key={kpi.label} className={CARD}>
							<div className="flex items-start justify-between gap-3">
								<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
									{kpi.label}
								</p>
								<span className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.tone}`}>
									<Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
								</span>
							</div>
							<p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
								{kpi.value}
								<span className="ml-1 text-sm font-semibold text-slate-500 dark:text-slate-400">건</span>
							</p>
						</div>
					);
				})}
			</div>

			<section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
				<div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-700">
					<div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-50 p-1 dark:bg-slate-700/60" role="tablist" aria-label="문의 상태">
						{STATUS_TABS.map((tab) => {
							const active = status === tab.value;
							return (
								<button
									key={tab.value}
									type="button"
									role="tab"
									aria-selected={active}
									onClick={() => setStatus(tab.value)}
									className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
										active
											? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700'
											: 'text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700/70 dark:hover:text-slate-100'
									}`}
								>
									{tab.label}
								</button>
							);
						})}
					</div>
					<div className="relative min-w-0">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
						<input
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="문의자 이름, 이메일, 회사명 검색"
							className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500"
						/>
					</div>
				</div>

				<div className="overflow-x-auto">
					<table className="w-full min-w-[1080px] text-left text-sm">
						<thead>
							<tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-700/60 dark:text-slate-400">
								<th className="px-4 py-3 font-semibold">접수번호</th>
								<th className="px-4 py-3 font-semibold">상태</th>
								<th className="px-4 py-3 font-semibold">문의자 / 회사명</th>
								<th className="px-4 py-3 font-semibold">연락처</th>
								<th className="px-4 py-3 font-semibold">이메일</th>
								<th className="px-4 py-3 font-semibold">웹사이트 URL</th>
								<th className="px-4 py-3 font-semibold">접수일시</th>
								<th className="px-4 py-3 font-semibold">관리</th>
							</tr>
						</thead>
						<tbody>
							{loading ? (
								<tr>
									<td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
										<span className="inline-flex items-center gap-2">
											<Loader2 className="h-4 w-4 animate-spin" />
											문의 목록을 불러오는 중…
										</span>
									</td>
								</tr>
							) : items.length === 0 ? (
								<tr>
									<td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
										조건에 맞는 작업 문의가 없습니다.
									</td>
								</tr>
							) : (
								items.map((inquiry) => (
									<tr
										key={inquiry.id}
										className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50/80 dark:border-slate-700 dark:hover:bg-slate-700/50 ${
											pendingId === inquiry.id ? 'opacity-60' : ''
										}`}
										onClick={() => setSelected(inquiry)}
									>
										<td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
											{formatInquiryNumber(inquiry.id)}
										</td>
										<td className="px-4 py-3">
											<InquiryStatusBadge status={inquiry.status} />
										</td>
										<td className="max-w-[220px] px-4 py-3">
											<p className="truncate font-semibold text-slate-800 dark:text-slate-100">{inquiry.name}</p>
											<p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
												{displayOrDash(inquiry.company)}
											</p>
										</td>
										<td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
											{displayOrDash(inquiry.phone)}
										</td>
										<td className="px-4 py-3">
											<a
												href={`mailto:${inquiry.email}`}
												onClick={(event) => event.stopPropagation()}
												className="inline-flex max-w-[220px] items-center gap-1 truncate text-xs text-slate-600 hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-slate-100"
											>
												<Mail className="h-3 w-3 shrink-0" />
												{displayOrDash(inquiry.email)}
											</a>
										</td>
										<td className="px-4 py-3">
											{inquiry.pageUrl ? (
												<a
													href={safeHref(inquiry.pageUrl)}
													target="_blank"
													rel="noopener noreferrer"
													onClick={(event) => event.stopPropagation()}
													className="inline-flex max-w-[220px] items-center gap-1 truncate text-xs text-cyan-700 hover:underline dark:text-cyan-300"
												>
													{inquiry.pageUrl}
													<ExternalLink className="h-3 w-3 shrink-0" />
												</a>
											) : (
												<span className="text-xs text-slate-400">—</span>
											)}
										</td>
										<td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
											{formatInquiryDateTime(inquiry.createdAt)}
										</td>
										<td className="px-4 py-3">
											<div className="flex items-center gap-1">
												<button
													type="button"
													onClick={(event) => {
														event.stopPropagation();
														setSelected(inquiry);
													}}
													className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
												>
													<Eye className="h-3.5 w-3.5" />
													상세보기
												</button>
												<button
													type="button"
													disabled={pendingId === inquiry.id}
													onClick={(event) => {
														event.stopPropagation();
														void handleDelete(inquiry.id);
													}}
													className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
													title="삭제"
													aria-label={`${applicantLabel(inquiry)} 문의 삭제`}
												>
													<Trash2 className="h-3.5 w-3.5" />
												</button>
											</div>
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

			{selected ? (
				<InquiryDetailModal
					inquiry={selected}
					pending={selectedPending}
					onClose={() => setSelected(null)}
					onStatusChange={handleStatusChange}
					onDelete={handleDeleteFromModal}
				/>
			) : null}

			{toasts.length > 0 && (
				<div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
					{toasts.map((toast) => (
						<div
							key={toast.id}
							className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-lg ${
								toast.tone === 'error'
									? 'border-rose-200 bg-rose-50 text-rose-700'
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

function statusActionLabel(status: ContactInquiryStatus): string {
	return INQUIRY_STATUS_OPTIONS.find((option) => option.value === status)?.label || status;
}

function safeHref(value: string): string {
	const raw = value.trim();
	if (/^https?:\/\//i.test(raw)) return raw;
	return `https://${raw}`;
}
