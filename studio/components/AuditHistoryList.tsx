'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuditPayload } from '@/components/audit/AuditPayloadProvider';
import { resolveHistoryGeoHeadline, saveGuestAudit, type AuditHistoryEntry } from '@/lib/audit-history-storage';
import { rememberAudit } from '@/lib/audit/report-client-cache';
import { measuredScoreFromParts } from '@/lib/audit/diagnosis-scores';
import { resolveAuditScoreFromHistory } from '@/lib/audit/resolveAuditScore';
import { formatTargetCategory } from '@/lib/audit/target-entity';

function historyScoreTone(score: number) {
	if (score >= 70) {
		return {
			text: 'text-emerald-600 dark:text-emerald-400',
			badge: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400',
			gradeKey: 'gradeExcellent' as const,
		};
	}
	if (score >= 50) {
		return {
			text: 'text-amber-600 dark:text-amber-400',
			badge: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400',
			gradeKey: 'gradeCaution' as const,
		};
	}
	return {
		text: 'text-rose-600 dark:text-rose-400',
		badge: 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400',
		gradeKey: 'gradeRisk' as const,
	};
}

function siteLabelFromUrl(raw: string): string {
	try {
		return new URL(raw).hostname.replace(/^www\./, '') || raw;
	} catch {
		return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || raw;
	}
}

function resolveHistorySiteName(item: AuditHistoryEntry): string {
	const brand = item.report?.siteMeta?.brandName?.trim();
	if (brand) return brand;
	const title =
		item.report?.metrics?.pageTitle?.trim() || item.report?.metrics?.documentTitle?.trim();
	if (title) {
		const first = title.split(/\s+[|\-–—]\s+/)[0]?.trim();
		return first || title;
	}
	return siteLabelFromUrl(item.url);
}

function resolveHistoryCategory(
	item: AuditHistoryEntry,
	siteName: string,
	lang: 'ko' | 'en',
): string | null {
	const meta = item.report?.siteMeta;
	if (!meta) return null;
	const label = formatTargetCategory(meta, lang).trim();
	const generic = lang === 'en' ? 'General' : '일반';
	if (!label || label === generic) return null;
	const compact = (value: string) => value.replace(/\s+/g, '').toLowerCase();
	if (compact(label) === compact(siteName)) return null;
	return label;
}

interface AuditHistoryListProps {
	items: AuditHistoryEntry[];
	onDelete: (id: string) => Promise<void> | void;
	deletingId?: string | null;
	variant?: 'list' | 'grid';
}

export function AuditHistoryList({
	items,
	onDelete,
	deletingId = null,
	variant = 'list',
}: AuditHistoryListProps) {
	const t = useTranslations('audit.history');
	const locale = useLocale();
	const router = useRouter();
	const { persistAudit } = useAuditPayload();
	const dateLocale = locale === 'en' ? 'en-US' : 'ko-KR';
	const [confirmId, setConfirmId] = useState<string | null>(null);

	/** History [결과보기]: bind stored report and open RESULT immediately — no scan animation. */
	function viewStoredResult(item: AuditHistoryEntry) {
		try {
			if (item.report) {
				rememberAudit(item.id, item.report);
				saveGuestAudit(item.id, item.report);
				persistAudit(item.report, { auditId: item.id, cmsType: item.report.cmsType });
			}
			router.push(`/audit/result?id=${encodeURIComponent(item.id)}`);
		} catch (err) {
			console.error('[history] view result failed:', err);
			router.push(`/audit/result?id=${encodeURIComponent(item.id)}`);
		}
	}

	async function handleDelete(id: string) {
		try {
			await onDelete(id);
		} finally {
			setConfirmId(null);
		}
	}

	function handleRescan(item: AuditHistoryEntry) {
		try {
			const target = (item.url || item.report?.url || '').trim();
			if (!target) {
				router.push(`/audit/result?id=${encodeURIComponent(item.id)}&forceRefresh=true&t=${Date.now()}`);
				return;
			}
			const params = new URLSearchParams();
			params.set('url', target);
			params.set('replaceId', item.id);
			params.set('forceRefresh', 'true');
			params.set('t', String(Date.now()));
			router.push(`/audit/result?${params.toString()}`);
		} catch (err) {
			console.error('[history] rescan failed:', err);
		}
	}

	const isGrid = variant === 'grid';

	return (
		<ul className={isGrid ? 'grid grid-cols-2 gap-3 lg:grid-cols-4' : 'space-y-3'}>
			{items.map((item) => {
				const auditScore = resolveAuditScoreFromHistory(item);
				const technicalPercent = auditScore.normalizedScore;
				const geoHeadline = resolveHistoryGeoHeadline(item);
				const overallScore = measuredScoreFromParts(
					geoHeadline?.score ?? technicalPercent,
					technicalPercent,
					{ url: item.url, hasSsl: item.report?.hasSsl },
				);
				const tone = historyScoreTone(overallScore);
				const isDeleting = deletingId === item.id;
				const awaitingConfirm = confirmId === item.id;

				const domain = siteLabelFromUrl(item.url);
				const siteName = resolveHistorySiteName(item);
				const category =
					resolveHistoryCategory(item, siteName, locale === 'en' ? 'en' : 'ko') || t('categoryFallback');
				const auditedAt = new Date(item.createdAt).toLocaleString(dateLocale, {
					year: 'numeric',
					month: '2-digit',
					day: '2-digit',
					hour: '2-digit',
					minute: '2-digit',
				});

				return (
					<li
						key={item.id}
						className={
							isGrid
								? 'group relative flex h-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-cyan-500/40 hover:bg-slate-50 hover:shadow-[0_4px_20px_rgba(6,182,212,0.08)] dark:border-slate-800/80 dark:bg-[#0B1120]/80 dark:shadow-none dark:hover:bg-[#0E162B]'
								: 'group relative flex flex-col items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-cyan-500/40 hover:bg-slate-50 hover:shadow-[0_4px_20px_rgba(6,182,212,0.08)] dark:border-slate-800/80 dark:bg-[#0B1120]/80 dark:shadow-none dark:hover:bg-[#0E162B] sm:flex-row sm:items-center sm:p-5'
						}
					>
						<div className={`flex min-w-0 flex-1 ${isGrid ? 'items-start gap-2.5' : 'items-start gap-3.5 sm:items-center'}`}>
							<div className={`flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-lg transition-colors group-hover:border-cyan-500/30 dark:border-slate-800 dark:bg-slate-900 ${isGrid ? 'h-9 w-9' : 'h-10 w-10'}`}>
								🌐
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex min-w-0 flex-wrap items-center gap-1.5">
									<h4
										className={`truncate font-bold tracking-tight text-slate-900 dark:text-white ${isGrid ? 'text-sm' : 'text-sm sm:text-base'}`}
										title={siteName}
									>
										{siteName}
									</h4>
									<span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-400">
										{category}
									</span>
								</div>
								<div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
									<a
										href={item.url}
										target="_blank"
										rel="noopener noreferrer"
										className="truncate font-mono text-slate-500 transition hover:text-cyan-700 dark:text-slate-400 dark:hover:text-cyan-300"
										title={item.url}
									>
										{domain}
									</a>
									<span className="text-slate-300 dark:text-slate-600">·</span>
									<time dateTime={item.createdAt} className="shrink-0 text-slate-500">
										{isGrid
											? new Date(item.createdAt).toLocaleDateString(dateLocale, {
													year: 'numeric',
													month: '2-digit',
													day: '2-digit',
												})
											: auditedAt}
									</time>
								</div>
							</div>
						</div>

						<div
							className={
								isGrid
									? 'mt-auto flex flex-col gap-2.5'
									: 'flex w-full shrink-0 items-center justify-between gap-3 border-t border-slate-200 pt-2 dark:border-slate-800/60 sm:w-auto sm:justify-end sm:border-t-0 sm:pt-0'
							}
						>
							<div className={`flex items-center gap-2 ${isGrid ? 'justify-between' : ''}`}>
								<div className={isGrid ? '' : 'text-right'}>
									<div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{t('scoreReadiness')}</div>
									<div className={`font-bold text-slate-900 dark:text-white ${isGrid ? 'text-sm' : 'text-sm sm:text-base'}`}>
										<span className={tone.text}>{overallScore}</span>
										<span className="text-xs font-normal text-slate-400 dark:text-slate-500"> / 100</span>
									</div>
								</div>
								<span className={`rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${tone.badge}`}>
									{t(tone.gradeKey)}
								</span>
							</div>

							<div className={`flex flex-wrap items-center gap-1.5 ${isGrid ? '' : 'justify-end'}`}>
								<button
									type="button"
									onClick={() => viewStoredResult(item)}
									className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm transition-all duration-150 hover:border-cyan-500 hover:bg-cyan-500 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
								>
									{t('viewReport')}
								</button>
								<button
									type="button"
									disabled={isDeleting}
									onClick={() => handleRescan(item)}
									className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-70 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
								>
									{t('rescan')}
								</button>
								{awaitingConfirm ? (
									<>
										<button
											type="button"
											disabled={isDeleting}
											onClick={() => void handleDelete(item.id)}
											className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
										>
											{isDeleting ? t('deleting') : t('deleteConfirm')}
										</button>
										<button
											type="button"
											disabled={isDeleting}
											onClick={() => setConfirmId(null)}
											className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
										>
											{t('deleteCancel')}
										</button>
									</>
								) : (
									<button
										type="button"
										disabled={isDeleting}
										onClick={() => setConfirmId(item.id)}
										aria-label={t('delete')}
										title={t('delete')}
										className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
									>
										<Trash2 className="h-3.5 w-3.5" aria-hidden />
									</button>
								)}
							</div>
						</div>
					</li>
				);
			})}
		</ul>
	);
}
