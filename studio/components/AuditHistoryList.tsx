'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
	isHealthyStatus,
	notifyAuditHistorySync,
	scanSiteOnce,
	upsertGuestAuditOnRescan,
	type AuditHistoryEntry,
} from '@/lib/audit-history-storage';
import type { AuditOverallStatus, AuditReport } from '@/lib/site-auditor';

const STATUS_SCORE_COLOR: Record<AuditOverallStatus, string> = {
	CRITICAL: 'text-rose-400',
	POOR: 'text-rose-400',
	FAIR: 'text-amber-400',
	GOOD: 'text-emerald-400',
	EXCELLENT: 'text-emerald-400',
};

const CATEGORY_ICON: Record<string, string> = {
	seo: '🔎',
	performance: '⚡',
	schema: '🧩',
	accessibility: '♿',
	geo: '🤖',
};

function siteLabelFromUrl(raw: string): string {
	try {
		return new URL(raw).hostname.replace(/^www\./, '') || raw;
	} catch {
		return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || raw;
	}
}

interface AuditHistoryListProps {
	items: AuditHistoryEntry[];
	onDelete: (id: string) => Promise<void> | void;
	deletingId?: string | null;
	/** Called after a successful re-scan so the parent can refresh scores in-place. */
	onRescanned?: (entry: AuditHistoryEntry) => void;
}

export function AuditHistoryList({
	items,
	onDelete,
	deletingId = null,
	onRescanned,
}: AuditHistoryListProps) {
	const t = useTranslations('audit.history');
	const locale = useLocale();
	const router = useRouter();
	const dateLocale = locale === 'en' ? 'en-US' : 'ko-KR';
	const [confirmId, setConfirmId] = useState<string | null>(null);
	const [rescanningId, setRescanningId] = useState<string | null>(null);
	const [rescanError, setRescanError] = useState<string | null>(null);

	async function handleDelete(id: string) {
		await onDelete(id);
		setConfirmId(null);
	}

	async function handleRescan(item: AuditHistoryEntry) {
		if (rescanningId) return;
		setRescanningId(item.id);
		setRescanError(null);

		try {
			const data = await scanSiteOnce(item.url, locale, {
				forceRefresh: true,
				replaceId: item.id,
			});
			const { id, ...rest } = data;
			const nextReport = rest as AuditReport;
			const nextId = (id && String(id).trim()) || item.id;

			const entry = upsertGuestAuditOnRescan(nextId, nextReport, { replaceId: item.id });
			notifyAuditHistorySync({ ids: [nextId, item.id] });
			onRescanned?.(entry);

			router.push(`/audit/result?id=${encodeURIComponent(nextId)}&t=${Date.now()}`);
		} catch (err) {
			setRescanError((err as Error).message || t('rescanFailed'));
		} finally {
			setRescanningId(null);
		}
	}

	return (
		<ul className="flex flex-col gap-3">
			{items.map((item) => {
				const healthy = isHealthyStatus(item.status);
				const scoreColor = STATUS_SCORE_COLOR[item.status];
				const isDeleting = deletingId === item.id;
				const awaitingConfirm = confirmId === item.id;
				const isRescanning = rescanningId === item.id;

				return (
					<li
						key={item.id}
						className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5"
					>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div className="min-w-0 flex-1">
								<a
									href={item.url}
									target="_blank"
									rel="noopener noreferrer"
									className="block truncate font-mono text-sm text-slate-200 hover:text-accent-light"
									title={item.url}
								>
									{siteLabelFromUrl(item.url)}
								</a>
								<p className="mt-1 text-xs text-slate-500">
									{new Date(item.createdAt).toLocaleString(dateLocale, {
										year: 'numeric',
										month: '2-digit',
										day: '2-digit',
										hour: '2-digit',
										minute: '2-digit',
									})}
								</p>
							</div>

							<div className="flex shrink-0 items-center gap-2">
								<span className={`text-2xl font-extrabold tabular-nums ${scoreColor}`}>
									{item.score}
									<span className="text-sm font-semibold text-slate-500">/{item.maxScore}</span>
								</span>
								<span
									className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
										healthy
											? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
											: 'border border-amber-500/30 bg-amber-500/10 text-amber-300'
									}`}
								>
									{item.statusLabel}
								</span>
							</div>
						</div>

						<div className="flex flex-wrap gap-1.5">
							{item.categories.map((cat) => {
								const pass = cat.status === 'PASS';
								return (
									<span
										key={cat.id}
										className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium ${
											pass
												? 'border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300'
												: 'border-rose-500/20 bg-rose-500/[0.08] text-rose-300'
										}`}
										title={`${cat.label}: ${cat.score}/${cat.maxScore}`}
									>
										<span>{CATEGORY_ICON[cat.id] ?? '•'}</span>
										<span className="max-w-[7rem] truncate">{cat.label}</span>
										<span className="tabular-nums opacity-80">
											{cat.score}/{cat.maxScore}
										</span>
									</span>
								);
							})}
						</div>

						{rescanError && !rescanningId ? (
							<p className="text-xs text-rose-300" role="alert">
								{rescanError}
							</p>
						) : null}

						<div className="flex flex-wrap items-center gap-2">
							<Link
								href={`/audit/result?id=${encodeURIComponent(item.id)}`}
								className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white shadow-lg shadow-accent/20 transition hover:bg-accent-light"
							>
								{t('viewResult')}
							</Link>
							<button
								type="button"
								disabled={Boolean(rescanningId) || isDeleting}
								onClick={() => void handleRescan(item)}
								className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-wait disabled:opacity-70"
							>
								{isRescanning ? (
									<>
										<span
											className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300"
											aria-hidden
										/>
										<span>{t('rescanning')}</span>
									</>
								) : (
									t('rescan')
								)}
							</button>
							{awaitingConfirm ? (
								<>
									<button
										type="button"
										disabled={isDeleting || Boolean(rescanningId)}
										onClick={() => void handleDelete(item.id)}
										className="rounded-xl border border-rose-500/50 bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/30 disabled:opacity-50"
									>
										{isDeleting ? t('deleting') : t('deleteConfirm')}
									</button>
									<button
										type="button"
										disabled={isDeleting || Boolean(rescanningId)}
										onClick={() => setConfirmId(null)}
										className="rounded-xl border border-white/[0.08] bg-white/5 px-4 py-2 text-sm font-semibold text-slate-400 transition hover:bg-white/10 hover:text-slate-200 disabled:opacity-50"
									>
										{t('deleteCancel')}
									</button>
								</>
							) : (
								<button
									type="button"
									disabled={isDeleting || Boolean(rescanningId)}
									onClick={() => setConfirmId(item.id)}
									className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-2 text-sm font-semibold text-rose-300 transition hover:border-rose-500/40 hover:bg-rose-500/15 disabled:opacity-50"
								>
									{t('delete')}
								</button>
							)}
						</div>
					</li>
				);
			})}
		</ul>
	);
}
