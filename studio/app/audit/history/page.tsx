'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { AuditHistoryList } from '@/components/AuditHistoryList';
import {
	dedupeHistoryEntries,
	getGuestAudits,
	isHealthyStatus,
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

	useEffect(() => {
		if (authStatus === 'loading') return;

		let cancelled = false;

		(async () => {
			setLoading(true);
			setError(null);

			try {
				const guestItems = getGuestAudits();

				if (session?.user) {
					const res = await fetch('/api/audit/history');
					const data = await res.json();
					if (!res.ok) throw new Error(data.error ?? 'Failed to load history.');
					const serverItems = (data.items as AuditHistoryEntry[]) ?? [];
					const seen = new Set(serverItems.map((item) => item.id));
					const merged = dedupeHistoryEntries([
						...serverItems,
						...guestItems.filter((item) => !seen.has(item.id)),
					]);
					if (!cancelled) setItems(merged);
				} else if (!cancelled) {
					setItems(guestItems);
				}
			} catch (err) {
				if (!cancelled) {
					// Fall back to guest cache if the member API fails.
					setItems(getGuestAudits());
					setError((err as Error).message);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [session, authStatus]);

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

			if (session?.user) {
				const res = await fetch(`/api/audit/${encodeURIComponent(id)}`, { method: 'DELETE' });
				const data = await res.json().catch(() => ({}));
				// 401/403/404: still drop from UI — guest cache already cleared.
				if (!res.ok && res.status !== 401 && res.status !== 403 && res.status !== 404) {
					throw new Error(data.error ?? t('deleteFailed'));
				}
			}

			setItems((prev) => prev.filter((item) => item.id !== id));
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setDeletingId(null);
		}
	}

	return (
		<main className="flex flex-col gap-6">
			<div>
				<Link href="/" className="text-sm text-slate-400 hover:text-white">
					{t('backToHome')}
				</Link>
			</div>

			<header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-2xl font-extrabold text-white">{t('title')}</h1>
					<p className="mt-1 text-sm text-slate-400">
						{t('totalCount', { count: items.length })}
						{!session?.user ? ` · ${t('guestHint')}` : null}
					</p>
				</div>
				<Link
					href="/"
					className="w-fit rounded-xl border border-white/[0.08] bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10"
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
					className="w-full flex-1 rounded-xl border border-white/[0.08] bg-black/40 px-4 py-3 text-sm text-slate-100 outline-none focus:border-accent"
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
									: 'border border-white/[0.08] bg-white/5 text-slate-400 hover:text-white'
							}`}
						>
							{label}
						</button>
					))}
				</div>
			</div>

			{error && (
				<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
					{error}
				</div>
			)}

			{loading && <div className="h-40 animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.03]" />}

			{!loading && items.length === 0 && (
				<div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] px-6 py-16 text-center">
					<p className="text-base font-semibold text-slate-200">{t('emptyTitle')}</p>
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
				<div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-10 text-center text-sm text-slate-500">
					{t('noMatches')}
				</div>
			)}

			{!loading && filtered.length > 0 && (
				<AuditHistoryList items={filtered} onDelete={handleDelete} deletingId={deletingId} />
			)}
		</main>
	);
}
