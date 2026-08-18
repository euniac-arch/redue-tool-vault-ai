'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useOptionalAuditData, useResolvedReputation } from '@/components/audit/AuditDataContext';
import { GeoMeasuredCardHeader } from '@/components/audit/GeoMeasuredCardHeader';
import { GeoSubMetricGrid, type SubMetricItem } from '@/components/audit/GeoSubMetricGrid';
import { GEO_PILLAR_ANCHOR_IDS } from '@/lib/audit/geoScoreCalculator';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { AuditReport } from '@/lib/site-auditor';

function napTone(rate: number): string {
	if (rate >= 90) return 'bg-emerald-500';
	if (rate >= 70) return 'bg-amber-500';
	return 'bg-rose-500';
}

export function GeoLocalNapCard({
	report,
	reportData,
}: {
	report: AuditReport;
	reportData?: GeoNarrativeReport | null;
}) {
	const t = useTranslations('audit.geoNap');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const reputation = useResolvedReputation(report, reportData, lang);
	const brandTrust = reputation?.brandTrust;
	const digitalFootprint = reputation?.digitalFootprint;
	const localItems = useOptionalAuditData()?.snapshot.geoComprehensive.pillars.local_nap.items ?? [];
	if (!brandTrust || !digitalFootprint) return null;
	const naverItem = localItems.find((item) => item.id === 'naver_place_nap');
	const googleItem = localItems.find((item) => item.id === 'google_map_profile');
	const bingItem = localItems.find((item) => item.id === 'bing_places_signal');
	const naverPassed = naverItem?.passed ?? !digitalFootprint.naverMentionIssue;
	const googlePassed = googleItem?.passed ?? false;
	const bingRegistered = digitalFootprint.bingPlacesRegistered;
	const napRate = brandTrust.napMatchRate;
	const napHealthy = napRate >= 90;
	const metricItems: SubMetricItem[] = [
		{
			id: naverItem?.id ?? 'naver_place_nap',
			name: naverItem?.name ?? t('naverScoreLabel'),
			score: naverItem?.score ?? 0,
			maxScore: naverItem?.maxScore ?? 10,
			evidence: naverPassed ? t('naverLinkedHint', { rate: napRate }) : t('naverMissing'),
			statusText: naverPassed ? '정상' : '주의',
			theme: naverPassed ? 'emerald' : 'amber',
		},
		{
			id: googleItem?.id ?? 'google_map_profile',
			name: googleItem?.name ?? t('googleScoreLabel'),
			score: googleItem?.score ?? (googlePassed ? 8 : 4),
			maxScore: googleItem?.maxScore ?? 8,
			evidence: googlePassed ? t('googleLinked') : t('googleMissing'),
			statusText: googlePassed ? '정상' : '주의',
			theme: googlePassed ? 'emerald' : 'amber',
		},
		{
			id: bingItem?.id ?? 'bing_places_signal',
			name: bingItem?.name ?? t('bingScoreLabel'),
			score: bingItem?.score ?? (bingRegistered ? 7 : 0),
			maxScore: bingItem?.maxScore ?? 7,
			evidence: bingRegistered ? t('bingRegisteredHint') : t('bingMissingHint'),
			statusText: bingRegistered ? '정상' : '미등록',
			theme: bingRegistered ? 'emerald' : 'rose',
		},
	];

	return (
		<section
			id={GEO_PILLAR_ANCHOR_IDS.local_nap}
			data-geo-pillar="local_nap"
			className="pdf-page-item audit-report-section scroll-mt-24 flex flex-col gap-5 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-5 sm:p-6"
		>
			<GeoMeasuredCardHeader
				pillarId="local_nap"
				showItems={false}
				title={
					<div className="flex items-center gap-2">
						<span className="text-xl" aria-hidden>
							📍
						</span>
						<h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{t('title')}</h2>
					</div>
				}
				subtitle={<p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t('subtitle')}</p>}
			/>

			<GeoSubMetricGrid items={metricItems} />

			<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/[0.08] dark:bg-slate-950/80">
				<div className="flex items-center justify-between gap-3 text-xs">
					<span className="text-slate-500 dark:text-slate-400">{t('napOnpageLabel')}</span>
					<span
						className={`shrink-0 text-sm font-extrabold tabular-nums ${
							napHealthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
						}`}
					>
						{t(napHealthy ? 'napMatchOk' : 'napMatchWarn', { rate: napRate })}
					</span>
				</div>
				<div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.08]">
					<div
						className={`h-full rounded-full ${napTone(napRate)}`}
						style={{ width: `${Math.min(100, Math.max(0, napRate))}%` }}
					/>
				</div>
				{brandTrust.napIssue && !napHealthy && (
					<p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{brandTrust.napIssue}</p>
				)}
			</div>

			<div>
				<p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('platformGridLabel')}</p>
				<div className="grid gap-3 sm:grid-cols-3">
					<div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/[0.08] dark:bg-black/25">
						<p className="text-[10px] uppercase tracking-wide text-slate-500">{t('naverLabel')}</p>
						<p
							className={`mt-1 text-sm font-extrabold ${
								naverPassed ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
							}`}
						>
							{naverPassed ? t('naverGridOk') : t('naverMissing')}
						</p>
					</div>
					<div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/[0.08] dark:bg-black/25">
						<p className="text-[10px] uppercase tracking-wide text-slate-500">{t('googleLabel')}</p>
						<p
							className={`mt-1 text-sm font-extrabold ${
								googlePassed ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
							}`}
						>
							{googlePassed ? t('googleLinked') : t('googleGridWeak')}
						</p>
					</div>
					<div
						className={`rounded-xl border px-3 py-2.5 ${
							bingRegistered
								? 'border-slate-200 bg-slate-50 dark:border-white/[0.08] dark:bg-black/25'
								: 'border-rose-300/70 bg-rose-50/80 dark:border-rose-900/40 dark:bg-rose-950/20'
						}`}
					>
						<p className="text-[10px] uppercase tracking-wide text-slate-500">{t('bingLabel')}</p>
						<p
							className={`mt-1 text-sm font-extrabold ${
								bingRegistered ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
							}`}
						>
							{bingRegistered ? t('bingRegistered') : t('bingGridMissing')}
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
