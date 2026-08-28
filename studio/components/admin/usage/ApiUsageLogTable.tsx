import { ArrowDownAZ, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import {
	PAGE_SIZE,
	SERVICE_FILTER_OPTIONS,
	SORT_OPTIONS,
	STATUS_FILTER_OPTIONS,
	formatCalledAt,
	formatTokens,
	formatUsd,
	type ApiServiceFilter,
	type ApiStatusFilter,
	type ApiUsageLog,
	type ApiUsageSortKey,
	type SortDirection,
} from '@/lib/admin/api-usage';
import { LatencyBadge, PlanBadge, ProviderDot, StatusBadge } from './api-usage-badges';
import { ServiceModelIcon } from './ServiceModelIcon';

const SELECT_CLASS =
	'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-500';

interface ApiUsageLogTableProps {
	query: string;
	onQueryChange: (value: string) => void;
	service: ApiServiceFilter;
	onServiceChange: (value: ApiServiceFilter) => void;
	status: ApiStatusFilter;
	onStatusChange: (value: ApiStatusFilter) => void;
	sortKey: ApiUsageSortKey;
	onSortKeyChange: (value: ApiUsageSortKey) => void;
	sortDir: SortDirection;
	onSortDirChange: (value: SortDirection) => void;
	page: number;
	onPageChange: (page: number) => void;
	rows: ApiUsageLog[];
	filteredCount: number;
	totalPages: number;
}

export function ApiUsageLogTable({
	query,
	onQueryChange,
	service,
	onServiceChange,
	status,
	onStatusChange,
	sortKey,
	onSortKeyChange,
	sortDir,
	onSortDirChange,
	page,
	onPageChange,
	rows,
	filteredCount,
	totalPages,
}: ApiUsageLogTableProps) {
	const rangeStart = filteredCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
	const rangeEnd = Math.min(page * PAGE_SIZE, filteredCount);

	return (
		<section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
			<div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-700 lg:flex-row lg:items-center lg:justify-between">
				<div>
					<div className="flex items-center gap-2">
						<h2 className="text-sm font-bold text-slate-900 dark:text-white">실시간 API 호출 로그</h2>
						<span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
							<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
							LIVE
						</span>
					</div>
					<p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
						서비스 · 상태 · 도메인/이메일 필터와 비용/시간/지연 정렬
					</p>
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-2 lg:max-w-3xl lg:flex-row lg:items-center lg:justify-end">
					<div className="relative min-w-0 flex-1">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
						<input
							type="search"
							value={query}
							onChange={(event) => onQueryChange(event.target.value)}
							placeholder="도메인 / 이메일 / 모델 검색"
							className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:bg-slate-900 dark:focus:ring-cyan-500/20 dark:placeholder:text-slate-500"
						/>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<FilterSelect
							label="서비스"
							value={String(service)}
							options={SERVICE_FILTER_OPTIONS.map((option) => ({
								value: option.value,
								label: option.label,
							}))}
							onChange={(value) => onServiceChange(value as ApiServiceFilter)}
						/>
						<FilterSelect
							label="상태"
							value={String(status)}
							options={STATUS_FILTER_OPTIONS.map((option) => ({
								value: String(option.value),
								label: option.label,
							}))}
							onChange={(value) =>
								onStatusChange(value === 'all' ? 'all' : (Number(value) as ApiStatusFilter))
							}
						/>
						<FilterSelect
							label="정렬"
							value={sortKey}
							options={SORT_OPTIONS}
							onChange={(value) => onSortKeyChange(value as ApiUsageSortKey)}
						/>
						<button
							type="button"
							onClick={() => onSortDirChange(sortDir === 'desc' ? 'asc' : 'desc')}
							className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
							aria-label={sortDir === 'desc' ? '내림차순' : '오름차순'}
							title={sortDir === 'desc' ? '내림차순' : '오름차순'}
						>
							<ArrowDownAZ className={`h-3.5 w-3.5 ${sortDir === 'asc' ? 'rotate-180' : ''}`} />
							{sortDir === 'desc' ? '내림차순' : '오름차순'}
						</button>
					</div>
				</div>
			</div>

			<div className="overflow-x-auto">
				<table className="w-full min-w-[1180px] text-left text-sm">
					<thead>
						<tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
							<SortHeader
								label="호출 일시"
								active={sortKey === 'calledAt'}
								direction={sortDir}
								onClick={() => onSortKeyChange('calledAt')}
							/>
							<th className="px-4 py-3 font-semibold">회원종류</th>
							<th className="px-4 py-3 font-semibold">사용자 아이디</th>
							<th className="px-4 py-3 font-semibold">서비스 / 모델</th>
							<th className="px-4 py-3 font-semibold">진단 대상 도메인</th>
							<th className="px-4 py-3 font-semibold">사용량</th>
							<SortHeader
								label="추정 원가"
								active={sortKey === 'costUsd'}
								direction={sortDir}
								onClick={() => onSortKeyChange('costUsd')}
							/>
							<SortHeader
								label="지연시간"
								active={sortKey === 'latencyMs'}
								direction={sortDir}
								onClick={() => onSortKeyChange('latencyMs')}
							/>
							<th className="px-4 py-3 font-semibold">상태</th>
						</tr>
					</thead>
					<tbody>
						{rows.length === 0 ? (
							<tr>
								<td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
									조건에 맞는 호출 로그가 없습니다.
								</td>
							</tr>
						) : (
							rows.map((row) => (
								<tr
									key={row.id}
									className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 dark:border-slate-700/70 dark:hover:bg-slate-800/40"
								>
									<td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
										{formatCalledAt(row.calledAt)}
									</td>
									<td className="px-4 py-3">
										<PlanBadge plan={row.plan} />
									</td>
									<td className="px-4 py-3">
										<p className="text-xs font-medium text-slate-800 dark:text-slate-100">{row.userEmail}</p>
									</td>
									<td className="px-4 py-3">
										<div className="flex items-center gap-2">
											<ServiceModelIcon provider={row.provider} />
											<div>
												<p className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">
													<ProviderDot provider={row.provider} />
													{row.modelLabel}
												</p>
												<p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{row.provider}</p>
											</div>
										</div>
									</td>
									<td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
										{row.domain}
									</td>
									<td className="px-4 py-3">
										<p className="font-mono text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-100">
											{row.usageUnit === 'tokens'
												? `${formatTokens(row.usageAmount)} Tokens`
												: '1 Request'}
										</p>
										{row.usageUnit === 'tokens' && row.promptTokens != null && row.completionTokens != null && (
											<p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
												P {formatTokens(row.promptTokens)} / C {formatTokens(row.completionTokens)}
											</p>
										)}
									</td>
									<td className="px-4 py-3 font-mono text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-100">
										{formatUsd(row.costUsd)}
									</td>
									<td className="px-4 py-3">
										<LatencyBadge ms={row.latencyMs} />
									</td>
									<td className="px-4 py-3">
										<StatusBadge status={row.status} />
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
				<p className="text-xs text-slate-500 dark:text-slate-400">
					{filteredCount.toLocaleString('ko-KR')}건 중 {rangeStart}–{rangeEnd}
				</p>
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						disabled={page <= 1}
						onClick={() => onPageChange(Math.max(1, page - 1))}
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
						onClick={() => onPageChange(Math.min(totalPages, page + 1))}
						className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
					>
						다음
						<ChevronRight className="h-3.5 w-3.5" />
					</button>
				</div>
			</div>
		</section>
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

function SortHeader({
	label,
	active,
	direction,
	onClick,
}: {
	label: string;
	active: boolean;
	direction: SortDirection;
	onClick: () => void;
}) {
	return (
		<th className="px-4 py-3 font-semibold">
			<button
				type="button"
				onClick={onClick}
				className={`inline-flex items-center gap-1 uppercase tracking-wide ${
					active ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
				}`}
			>
				{label}
				{active && <span className="text-[9px]">{direction === 'desc' ? '▼' : '▲'}</span>}
			</button>
		</th>
	);
}
