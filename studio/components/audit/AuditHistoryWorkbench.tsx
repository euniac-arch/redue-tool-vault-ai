'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AuditHistoryList } from '@/components/AuditHistoryList';
import { HISTORY_VIEW_ALL, HistoryPaginationBar } from '@/components/audit/HistoryPaginationBar';
import { PageListLoader } from '@/components/ui/PageListLoader';
import { useAuditHistory } from '@/lib/audit/use-audit-history';
import { deleteAuditHistoryEverywhere, isHealthyStatus } from '@/lib/audit-history-storage';

type StatusFilter = 'all' | 'healthy' | 'needsImprovement';

export function AuditHistoryWorkbench({ compact = false }: { compact?: boolean }) {
	const t = useTranslations('audit.history');
	const {
		session,
		historyList,
		setHistoryList,
		loadHistory,
		loading,
		error,
		setError,
	} = useAuditHistory();
	const [query, setQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
	const [viewCount, setViewCount] = useState(10);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return historyList.filter((item) => {
			if (q && !item.url.toLowerCase().includes(q) && !item.statusLabel.toLowerCase().includes(q)) {
				return false;
			}
			if (statusFilter === 'healthy' && !isHealthyStatus(item.status)) return false;
			if (statusFilter === 'needsImprovement' && isHealthyStatus(item.status)) return false;
			return true;
		});
	}, [historyList, query, statusFilter]);

	const totalItems = filtered.length;
	const currentPagedList = viewCount === HISTORY_VIEW_ALL ? filtered : filtered.slice(0, viewCount);

	async function handleDelete(id: string) {
		setDeletingId(id);
		setError(null);
		try {
			setHistoryList((prev) => prev.filter((item) => item.id !== id));
			await deleteAuditHistoryEverywhere(id);
		} catch (err) {
			setError((err as Error).message);
			void loadHistory({ quiet: true });
		} finally {
			setDeletingId(null);
		}
	}

	return (
		<div className="flex flex-col gap-6">
			{compact ? null : (
				<header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">{t('title')}</h2>
						<p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
							{t('totalCount', { count: historyList.length })}
							{!session?.user ? ` · ${t('guestHint')}` : ` · ${t('signedInHint')}`}
						</p>
					</div>
					<Link
						href="/audit"
						className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-cyan-500 hover:bg-cyan-500 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
					>
						{t('newAudit')}
					</Link>
				</header>
			)}

			{compact ? (
				<p className="text-sm text-zinc-500 dark:text-zinc-400">
					{t('totalCount', { count: historyList.length })}
					{!session?.user ? ` · ${t('guestHint')}` : ` · ${t('signedInHint')}`}
				</p>
			) : null}

			<div className="flex flex-col gap-3 sm:flex-row">
				<input
					type="search"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder={t('searchPlaceholder')}
					className="theme-input flex-1"
				/>
				<div className="flex flex-wrap items-center gap-2">
					{(
						[
							['all', t('filterAll')],
							['healthy', t('filterHealthy')],
							['needsImprovement', t('filterNeedsImprovement')],
						] as const
					).map(([value, label]) => (
						<button
							key={value}
							type="button"
							onClick={() => setStatusFilter(value)}
							className={`rounded-xl border px-3 py-2 text-xs transition-all duration-150 ${
								statusFilter === value
									? 'border-cyan-400/60 bg-white font-semibold text-slate-900 shadow-md shadow-black/10 dark:border-cyan-500/50 dark:bg-[#13233a] dark:text-white dark:shadow-black/30'
									: 'border-slate-200 bg-white font-medium text-slate-400 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700 dark:border-cyan-900/40 dark:bg-[#0a1626]/80 dark:text-slate-500 dark:hover:border-cyan-800/50 dark:hover:bg-slate-800/40 dark:hover:text-slate-200'
							}`}
						>
							{label}
						</button>
					))}
				</div>
			</div>

			{error && (
				<div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
					{error}
				</div>
			)}

			{loading && <PageListLoader label={t('listLoading')} />}

			{!loading && historyList.length === 0 && (
				<div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-16 text-center dark:border-zinc-800 dark:bg-[#0f1319]">
					<p className="text-base font-semibold text-zinc-800 dark:text-zinc-100">{t('emptyTitle')}</p>
					<p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">{t('emptyDescription')}</p>
					<Link
						href="/audit"
						className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-900/40 transition-all hover:from-cyan-400 hover:to-blue-500"
					>
						{t('emptyCta')}
					</Link>
				</div>
			)}

			{!loading && historyList.length > 0 && filtered.length === 0 && (
				<div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-[#0f1319] dark:text-zinc-400">
					{t('noMatches')}
				</div>
			)}

			{!loading && filtered.length > 0 && (
				<div>
					<HistoryPaginationBar
						totalItems={totalItems}
						viewCount={viewCount}
						onViewCountChange={setViewCount}
					/>
					<AuditHistoryList
						items={currentPagedList}
						onDelete={handleDelete}
						deletingId={deletingId}
					/>
				</div>
			)}
		</div>
	);
}
