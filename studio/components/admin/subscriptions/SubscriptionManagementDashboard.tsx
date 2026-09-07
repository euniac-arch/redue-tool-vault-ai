'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, CreditCard, Loader2, RefreshCw, Search, Wallet } from 'lucide-react';
import {
	SUBSCRIPTION_PLAN_OPTIONS,
	formatKrw,
	type SubscriptionFilters,
	type SubscriptionKpi,
	type SubscriptionPlanId,
	type SubscriptionRow,
} from '@/lib/admin/subscription-management';
import { fetchSubscriptions, updateSubscriptionPlan } from '@/lib/admin/subscription-service';

const SELECT_CLASS =
	'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

const EMPTY_KPI: SubscriptionKpi = { totalMembers: 0, freeMembers: 0, paidMembers: 0, monthlyRevenueKrw: 0 };

function formatDate(value: string | null): string {
	if (!value) return '-';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '-';
	return date.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABEL: Record<SubscriptionRow['status'], string> = {
	DONE: '결제 완료',
	PENDING: '대기',
	CANCELED: '취소',
	FAILED: '실패',
	NONE: '내역 없음',
};

export function SubscriptionManagementDashboard() {
	const [items, setItems] = useState<SubscriptionRow[]>([]);
	const [kpi, setKpi] = useState<SubscriptionKpi>(EMPTY_KPI);
	const [total, setTotal] = useState(0);
	const [totalPages, setTotalPages] = useState(1);
	const [page, setPage] = useState(1);
	const [query, setQuery] = useState('');
	const [plan, setPlan] = useState<SubscriptionFilters['plan']>('all');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [pendingId, setPendingId] = useState<string | null>(null);
	const requestIdRef = useRef(0);

	const filters = useMemo(() => ({ query, plan }), [query, plan]);

	const reload = useCallback(async () => {
		const requestId = ++requestIdRef.current;
		setLoading(true);
		setError(null);
		try {
			const result = await fetchSubscriptions({ filters, page, pageSize: 10 });
			if (requestId !== requestIdRef.current) return;
			setItems(result.items);
			setTotal(result.total);
			setTotalPages(result.totalPages);
			setKpi(result.kpi);
			if (result.page !== page) setPage(result.page);
		} catch (err) {
			if (requestId !== requestIdRef.current) return;
			setError(err instanceof Error ? err.message : '구독 목록을 불러오지 못했습니다.');
			setItems([]);
		} finally {
			if (requestId === requestIdRef.current) setLoading(false);
		}
	}, [filters, page]);

	useEffect(() => {
		void reload();
	}, [reload]);

	useEffect(() => {
		setPage(1);
	}, [query, plan]);

	const handlePlanChange = async (userId: string, planId: SubscriptionPlanId) => {
		setPendingId(userId);
		try {
			const updated = await updateSubscriptionPlan(userId, planId);
			setItems((prev) => prev.map((row) => (row.id === userId ? updated : row)));
		} catch (err) {
			setError(err instanceof Error ? err.message : '플랜 변경에 실패했습니다.');
		} finally {
			setPendingId(null);
		}
	};

	return (
		<div className="flex flex-col gap-5">
			<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<KpiCard label="전체 회원" value={`${kpi.totalMembers.toLocaleString('ko-KR')}명`} icon={<Wallet className="h-4 w-4" />} />
				<KpiCard label="Free" value={`${kpi.freeMembers.toLocaleString('ko-KR')}명`} />
				<KpiCard label="유료 플랜" value={`${kpi.paidMembers.toLocaleString('ko-KR')}명`} icon={<CreditCard className="h-4 w-4" />} />
				<KpiCard label="이번 달 결제" value={formatKrw(kpi.monthlyRevenueKrw)} />
			</section>

			<section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
				<div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-center dark:border-slate-700">
					<div className="relative min-w-0 flex-1">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
						<input
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="이름 / 이메일 검색"
							className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-slate-400 focus:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
						/>
					</div>
					<select className={SELECT_CLASS} value={plan} onChange={(event) => setPlan(event.target.value as SubscriptionFilters['plan'])}>
						<option value="all">전체 플랜</option>
						{SUBSCRIPTION_PLAN_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
					<button
						type="button"
						onClick={() => void reload()}
						className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
					>
						<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
						새로고침
					</button>
				</div>

				{error && (
					<div className="flex items-center justify-between gap-3 border-b border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700">
						<p>{error}</p>
						<button type="button" onClick={() => void reload()} className="font-semibold underline">
							다시 시도
						</button>
					</div>
				)}

				<div className="overflow-x-auto">
					<table className="w-full min-w-[960px] text-left text-sm">
						<thead>
							<tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-700/60">
								<th className="px-4 py-3 font-semibold">회원</th>
								<th className="px-4 py-3 font-semibold">현재 플랜</th>
								<th className="px-4 py-3 font-semibold">결제 상태</th>
								<th className="px-4 py-3 font-semibold">최근 결제</th>
								<th className="px-4 py-3 font-semibold">누적 결제</th>
								<th className="px-4 py-3 font-semibold">수동 조정</th>
							</tr>
						</thead>
						<tbody>
							{loading ? (
								<tr>
									<td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
										<span className="inline-flex items-center gap-2">
											<Loader2 className="h-4 w-4 animate-spin" />
											구독 데이터를 불러오는 중…
										</span>
									</td>
								</tr>
							) : items.length === 0 ? (
								<tr>
									<td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
										표시할 구독 정보가 없습니다.
									</td>
								</tr>
							) : (
								items.map((row) => (
									<tr key={row.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
										<td className="px-4 py-3">
											<p className="font-semibold text-slate-800 dark:text-slate-100">{row.name}</p>
											<p className="text-xs text-slate-500">{row.email}</p>
										</td>
										<td className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{row.planLabel}</td>
										<td className="px-4 py-3 text-xs text-slate-500">{STATUS_LABEL[row.status]}</td>
										<td className="px-4 py-3 text-xs text-slate-500">{formatDate(row.lastPaidAt)}</td>
										<td className="px-4 py-3 text-sm font-semibold">{formatKrw(row.totalPaidKrw)}</td>
										<td className="px-4 py-3">
											<select
												className={SELECT_CLASS}
												value={row.planId}
												disabled={pendingId === row.id}
												onChange={(event) => void handlePlanChange(row.id, event.target.value as SubscriptionPlanId)}
											>
												{SUBSCRIPTION_PLAN_OPTIONS.map((option) => (
													<option key={option.value} value={option.value}>
														{option.label}
													</option>
												))}
											</select>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				<div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
					<p className="text-xs text-slate-500">{total.toLocaleString('ko-KR')}명</p>
					<div className="flex items-center gap-1.5">
						<button type="button" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs disabled:opacity-40">
							<ChevronLeft className="h-3.5 w-3.5" />
							이전
						</button>
						<span className="text-xs font-semibold">
							{page} / {totalPages}
						</span>
						<button type="button" disabled={page >= totalPages} onClick={() => setPage((prev) => prev + 1)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs disabled:opacity-40">
							다음
							<ChevronRight className="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			</section>
		</div>
	);
}

function KpiCard({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
	return (
		<article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
			<div className="flex items-center justify-between">
				<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
				{icon ? <span className="text-slate-400">{icon}</span> : null}
			</div>
			<p className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
		</article>
	);
}
