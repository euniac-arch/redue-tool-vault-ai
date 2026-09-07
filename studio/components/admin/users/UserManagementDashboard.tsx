'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ArrowDownAZ,
	Ban,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Coins,
	Eye,
	Loader2,
	RefreshCw,
	Search,
	Shield,
	ShieldCheck,
	Trash2,
	UserX,
} from 'lucide-react';
import {
	PAGE_SIZE_OPTIONS,
	formatDateTime,
	type AdminMember,
	type AuthProvider,
	type MemberFilters,
	type MemberRole,
	type MemberSortKey,
	type MembershipPlan,
	type PageSize,
	type SortDirection,
	type UserKpiSummary,
} from '@/lib/admin/user-management';
import {
	deleteUser,
	fetchAdminUsers,
	updateUserCredits,
	updateUserMemo,
	updateUserRole,
	updateUserStatus,
} from '@/lib/admin/users-service';
import { UserAvatar } from './UserAvatar';
import { UserCreditBar } from './UserCreditBar';
import { UserDetailModal } from './UserDetailModal';
import { UserKpiCards } from './UserKpiCards';
import { UserPlanBadge, UserProviderBadge, UserRoleBadge, UserScoreBadge, UserStatusBadge } from './user-badges';

const PLAN_OPTIONS: { value: MemberFilters['plan']; label: string }[] = [
	{ value: 'all', label: '전체' },
	{ value: 'Free', label: 'Free' },
	{ value: 'Pro', label: 'Pro' },
	{ value: 'Enterprise', label: 'Enterprise' },
];

const PROVIDER_OPTIONS: { value: MemberFilters['provider']; label: string }[] = [
	{ value: 'all', label: '전체' },
	{ value: 'kakao', label: 'KAKAO' },
	{ value: 'google', label: 'GOOGLE' },
	{ value: 'email', label: 'EMAIL' },
	{ value: 'naver', label: 'NAVER' },
];

const STATUS_OPTIONS: { value: MemberFilters['status']; label: string }[] = [
	{ value: 'all', label: '전체' },
	{ value: 'active', label: '활성' },
	{ value: 'suspended', label: '정지' },
	{ value: 'withdrawn', label: '탈퇴' },
];

const SORT_OPTIONS: { value: MemberSortKey; label: string }[] = [
	{ value: 'created_at', label: '가입일순' },
	{ value: 'credits_remaining', label: '크레딧순' },
	{ value: 'last_audit_score', label: '진단점수순' },
];

const SELECT_CLASS =
	'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-500';

const INSTANT_CREDIT = 50;

const EMPTY_KPI: UserKpiSummary = {
	totalMembers: 0,
	totalMembersDeltaPct: 0,
	todaySignups: 0,
	todaySignupsByProvider: { email: 0, kakao: 0, google: 0 },
	todayAudits: 0,
	paidActiveUsers: 0,
};

type Toast = { id: number; message: string; tone?: 'default' | 'error' };

export function UserManagementDashboard() {
	const [items, setItems] = useState<AdminMember[]>([]);
	const [kpi, setKpi] = useState<UserKpiSummary>(EMPTY_KPI);
	const [total, setTotal] = useState(0);
	const [totalPages, setTotalPages] = useState(1);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const [plan, setPlan] = useState<MemberFilters['plan']>('all');
	const [provider, setProvider] = useState<MemberFilters['provider']>('all');
	const [status, setStatus] = useState<MemberFilters['status']>('all');
	const [sortKey, setSortKey] = useState<MemberSortKey>('created_at');
	const [sortDir, setSortDir] = useState<SortDirection>('desc');
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState<PageSize>(10);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [menuId, setMenuId] = useState<string | null>(null);
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [toasts, setToasts] = useState<Toast[]>([]);
	const menuRef = useRef<HTMLDivElement | null>(null);
	const requestIdRef = useRef(0);

	const filters: MemberFilters = useMemo(
		() => ({ query, plan, provider, status }),
		[query, plan, provider, status],
	);

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
			const result = await fetchAdminUsers({ filters, sortKey, sortDir, page, pageSize });
			if (requestId !== requestIdRef.current) return;
			setItems(result.items);
			setTotal(result.total);
			setTotalPages(result.totalPages);
			if (result.kpi) setKpi(result.kpi);
			if (result.page !== page) setPage(result.page);
		} catch (error) {
			if (requestId !== requestIdRef.current) return;
			const message = error instanceof Error ? error.message : '회원 목록을 불러오지 못했습니다.';
			setLoadError(message);
			pushToast(message, 'error');
		} finally {
			if (requestId === requestIdRef.current) setLoading(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [filters, sortKey, sortDir, page, pageSize]);

	useEffect(() => {
		reload();
	}, [reload]);

	useEffect(() => {
		setPage(1);
	}, [query, plan, provider, status, sortKey, sortDir, pageSize]);

	useEffect(() => {
		function onDocClick(event: MouseEvent) {
			if (!menuRef.current) return;
			if (!menuRef.current.contains(event.target as Node)) setMenuId(null);
		}
		document.addEventListener('mousedown', onDocClick);
		return () => document.removeEventListener('mousedown', onDocClick);
	}, []);

	const patchLocal = useCallback((updated: AdminMember) => {
		setItems((prev) => prev.map((member) => (member.id === updated.id ? updated : member)));
	}, []);

	const selected = items.find((member) => member.id === selectedId) ?? null;

	const handleMemoChange = useCallback(
		async (id: string, memo: string) => {
			try {
				const updated = await updateUserMemo(id, memo);
				patchLocal(updated);
			} catch (error) {
				pushToast(error instanceof Error ? error.message : '메모 저장에 실패했습니다.', 'error');
			}
		},
		[patchLocal, pushToast],
	);

	const handleCreditDelta = useCallback(
		async (id: string, delta: number) => {
			setPendingId(id);
			try {
				const updated = await updateUserCredits(id, delta);
				patchLocal(updated);
				const verb = delta >= 0 ? '지급' : '회수';
				pushToast(`${id} 크레딧 ${verb} ${Math.abs(delta)}`);
			} catch (error) {
				pushToast(error instanceof Error ? error.message : '크레딧 변경에 실패했습니다.', 'error');
			} finally {
				setPendingId(null);
			}
		},
		[patchLocal, pushToast],
	);

	const handleRoleChange = useCallback(
		async (id: string, role: MemberRole) => {
			setPendingId(id);
			setMenuId(null);
			try {
				const updated = await updateUserRole(id, role);
				patchLocal(updated);
				pushToast(`${id} 권한을 ${role === 'admin' ? '관리자' : '일반회원'}로 변경`);
			} catch (error) {
				pushToast(error instanceof Error ? error.message : '권한 변경에 실패했습니다.', 'error');
			} finally {
				setPendingId(null);
			}
		},
		[patchLocal, pushToast],
	);

	const handleToggleStatus = useCallback(
		async (id: string) => {
			const current = items.find((member) => member.id === id);
			if (!current || current.status === 'withdrawn') return;
			const nextStatus = current.status === 'active' ? 'suspended' : 'active';
			setPendingId(id);
			setMenuId(null);
			try {
				const updated = await updateUserStatus(id, nextStatus);
				patchLocal(updated);
				pushToast(`${id} 계정 ${nextStatus === 'suspended' ? '정지' : '해제'}`);
			} catch (error) {
				pushToast(error instanceof Error ? error.message : '계정 상태 변경에 실패했습니다.', 'error');
			} finally {
				setPendingId(null);
			}
		},
		[items, patchLocal, pushToast],
	);

	const handleDelete = useCallback(
		async (id: string) => {
			if (typeof window !== 'undefined' && !window.confirm(`${id} 회원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
				return;
			}
			setPendingId(id);
			setMenuId(null);
			try {
				await deleteUser(id);
				if (selectedId === id) setSelectedId(null);
				pushToast(`${id} 회원이 삭제되었습니다.`);
				await reload();
			} catch (error) {
				pushToast(error instanceof Error ? error.message : '회원 삭제에 실패했습니다.', 'error');
			} finally {
				setPendingId(null);
			}
		},
		[pushToast, reload, selectedId],
	);

	const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
	const rangeEnd = Math.min(page * pageSize, total);

	return (
		<div className="flex flex-col gap-5">
			<UserKpiCards kpi={kpi} />

			<section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:bg-slate-800 dark:border-slate-700">
				<div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between dark:border-slate-700">
					<div className="relative min-w-0 flex-1">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
						<input
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="이름 / 이메일 / 도메인 검색"
							className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:bg-slate-800"
						/>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<FilterSelect
							label="플랜"
							value={plan}
							options={PLAN_OPTIONS}
							onChange={(value) => setPlan(value as MembershipPlan | 'all')}
						/>
						<FilterSelect
							label="가입경로"
							value={provider}
							options={PROVIDER_OPTIONS}
							onChange={(value) => setProvider(value as AuthProvider | 'all')}
						/>
						<FilterSelect
							label="상태"
							value={status}
							options={STATUS_OPTIONS}
							onChange={(value) => setStatus(value as MemberFilters['status'])}
						/>
						<FilterSelect
							label="정렬"
							value={sortKey}
							options={SORT_OPTIONS}
							onChange={(value) => setSortKey(value as MemberSortKey)}
						/>
						<button
							type="button"
							onClick={() => setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
							className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700"
							aria-label={sortDir === 'desc' ? '내림차순' : '오름차순'}
							title={sortDir === 'desc' ? '내림차순' : '오름차순'}
						>
							<ArrowDownAZ className={`h-3.5 w-3.5 ${sortDir === 'asc' ? 'rotate-180' : ''}`} />
							{sortDir === 'desc' ? '내림차순' : '오름차순'}
						</button>
						<FilterSelect
							label="페이지당"
							value={String(pageSize)}
							options={PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: `${size}개` }))}
							onChange={(value) => setPageSize(Number(value) as PageSize)}
						/>
					</div>
				</div>

				{loadError && (
					<div className="flex items-center justify-between gap-3 border-b border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700">
						<p>{loadError}</p>
						<button type="button" onClick={() => void reload()} className="inline-flex items-center gap-1 font-semibold underline">
							<RefreshCw className="h-3 w-3" />
							다시 시도
						</button>
					</div>
				)}

				<div className="overflow-x-auto">
					<table className="w-full min-w-[1180px] text-left text-sm">
						<thead>
							<tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-700/60 dark:text-slate-400 dark:border-slate-700">
								<th className="px-4 py-3 font-semibold">회원</th>
								<th className="px-4 py-3 font-semibold">가입구분</th>
								<th className="px-4 py-3 font-semibold">권한</th>
								<th className="px-4 py-3 font-semibold">멤버십 플랜</th>
								<th className="px-4 py-3 font-semibold">크레딧 현황</th>
								<th className="px-4 py-3 font-semibold">최근진단</th>
								<th className="px-4 py-3 font-semibold">가입일</th>
								<th className="px-4 py-3 font-semibold">최근 로그인</th>
								<th className="px-4 py-3 font-semibold">상태</th>
								<th className="px-4 py-3 font-semibold">관리 액션</th>
							</tr>
						</thead>
						<tbody>
							{loading ? (
								<tr>
									<td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
										<span className="inline-flex items-center gap-2">
											<Loader2 className="h-4 w-4 animate-spin" />
											회원 목록을 불러오는 중…
										</span>
									</td>
								</tr>
							) : items.length === 0 ? (
								<tr>
									<td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
										조건에 맞는 회원이 없습니다.
									</td>
								</tr>
							) : (
								items.map((member) => (
									<tr
										key={member.id}
										onClick={() => setSelectedId(member.id)}
										className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50/80  dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:bg-slate-700/50${
											pendingId === member.id ? 'opacity-60' : ''
										}`}
									>
										<td className="px-4 py-3">
											<div className="flex items-center gap-2.5">
												<UserAvatar src={member.profileImage} name={member.name} size={32} />
												<div className="min-w-0">
													<p className="truncate font-semibold text-slate-800 dark:text-slate-100">{member.name}</p>
													<p className="truncate text-xs text-slate-500 dark:text-slate-400">{member.email}</p>
												</div>
											</div>
										</td>
										<td className="px-4 py-3">
											<UserProviderBadge provider={member.provider} />
										</td>
										<td className="px-4 py-3">
											<UserRoleBadge role={member.role} />
										</td>
										<td className="px-4 py-3">
											<UserPlanBadge plan={member.plan} />
										</td>
										<td className="px-4 py-3">
											<UserCreditBar member={member} />
										</td>
										<td className="px-4 py-3">
											<UserScoreBadge score={member.last_audit_score} />
										</td>
										<td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
											{formatDateTime(member.created_at)}
										</td>
										<td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
											{formatDateTime(member.last_login_at)}
										</td>
										<td className="px-4 py-3">
											<UserStatusBadge status={member.status} />
										</td>
										<td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
											<div className="relative flex items-center gap-1" ref={menuId === member.id ? menuRef : undefined}>
												<button
													type="button"
													onClick={() => setSelectedId(member.id)}
													className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
													title="상세보기"
													aria-label={`${member.id} 상세보기`}
												>
													<Eye className="h-3.5 w-3.5" />
												</button>
												<button
													type="button"
													disabled={pendingId === member.id}
													onClick={() => handleCreditDelta(member.id, INSTANT_CREDIT)}
													className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
													title={`크레딧 +${INSTANT_CREDIT} 즉시 충전`}
													aria-label={`${member.id} 크레딧 즉시 충전`}
												>
													<Coins className="h-3.5 w-3.5" />
												</button>
												<button
													type="button"
													onClick={() => setMenuId((prev) => (prev === member.id ? null : member.id))}
													className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-slate-200 px-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
													aria-expanded={menuId === member.id}
													aria-haspopup="menu"
													title="계정 상태"
												>
													<ChevronDown className="h-3.5 w-3.5" />
												</button>
												{menuId === member.id && (
													<div
														role="menu"
														className="absolute bottom-9 right-0 z-20 min-w-[160px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:bg-slate-800 dark:border-slate-700"
													>
														<button
															type="button"
															role="menuitem"
															onClick={() => handleRoleChange(member.id, member.role === 'admin' ? 'user' : 'admin')}
															className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
														>
															<Shield className="h-3.5 w-3.5 text-indigo-500" />
															{member.role === 'admin' ? '일반회원으로 변경' : '관리자로 승격'}
														</button>
														{member.status !== 'withdrawn' && (
															<button
																type="button"
																role="menuitem"
																onClick={() => handleToggleStatus(member.id)}
																className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
															>
																{member.status === 'active' ? (
																	<>
																		<Ban className="h-3.5 w-3.5 text-rose-500" />
																		계정 정지
																	</>
																) : (
																	<>
																		<ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
																		정지 해제
																	</>
																)}
															</button>
														)}
														<button
															type="button"
															role="menuitem"
															onClick={() => handleDelete(member.id)}
															className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50"
														>
															<Trash2 className="h-3.5 w-3.5" />
															회원 삭제
														</button>
													</div>
												)}
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
						{total.toLocaleString('ko-KR')}명 중 {rangeStart}–{rangeEnd}
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

			{selected && (
				<UserDetailModal
					member={selected}
					onClose={() => setSelectedId(null)}
					onMemoChange={handleMemoChange}
					onCreditDelta={handleCreditDelta}
					onToggleStatus={handleToggleStatus}
					onRoleChange={handleRoleChange}
					onDelete={handleDelete}
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
							{toast.tone === 'error' && <UserX className="h-3.5 w-3.5" />}
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
