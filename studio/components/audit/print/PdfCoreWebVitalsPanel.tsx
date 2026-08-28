'use client';

import { useTranslations } from 'next-intl';
import { PdfStageHeading, PdfStatusBadge, type PdfCellStatus } from '@/components/audit/print/pdf-print-shared';
import type { PageSpeedSnapshot, PsiCoreVital, PsiScoreTier } from '@/lib/audit/pagespeed';

interface PdfCoreWebVitalsPanelProps {
	pageSpeedDesktop?: PageSpeedSnapshot | null;
	pageSpeedMobile?: PageSpeedSnapshot | null;
}

const VITAL_ORDER: PsiCoreVital['id'][] = ['lcp', 'fcp', 'tbt', 'cls'];

function tierToStatus(tier: PsiScoreTier): PdfCellStatus {
	if (tier === 'good') return 'pass';
	if (tier === 'needs-improvement') return 'warning';
	return 'fail';
}

function scoreStatus(score: number | null): PdfCellStatus {
	if (score == null) return 'neutral';
	if (score >= 80) return 'pass';
	if (score >= 50) return 'warning';
	return 'fail';
}

/**
 * Stage 4 — Track 3 (Core Web Vitals / Lighthouse) parity block: measured
 * PC/모바일 performance scores, the 4 core vitals per strategy, and the
 * Lighthouse `viewport` audit as the mobile-responsive signal. Absent from
 * the curated print flow entirely before this — sourced only from the same
 * live PSI snapshots the Track 3 dashboard tab renders, never estimated.
 */
export function PdfCoreWebVitalsPanel({ pageSpeedDesktop, pageSpeedMobile }: PdfCoreWebVitalsPanelProps) {
	const t = useTranslations('audit.pdfReport.cwv');

	const strategies: { id: 'mobile' | 'desktop'; label: string; snapshot: PageSpeedSnapshot | null | undefined }[] = [
		{ id: 'mobile', label: t('mobileLabel'), snapshot: pageSpeedMobile },
		{ id: 'desktop', label: t('desktopLabel'), snapshot: pageSpeedDesktop },
	];

	const hasAny = Boolean(pageSpeedDesktop || pageSpeedMobile);

	return (
		<section
			id="sec-pdf-cwv"
			className="pdf-print-only pdf-page-item audit-report-section rounded-2xl border border-slate-200 bg-white"
		>
			<PdfStageHeading step={4} eyebrow={t('eyebrow')} title={t('title')} hint={t('hint')} />
			{!hasAny ? (
				<p className="px-5 py-4 text-xs leading-relaxed text-slate-500 sm:px-6">{t('notMeasured')}</p>
			) : (
				<div className="flex flex-col gap-4 p-5 sm:p-6">
					{strategies.map((strategy) => {
						const snapshot = strategy.snapshot;
						if (!snapshot) {
							return (
								<article
									key={strategy.id}
									className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5"
								>
									<p className="text-sm font-bold text-slate-900">{strategy.label}</p>
									<p className="mt-1 text-[11px] text-slate-500">{t('notMeasured')}</p>
								</article>
							);
						}
						const perf = snapshot.categories?.find((c) => c.id === 'performance') ?? null;
						const vitals = VITAL_ORDER.map((id) => (snapshot.vitals ?? []).find((v) => v.id === id)).filter(
							(v): v is PsiCoreVital => Boolean(v),
						);
						return (
							<article key={strategy.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<p className="text-sm font-bold text-slate-900">{strategy.label}</p>
									{perf ? (
										<PdfStatusBadge status={scoreStatus(perf.score)}>
											{t('performanceScoreLabel', { score: perf.score ?? 0 })}
										</PdfStatusBadge>
									) : null}
								</div>
								<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
									{vitals.map((vital) => (
										<div key={vital.id} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
											<p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
												{t(`vitalLabels.${vital.id}`)}
											</p>
											<p className="mt-1 font-mono text-sm font-extrabold text-slate-900">
												{vital.displayValue ?? '—'}
											</p>
											<div className="mt-1">
												<PdfStatusBadge status={tierToStatus(vital.tier)}>
													{t(`tier.${vital.tier}`)}
												</PdfStatusBadge>
											</div>
										</div>
									))}
								</div>
								{snapshot.viewport ? (
									<p className="mt-2.5 text-[10.5px] leading-relaxed text-slate-500">
										{t('viewportLabel')}:{' '}
										<span className={snapshot.viewport.ok ? 'font-bold text-emerald-700' : 'font-bold text-rose-700'}>
											{snapshot.viewport.ok ? t('viewportOk') : t('viewportNeedsWork')}
										</span>
									</p>
								) : null}
							</article>
						);
					})}
				</div>
			)}
		</section>
	);
}
