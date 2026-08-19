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
			text: 'text-emerald-400',
			badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
			gradeKey: 'gradeExcellent' as const,
		};
	}
	if (score >= 50) {
		return {
			text: 'text-amber-400',
			badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
			gradeKey: 'gradeCaution' as const,
		};
	}
	return {
		text: 'text-rose-400',
		badge: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
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
}

export function AuditHistoryList({
	items,
	onDelete,
	deletingId = null,
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

	return (
		<ul className="space-y-3">
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
						className="group relative flex flex-col items-start justify-between gap-4 rounded-xl border border-slate-800/80 bg-[#0B1120]/80 p-4 backdrop-blur-sm transition-all duration-200 hover:border-cyan-500/40 hover:bg-[#0E162B] hover:shadow-[0_4px_20px_rgba(6,182,212,0.08)] sm:flex-row sm:items-center sm:p-5"
					>
						<div className="flex min-w-0 flex-1 items-start gap-3.5 sm:items-center">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-lg transition-colors group-hover:border-cyan-500/30">
								🌐
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex flex-wrap items-center gap-2">
									<h4
										className="truncate text-sm font-bold tracking-tight text-white sm:text-base"
										title={siteName}
									>
										{siteName}
									</h4>
									<span className="rounded border border-slate-800 bg-slate-900/90 px-2 py-0.5 text-[11px] font-medium text-slate-400">
										{category}
									</span>
								</div>
								<div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-400">
									<a
										href={item.url}
										target="_blank"
										rel="noopener noreferrer"
										className="truncate font-mono text-slate-400 transition hover:text-cyan-300"
										title={item.url}
									>
										{domain}
									</a>
									<span className="text-slate-600">·</span>
									<time dateTime={item.createdAt} className="shrink-0 text-slate-500">
										{auditedAt}
									</time>
								</div>
							</div>
						</div>

						<div className="flex w-full shrink-0 items-center justify-between gap-3 border-t border-slate-800/60 pt-2 sm:w-auto sm:justify-end sm:border-t-0 sm:pt-0">
							<div className="flex items-center gap-2">
								<div className="text-right">
									<div className="text-[10px] font-medium text-slate-400">{t('scoreReadiness')}</div>
									<div className="text-sm font-bold text-white sm:text-base">
										<span className={tone.text}>{overallScore}</span>
										<span className="text-xs font-normal text-slate-500"> / 100</span>
									</div>
								</div>
								<span className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}>
									{t(tone.gradeKey)}
								</span>
							</div>

							<div className="flex flex-wrap items-center justify-end gap-2">
								<button
									type="button"
									onClick={() => viewStoredResult(item)}
									className="rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 shadow-sm transition-all duration-150 hover:border-cyan-500 hover:bg-cyan-500 hover:text-slate-950"
								>
									{t('viewReport')}
								</button>
								<button
									type="button"
									disabled={isDeleting}
									onClick={() => handleRescan(item)}
									className="rounded-lg border border-slate-800 bg-slate-900/90 px-3.5 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-70"
								>
									{t('rescan')}
								</button>
								{awaitingConfirm ? (
									<>
										<button
											type="button"
											disabled={isDeleting}
											onClick={() => void handleDelete(item.id)}
											className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-2 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-50"
										>
											{isDeleting ? t('deleting') : t('deleteConfirm')}
										</button>
										<button
											type="button"
											disabled={isDeleting}
											onClick={() => setConfirmId(null)}
											className="rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
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
										className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/90 text-slate-400 transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-50"
									>
										<Trash2 className="h-4 w-4" aria-hidden />
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
