'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AuditHistoryList } from '@/components/AuditHistoryList';
import { useAuditHistory } from '@/lib/audit/use-audit-history';
import { notifyAuditHistorySync, removeGuestAudit } from '@/lib/audit-history-storage';

const HOME_HISTORY_PREVIEW = 3;

export function HomeAuditHistorySection() {
	const t = useTranslations('audit.history');
	const { signedIn, historyList, setHistoryList, loading } = useAuditHistory();
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const preview = historyList.slice(0, HOME_HISTORY_PREVIEW);

	async function handleDelete(id: string) {
		setDeletingId(id);
		try {
			removeGuestAudit(id);
			setHistoryList((prev) => prev.filter((item) => item.id !== id));
			if (signedIn) {
				await fetch(`/api/audit/${encodeURIComponent(id)}`, { method: 'DELETE' });
			}
			notifyAuditHistorySync({ ids: [id] });
		} finally {
			setDeletingId(null);
		}
	}

	if (loading && historyList.length === 0) return null;
	if (preview.length === 0) return null;

	return (
		<section className="mx-auto w-full max-w-[960px] px-5 py-10 sm:px-6">
			<div className="mb-10 flex items-end justify-between gap-3">
				<div>
					<h2 className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">{t('title')}</h2>
					<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
						{signedIn ? t('signedInHint') : t('guestHint')}
					</p>
				</div>
				<Link
					href="/audit/history"
					className="shrink-0 text-sm font-semibold text-cyan-700 transition hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200"
				>
					{t('totalCount', { count: historyList.length })} →
				</Link>
			</div>
			<AuditHistoryList items={preview} onDelete={handleDelete} deletingId={deletingId} />
		</section>
	);
}
