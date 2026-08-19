'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { AuditHistoryList } from '@/components/AuditHistoryList';
import { HISTORY_VIEW_ALL, HistoryPaginationBar } from '@/components/audit/HistoryPaginationBar';
import { PageListLoader } from '@/components/ui/PageListLoader';
import {
	AUDIT_HISTORY_SYNC_CHANNEL,
	AUDIT_HISTORY_SYNC_KEY,
	dedupeHistoryEntries,
	filterDeletedHistoryEntries,
	getGuestAudits,
	isHealthyStatus,
	notifyAuditHistorySync,
	pruneGuestAuditsToServerIds,
	removeGuestAudit,
	type AuditHistoryEntry,
} from '@/lib/audit-history-storage';

type StatusFilter = 'all' | 'healthy' | 'needsImprovement';

export default function AuditHistoryPage() {
	const t = useTranslations('audit.history');
	const { data: session, status: authStatus } = useSession();
	const [items, setItems] = useState<AuditHistoryEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
	const [viewCount, setViewCount] = useState(10);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [syncTick, setSyncTick] = useState(0);

	const loadHistory = useCallback(
		async (opts?: { quiet?: boolean }) => {
			if (!opts?.quiet) {
				setLoading(true);
				setError(null);
			}

			try {
				const guestItems = getGuestAudits();
				const res = await fetch('/api/audit/history', { cache: 'no-store' });
				const data = await res.json();
				if (!res.ok) throw new Error(data.error ?? 'Failed to load history.');
				const serverItems = (data.items as AuditHistoryEntry[]) ?? [];
				const serverIds = new Set(serverItems.map((item) => item.id));

				// Firestore is the shared admin/frontend store — drop guest rows admin already deleted.
				if (data.source === 'firestore') {
					pruneGuestAuditsToServerIds(serverIds);
					setItems(filterDeletedHistoryEntries(dedupeHistoryEntries(serverItems)));
					return;
				}

				const merged = filterDeletedHistoryEntries(
					dedupeHistoryEntries([
						...serverItems,
						...guestItems.filter((item) => !serverIds.has(item.id)),
					]),
				);
				setItems(merged);
			} catch (err) {
				// Fall back to guest cache if the history API fails.
				setItems(filterDeletedHistoryEntries(getGuestAudits()));
				setError((err as Error).message);
			} finally {
				if (!opts?.quiet) setLoading(false);
			}
		},
		[],
	);

	useEffect(() => {
		if (authStatus === 'loading') return;
		// Initial load shows skeleton; sync/visibility refetches stay quiet.
		void loadHistory({ quiet: syncTick > 0 });
	}, [session, authStatus, syncTick, loadHistory]);

	// Admin (or another tab) deleted projects — refetch without a manual reload.
	useEffect(() => {
		const bump = () => setSyncTick((n) => n + 1);

		const onStorage = (event: StorageEvent) => {
			if (event.key === AUDIT_HISTORY_SYNC_KEY) bump();
		};
		const onCustom = () => bump();
		const onVisible = () => {
			if (document.visibilityState === 'visible') bump();
		};

		window.addEventListener('storage', onStorage);
		window.addEventListener(AUDIT_HISTORY_SYNC_CHANNEL, onCustom as EventListener);
		document.addEventListener('visibilitychange', onVisible);

		let channel: BroadcastChannel | null = null;
		try {
			channel = new BroadcastChannel(AUDIT_HISTORY_SYNC_CHANNEL);
			channel.onmessage = () => bump();
		} catch {
			channel = null;
		}

		return () => {
			window.removeEventListener('storage', onStorage);
			window.removeEventListener(AUDIT_HISTORY_SYNC_CHANNEL, onCustom as EventListener);
			document.removeEventListener('visibilitychange', onVisible);
			channel?.close();
		};
	}, []);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return items.filter((item) => {
			if (q && !item.url.toLowerCase().includes(q) && !item.statusLabel.toLowerCase().includes(q)) {
				return false;
			}
			if (statusFilter === 'healthy' && !isHealthyStatus(item.status)) return false;
			if (statusFilter === 'needsImprovement' && isHealthyStatus(item.status)) return false;
			return true;
		});
	}, [items, query, statusFilter]);

	const totalItems = filtered.length;
	const currentPagedList =
		viewCount === HISTORY_VIEW_ALL ? filtered : filtered.slice(0, viewCount);

	async function handleDelete(id: string) {
		setDeletingId(id);
		setError(null);
		try {
			removeGuestAudit(id);
			setItems((prev) => prev.filter((item) => item.id !== id));

			const res = await fetch(`/api/audit/${encodeURIComponent(id)}`, { method: 'DELETE' });
			const data = await res.json().catch(() => ({}));
			// 401/403/404: keep the card hidden locally (tombstone). Only surface hard failures.
			if (!res.ok && res.status !== 401 && res.status !== 403 && res.status !== 404) {
				throw new Error((data as { error?: string }).error ?? t('deleteFailed'));
			}

			notifyAuditHistorySync({ ids: [id] });
		} catch (err) {
			setError((err as Error).message);
			setItems((prev) => prev.filter((item) => item.id !== id));
		} finally {
			setDeletingId(null);
		}
	}

	return (
		<main className="flex flex-col gap-6">
			<div>
				<Link href="/" className="text-sm text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
					{t('backToHome')}
				</Link>
			</div>

			<header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{t('title')}</h1>
					<p className="mt-1 text-sm text-slate-600 dark:text-slate-300/80">
						{t('totalCount', { count: items.length })}
						{!session?.user ? ` · ${t('guestHint')}` : null}
					</p>
				</div>
				<Link
					href="/"
					className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-cyan-500 hover:bg-cyan-500 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
				>
					{t('newAudit')}
				</Link>
			</header>

			<div className="flex flex-col gap-3 sm:flex-row">
				<input
					type="search"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder={t('searchPlaceholder')}
					className="w-full flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:border-slate-800 dark:bg-slate-950/90 dark:text-white dark:placeholder-slate-500"
				/>
				<div className="flex gap-2">
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
							className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
								statusFilter === value
									? 'border border-cyan-500 bg-cyan-500 text-slate-950'
									: 'border border-slate-200 bg-white text-slate-600 hover:border-cyan-500/40 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-[#0E162B] dark:hover:text-white'
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

			{!loading && items.length === 0 && (
				<div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center backdrop-blur-sm dark:border-slate-800/80 dark:bg-[#0B1120]/80">
					<p className="text-base font-semibold text-slate-800 dark:text-white">{t('emptyTitle')}</p>
					<p className="max-w-md text-sm text-slate-500 dark:text-slate-300/80">{t('emptyDescription')}</p>
					<Link
						href="/"
						className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-900/40 transition-all hover:from-cyan-400 hover:to-blue-500"
					>
						{t('emptyCta')}
					</Link>
				</div>
			)}

			{!loading && items.length > 0 && filtered.length === 0 && (
				<div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 backdrop-blur-sm dark:border-slate-800/80 dark:bg-[#0B1120]/80 dark:text-slate-300/80">
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
		</main>
	);
}
