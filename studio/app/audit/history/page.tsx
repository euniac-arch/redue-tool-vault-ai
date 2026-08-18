'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { AuditHistoryList } from '@/components/AuditHistoryList';
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
				<Link href="/" className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
					{t('backToHome')}
				</Link>
			</div>

			<header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{t('title')}</h1>
					<p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
						{t('totalCount', { count: items.length })}
						{!session?.user ? ` · ${t('guestHint')}` : null}
					</p>
				</div>
				<Link
					href="/"
					className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/[0.08] dark:bg-white/5 dark:text-slate-200 dark:shadow-none dark:hover:border-white/20 dark:hover:bg-white/10"
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
					className="w-full flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-accent dark:border-white/[0.08] dark:bg-black/40 dark:text-slate-100"
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
							className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
								statusFilter === value
									? 'bg-accent text-white shadow-lg shadow-accent/20'
									: 'border border-slate-200 bg-white text-slate-600 hover:text-slate-900 dark:border-white/[0.08] dark:bg-white/5 dark:text-slate-400 dark:hover:text-white'
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

			{loading && <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-white/[0.08] dark:bg-[#111419]" />}

			{!loading && items.length === 0 && (
				<div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-white/[0.12] dark:bg-[#111419]">
					<p className="text-base font-semibold text-slate-800 dark:text-slate-200">{t('emptyTitle')}</p>
					<p className="max-w-md text-sm text-slate-500">{t('emptyDescription')}</p>
					<Link
						href="/"
						className="rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white shadow-lg shadow-accent/30 transition hover:bg-accent-light"
					>
						{t('emptyCta')}
					</Link>
				</div>
			)}

			{!loading && items.length > 0 && filtered.length === 0 && (
				<div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm dark:border-white/[0.08] dark:bg-[#111419] dark:shadow-none">
					{t('noMatches')}
				</div>
			)}

			{!loading && filtered.length > 0 && (
				<AuditHistoryList
					items={filtered}
					onDelete={handleDelete}
					deletingId={deletingId}
				/>
			)}
		</main>
	);
}
