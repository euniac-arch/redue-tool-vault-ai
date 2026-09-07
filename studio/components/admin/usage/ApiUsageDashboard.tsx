'use client';

import { useEffect, useMemo, useState } from 'react';
import {
	DEFAULT_BUDGET_CONTROL,
	PAGE_SIZE,
	cloneUsageLogs,
	filterUsageLogs,
	paginateUsageLogs,
	persistBudgetControl,
	readBudgetControl,
	sortUsageLogs,
	type ApiServiceFilter,
	type ApiStatusFilter,
	type ApiUsageSortKey,
	type BudgetControlState,
	type SortDirection,
} from '@/lib/admin/api-usage';
import { ApiQuotaSection } from './ApiQuotaSection';
import { ApiServiceGroupPanel } from './ApiServiceGroupPanel';
import { ApiUsageKpiCards } from './ApiUsageKpiCards';
import { ApiUsageLogTable } from './ApiUsageLogTable';

export function ApiUsageDashboard() {
	const [logs] = useState(() => cloneUsageLogs());
	const [query, setQuery] = useState('');
	const [service, setService] = useState<ApiServiceFilter>('all');
	const [status, setStatus] = useState<ApiStatusFilter>('all');
	const [sortKey, setSortKey] = useState<ApiUsageSortKey>('calledAt');
	const [sortDir, setSortDir] = useState<SortDirection>('desc');
	const [page, setPage] = useState(1);
	const [budget, setBudget] = useState<BudgetControlState>(DEFAULT_BUDGET_CONTROL);

	useEffect(() => {
		setBudget(readBudgetControl());
	}, []);

	const filtered = useMemo(() => filterUsageLogs(logs, { query, service, status }), [logs, query, service, status]);
	const sorted = useMemo(() => sortUsageLogs(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);
	const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
	const safePage = Math.min(page, totalPages);
	const pageRows = useMemo(() => paginateUsageLogs(sorted, safePage), [sorted, safePage]);

	useEffect(() => {
		setPage(1);
	}, [query, service, status, sortKey, sortDir]);

	const handleBudgetChange = (next: BudgetControlState) => {
		setBudget(next);
		persistBudgetControl(next);
	};

	const handleSortKeyChange = (next: ApiUsageSortKey) => {
		if (next === sortKey) {
			setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
			return;
		}
		setSortKey(next);
		setSortDir('desc');
	};

	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
						API &amp; Quota Management
					</p>
					<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
						API 사용량 및 쿼터 관리
					</h1>
					<p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
						회원/비회원별 AI 리서치 · 유튜브 검색 · 진단 API 일일 호출과 잔여 쿼터를 모니터링합니다.
					</p>
				</div>
			</div>

			<ApiQuotaSection />
			<ApiUsageKpiCards />
			<ApiServiceGroupPanel budget={budget} onBudgetChange={handleBudgetChange} />
			<ApiUsageLogTable
				query={query}
				onQueryChange={setQuery}
				service={service}
				onServiceChange={setService}
				status={status}
				onStatusChange={setStatus}
				sortKey={sortKey}
				onSortKeyChange={handleSortKeyChange}
				sortDir={sortDir}
				onSortDirChange={setSortDir}
				page={safePage}
				onPageChange={setPage}
				rows={pageRows}
				filteredCount={sorted.length}
				totalPages={totalPages}
			/>
		</div>
	);
}
