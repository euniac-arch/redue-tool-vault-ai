'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuditPayload } from '@/components/audit/AuditPayloadProvider';
import { ScoreGradeBadge } from '@/components/audit/ScoreGradeBadge';
// import { SiteLogoThumbnail } from '@/components/audit/SiteLogoThumbnail';
import { resolveHistoryGeoHeadline, saveGuestAudit, type AuditHistoryEntry } from '@/lib/audit-history-storage';
import { rememberAudit } from '@/lib/audit/report-client-cache';
import { measuredScoreFromParts } from '@/lib/audit/diagnosis-scores';
// import { resolveReportLogoUrl } from '@/lib/audit/logo-url';
import { resolveAuditScoreFromHistory } from '@/lib/audit/resolveAuditScore';
import { gradeThemeFromScore } from '@/lib/audit/score-grade';
import { formatTargetCategory } from '@/lib/audit/target-entity';

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
	const tDist = useTranslations('audit.scoreDistribution');
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
		<ul className="flex flex-col gap-2.5">
			{items.map((item) => {
				const auditScore = resolveAuditScoreFromHistory(item);
				const technicalPercent = auditScore.normalizedScore;
				const geoHeadline = resolveHistoryGeoHeadline(item);
				const overallScore = measuredScoreFromParts(
					geoHeadline?.score ?? technicalPercent,
					technicalPercent,
					{ url: item.url, hasSsl: item.report?.hasSsl },
				);
				const overallStyles = gradeThemeFromScore(overallScore);
				const isDeleting = deletingId === item.id;
				const awaitingConfirm = confirmId === item.id;

				const domain = siteLabelFromUrl(item.url);
				const siteName = resolveHistorySiteName(item);
				const category = resolveHistoryCategory(item, siteName, locale === 'en' ? 'en' : 'ko');
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
						className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900/80 dark:shadow-none dark:hover:border-zinc-700"
					>
						<div className="flex flex-col gap-3 p-3.5 pl-6 sm:p-4 sm:pl-[26px] md:flex-row md:items-center md:justify-between md:gap-6">
							{/* Left: brand logo + site identity + actions */}
							<div className="flex min-w-0 flex-1 items-start gap-3">
								{/* <SiteLogoThumbnail
									siteUrl={item.url}
									siteName={siteName}
									logoUrl={resolveReportLogoUrl(item.report)}
								/> */}
								<div className="flex min-w-0 flex-1 flex-col gap-2.5">
								<div className="min-w-0">
									<p
										className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5"
										title={category ? `${siteName} · ${category}` : siteName}
									>
										<span className="truncate text-lg font-bold leading-snug text-slate-900 dark:text-white">
											{siteName}
										</span>
										{category ? (
											<span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-px font-sans text-[11px] font-medium text-slate-500 dark:bg-white/[0.06] dark:text-zinc-400">
												{category}
											</span>
										) : null}
									</p>
									<div className="mt-1 flex min-w-0 flex-wrap items-end gap-x-2 gap-y-0.5">
										<a
											href={item.url}
											target="_blank"
											rel="noopener noreferrer"
											className="truncate font-mono text-sm text-zinc-500 transition hover:text-accent dark:text-zinc-400 dark:hover:text-accent-light"
											title={item.url}
										>
											{domain}
										</a>
										<time
											dateTime={item.createdAt}
											className="shrink-0 font-sans text-[10px] font-light text-slate-400 dark:text-zinc-500"
										>
											{auditedAt}
										</time>
									</div>
								</div>

								<div className="mt-auto flex flex-wrap items-center gap-2">
									<button
										type="button"
										onClick={() => viewStoredResult(item)}
										className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-bold text-white shadow-md shadow-accent/20 transition hover:bg-accent-light"
									>
										{t('viewResult')}
									</button>
									<button
										type="button"
										disabled={isDeleting}
										onClick={() => handleRescan(item)}
										className="inline-flex items-center rounded-lg border border-slate-200 bg-transparent px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-70 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-white/[0.04]"
									>
										{t('rescan')}
									</button>
									{awaitingConfirm ? (
										<>
											<button
												type="button"
												disabled={isDeleting}
												onClick={() => void handleDelete(item.id)}
												className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/50 dark:bg-rose-500/20 dark:text-rose-200 dark:hover:bg-rose-500/30"
											>
												{isDeleting ? t('deleting') : t('deleteConfirm')}
											</button>
											<button
												type="button"
												disabled={isDeleting}
												onClick={() => setConfirmId(null)}
												className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200"
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
											className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:text-zinc-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
										>
											<Trash2 className="h-4 w-4" aria-hidden />
										</button>
									)}
								</div>
							</div>
							</div>

							{/* Right: overall score + AI trust / tech SEO lines */}
							<div className="flex flex-col items-end gap-1.5 md:min-w-[22rem]">
								<p
									className={`text-[1.75rem] font-extrabold leading-none tabular-nums md:text-3xl ${overallStyles.text}`}
								>
									{overallScore}
									<span className="text-sm font-semibold text-zinc-500 md:text-base">
										{' '}
										{tDist('mainScoreSuffix')}
									</span>
								</p>
								<ScoreGradeBadge score={overallScore} isHttps={auditScore.isHttps} />
								<div className="flex flex-nowrap items-center justify-end gap-1">
									<span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
										{tDist('chart.aiTrust.full')}
										<span className="tabular-nums">{geoHeadline?.score ?? '—'}</span>
									</span>
									<span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
										{tDist('chart.techSeo.full')}
										<span className="tabular-nums">{technicalPercent}</span>
									</span>
								</div>
							</div>
						</div>
					</li>
				);
			})}
		</ul>
	);
}
