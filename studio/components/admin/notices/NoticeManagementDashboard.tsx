'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	Archive,
	ChevronLeft,
	ChevronRight,
	Loader2,
	Megaphone,
	Pencil,
	Pin,
	PlusCircle,
	Search,
	Trash2,
	TriangleAlert,
} from 'lucide-react';
import {
	formatDateTime,
	type Notice,
	type NoticeDraft,
	type NoticeFilters,
} from '@/lib/admin/notice-management';
import {
	createNotice,
	deleteNotice,
	fetchNoticeList,
	toggleNoticeStatus,
	updateNotice,
} from '@/lib/admin/noticeService';
import { NoticeFormModal } from './NoticeFormModal';
import { NoticePinIcon, NoticeStatusBadge, NoticeTargetBadge, NoticeTypeBadge } from './notice-badges';

const TYPE_TABS: { value: NoticeFilters['type']; label: string }[] = [
	{ value: 'all', label: '전체' },
	{ value: 'notice', label: '일반안내' },
	{ value: 'system', label: '시스템점검' },
	{ value: 'event', label: '이벤트' },
];

const STATUS_OPTIONS: { value: NoticeFilters['status']; label: string }[] = [
	{ value: 'all', label: '전체' },
	{ value: 'published', label: '게시중' },
	{ value: 'draft', label: '임시저장' },
	{ value: 'archived', label: '보관' },
];

const SELECT_CLASS =
	'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-500';

const CARD = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-800 dark:border-slate-700';

type Toast = { id: number; message: string; tone?: 'default' | 'error' };

export function NoticeManagementDashboard() {
	const [items, setItems] = useState<Notice[]>([]);
	const [total, setTotal] = useState(0);
	const [totalPages, setTotalPages] = useState(1);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const [type, setType] = useState<NoticeFilters['type']>('all');
	const [status, setStatus] = useState<NoticeFilters['status']>('all');
	const [page, setPage] = useState(1);
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [modalNotice, setModalNotice] = useState<Notice | 'create' | null>(null);
	const [toasts, setToasts] = useState<Toast[]>([]);
	const requestIdRef = useRef(0);

	const filters: NoticeFilters = useMemo(() => ({ query, type, status }), [query, type, status]);

	const pushToast = useCallback((message: string, tone: Toast['tone'] = 'default') => {
		const id = Date.now() + Math.random();
		setToasts((prev) => [...prev, { id, message, tone }]);
		window.setTimeout(() => {
			setToasts((prev) => prev.filter((item) => item.id !== id));
		}, 2400);
	}, []);

	const reload = useCallback(async () => {
		const requestId = ++requestIdRef.current;
		setLoading(true);
		setLoadError(null);
		try {
			const result = await fetchNoticeList({
				filters,
				sortKey: 'createdAt',
				sortDir: 'desc',
				page,
				pageSize: 8,
			});
			if (requestId !== requestIdRef.current) return;
			setItems(result.items);
			setTotal(result.total);
			setTotalPages(result.totalPages);
			if (result.page !== page) setPage(result.page);
		} catch (error) {
			if (requestId !== requestIdRef.current) return;
			const message = error instanceof Error ? error.message : '공지 목록을 불러오지 못했습니다.';
			setLoadError(message);
			pushToast(message, 'error');
		} finally {
			if (requestId === requestIdRef.current) setLoading(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [filters, page]);

	useEffect(() => {
		reload();
	}, [reload]);

	useEffect(() => {
		setPage(1);
	}, [query, type, status]);

	const patchLocal = useCallback((updated: Notice) => {
		setItems((prev) => prev.map((notice) => (notice.id === updated.id ? updated : notice)));
	}, []);

	const summary = useMemo(() => {
		const published = items.filter((n) => n.status === 'published').length;
		const draft = items.filter((n) => n.status === 'draft').length;
		const pinned = items.filter((n) => n.isPinned).length;
		return { published, draft, pinned };
	}, [items]);

	const handleToggleStatus = useCallback(
		async (notice: Notice) => {
			if (notice.status === 'archived') return;
			const nextStatus = notice.status === 'published' ? 'draft' : 'published';
			setPendingId(notice.id);
			try {
				const updated = await toggleNoticeStatus(notice.id, nextStatus);
				patchLocal(updated);
				pushToast(`"${notice.title}" ${nextStatus === 'published' ? '게시됨' : '임시저장으로 전환됨'}`);
			} catch (error) {
				pushToast(error instanceof Error ? error.message : '상태 변경에 실패했습니다.', 'error');
			} finally {
				setPendingId(null);
			}
		},
		[patchLocal, pushToast],
	);

	const handleArchive = useCallback(
		async (notice: Notice) => {
			setPendingId(notice.id);
			try {
				const updated = await toggleNoticeStatus(notice.id, 'archived');
				patchLocal(updated);
				pushToast(`"${notice.title}" 보관 처리됨`);
			} catch (error) {
				pushToast(error instanceof Error ? error.message : '보관 처리에 실패했습니다.', 'error');
			} finally {
				setPendingId(null);
			}
		},
		[patchLocal, pushToast],
	);

	const handleDelete = useCallback(
		async (notice: Notice) => {
			if (typeof window !== 'undefined' && !window.confirm(`"${notice.title}" 공지를 삭제하시겠습니까?`)) {
				return;
			}
			setPendingId(notice.id);
			try {
				await deleteNotice(notice.id);
				pushToast(`"${notice.title}" 삭제됨`);
				await reload();
			} catch (error) {
				pushToast(error instanceof Error ? error.message : '삭제에 실패했습니다.', 'error');
			} finally {
				setPendingId(null);
			}
		},
		[pushToast, reload],
	);

	const handleSubmit = useCallback(
		async (draft: NoticeDraft) => {
			const isEdit = modalNotice !== 'create' && modalNotice !== null;
			if (isEdit) {
				await updateNotice((modalNotice as Notice).id, draft);
				pushToast(`"${draft.title}" 수정됨`);
			} else {
				await createNotice(draft);
				pushToast(`"${draft.title}" 등록됨`);
			}
			setModalNotice(null);
			setPage(1);
			await reload();
		},
		[modalNotice, pushToast, reload],
	);

	const rangeStart = total === 0 ? 0 : (page - 1) * 8 + 1;
	const rangeEnd = Math.min(page * 8, total);

	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div className="grid flex-1 gap-3 sm:grid-cols-3">
					<div className={CARD}>
						<div className="flex items-start justify-between gap-3">
							<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">게시중</p>
							<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
								<Megaphone className="h-4 w-4" strokeWidth={1.75} aria-hidden />
							</span>
						</div>
						<p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
							{summary.published}
							<span className="ml-1 text-sm font-semibold text-slate-500 dark:text-slate-400">건</span>
						</p>
					</div>
					<div className={CARD}>
						<div className="flex items-start justify-between gap-3">
							<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">임시저장</p>
							<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
								<Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden />
							</span>
						</div>
						<p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
							{summary.draft}
							<span className="ml-1 text-sm font-semibold text-slate-500 dark:text-slate-400">건</span>
						</p>
					</div>
					<div className={CARD}>
						<div className="flex items-start justify-between gap-3">
							<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">상단 고정</p>
							<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
								<Pin className="h-4 w-4" strokeWidth={1.75} aria-hidden />
							</span>
						</div>
						<p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
							{summary.pinned}
							<span className="ml-1 text-sm font-semibold text-slate-500 dark:text-slate-400">건</span>
						</p>
					</div>
				</div>
				<button
					type="button"
					onClick={() => setModalNotice('create')}
					className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800"
				>
					<PlusCircle className="h-4 w-4" />
					새 공지 등록
				</button>
			</div>

			<section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:bg-slate-800 dark:border-slate-700">
				<div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-700">
					<div
						className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-50 p-1 dark:bg-slate-700/60"
						role="tablist"
						aria-label="공지 분류"
					>
						{TYPE_TABS.map((tab) => {
							const active = type === tab.value;
							return (
								<button
									key={tab.value}
									type="button"
									role="tab"
									aria-selected={active}
									onClick={() => setType(tab.value)}
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
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						<div className="relative min-w-0 flex-1">
							<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
							<input
								type="search"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder="제목 검색"
								className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:bg-slate-800"
							/>
						</div>
						<FilterSelect
							label="상태"
							value={status}
							options={STATUS_OPTIONS}
							onChange={(value) => setStatus(value as NoticeFilters['status'])}
						/>
					</div>
				</div>

				{loadError && (
					<div className="flex items-center justify-between gap-3 border-b border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700">
						<p>{loadError}</p>
						<button type="button" onClick={() => void reload()} className="font-semibold underline">
							다시 시도
						</button>
					</div>
				)}

				<div className="overflow-x-auto">
					<table className="w-full min-w-[960px] text-left text-sm">
						<thead>
							<tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-700/60 dark:text-slate-400 dark:border-slate-700">
								<th className="w-10 px-4 py-3 font-semibold" />
								<th className="px-4 py-3 font-semibold">유형</th>
								<th className="px-4 py-3 font-semibold">제목</th>
								<th className="px-4 py-3 font-semibold">노출 대상</th>
								<th className="px-4 py-3 font-semibold">작성일</th>
								<th className="px-4 py-3 font-semibold">게시 상태</th>
								<th className="px-4 py-3 font-semibold">관리</th>
							</tr>
						</thead>
						<tbody>
							{loading ? (
								<tr>
									<td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
										<span className="inline-flex items-center gap-2">
											<Loader2 className="h-4 w-4 animate-spin" />
											공지 목록을 불러오는 중…
										</span>
									</td>
								</tr>
							) : items.length === 0 ? (
								<tr>
									<td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
										조건에 맞는 공지가 없습니다.
									</td>
								</tr>
							) : (
								items.map((notice) => (
									<tr
										key={notice.id}
										className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/80  dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:bg-slate-700/50${
											pendingId === notice.id ? 'opacity-60' : ''
										}`}
									>
										<td className="px-4 py-3">
											<NoticePinIcon pinned={notice.isPinned} />
										</td>
										<td className="px-4 py-3">
											<NoticeTypeBadge type={notice.type} />
										</td>
										<td className="max-w-[360px] px-4 py-3">
											<p className="truncate font-semibold text-slate-800 dark:text-slate-100">{notice.title}</p>
											<p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{notice.content}</p>
											{notice.isPopup && (
												<span className="mt-1 inline-flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200">
													팝업 노출
												</span>
											)}
										</td>
										<td className="px-4 py-3">
											<NoticeTargetBadge target={notice.target} />
										</td>
										<td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
											{formatDateTime(notice.createdAt)}
										</td>
										<td className="px-4 py-3">
											<div className="flex items-center gap-2">
												<button
													type="button"
													role="switch"
													aria-checked={notice.status === 'published'}
													aria-label="게시 상태 토글"
													disabled={notice.status === 'archived' || pendingId === notice.id}
													onClick={() => handleToggleStatus(notice)}
													className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full border-0 p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
														notice.status === 'published' ? 'bg-slate-900 dark:bg-slate-100' : 'bg-slate-200 dark:bg-slate-700'
													}`}
												>
													<span
														className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
															notice.status === 'published' ? 'translate-x-5' : 'translate-x-0'
														}`}
													/>
												</button>
												<NoticeStatusBadge status={notice.status} />
											</div>
										</td>
										<td className="px-4 py-3">
											<div className="flex items-center gap-1">
												<button
													type="button"
													onClick={() => setModalNotice(notice)}
													className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
													title="수정"
													aria-label={`${notice.title} 수정`}
												>
													<Pencil className="h-3.5 w-3.5" />
												</button>
												{notice.status !== 'archived' && (
													<button
														type="button"
														disabled={pendingId === notice.id}
														onClick={() => handleArchive(notice)}
														className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
														title="보관"
														aria-label={`${notice.title} 보관`}
													>
														<Archive className="h-3.5 w-3.5" />
													</button>
												)}
												<button
													type="button"
													disabled={pendingId === notice.id}
													onClick={() => handleDelete(notice)}
													className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
													title="삭제"
													aria-label={`${notice.title} 삭제`}
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

			{modalNotice && (
				<NoticeFormModal
					notice={modalNotice === 'create' ? null : modalNotice}
					onClose={() => setModalNotice(null)}
					onSubmit={handleSubmit}
				/>
			)}

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
