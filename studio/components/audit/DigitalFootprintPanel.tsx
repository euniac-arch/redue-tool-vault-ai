'use client';

import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useResolvedReputation } from '@/components/audit/AuditDataContext';
import { GeoMeasuredCardHeader } from '@/components/audit/GeoMeasuredCardHeader';
import { GEO_PILLAR_ANCHOR_IDS } from '@/lib/audit/geoScoreCalculator';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { AuditReport } from '@/lib/site-auditor';
import type { DfTabId } from './DigitalFootprintReportTabs';

interface DigitalFootprintPanelProps {
	report: AuditReport;
	reportData?: GeoNarrativeReport | null;
	activeTab?: DfTabId;
	onTabChange?: (tabId: DfTabId) => void;
}

export function DigitalFootprintPanel({
	report,
	reportData,
	activeTab = 'df-google',
	onTabChange,
}: DigitalFootprintPanelProps) {
	const t = useTranslations('audit.digitalFootprint');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const digitalFootprint = useResolvedReputation(report, reportData, lang)?.digitalFootprint;
	if (!digitalFootprint) return null;
	const belowBenchmark = digitalFootprint.googleMentionCount < digitalFootprint.googleMentionBenchmark;
	const totalCount = digitalFootprint.googleMentionCount + digitalFootprint.naverMentionCount;
	const unitLabel = lang === 'en' ? '' : '건';

	const boxes: Array<{ id: DfTabId; body: ReactNode }> = [
		{
			id: 'df-google',
			body: (
				<>
					<p className="text-[10px] uppercase tracking-wide text-slate-500">{t('googleLabel')}</p>
					<p
						className={`mt-1 text-2xl font-extrabold tabular-nums ${
							belowBenchmark ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
						}`}
					>
						{digitalFootprint.googleMentionCount}
						{unitLabel && <span className="ml-1 text-xs font-semibold text-slate-500">{unitLabel}</span>}
					</p>
					<p className="text-[11px] text-slate-500">
						{t('googleBenchmarkHint', { benchmark: digitalFootprint.googleMentionBenchmark })}
					</p>
				</>
			),
		},
		{
			id: 'df-naver',
			body: (
				<>
					<p className="text-[10px] uppercase tracking-wide text-slate-500">{t('naverLabel')}</p>
					<p
						className={`mt-1 text-2xl font-extrabold tabular-nums ${
							digitalFootprint.naverMentionIssue ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
						}`}
					>
						{digitalFootprint.naverMentionCount}
						{unitLabel && <span className="ml-1 text-xs font-semibold text-slate-500">{unitLabel}</span>}
					</p>
					{digitalFootprint.naverMentionIssue && (
						<p className="text-[11px] text-rose-700 dark:text-rose-400">{digitalFootprint.naverMentionIssue}</p>
					)}
				</>
			),
		},
		{
			id: 'df-total',
			body: (
				<>
					<p className="text-[10px] uppercase tracking-wide text-slate-500">{t('totalLabel')}</p>
					<p
						className={`mt-1 text-2xl font-extrabold tabular-nums ${
							belowBenchmark ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
						}`}
					>
						{totalCount}
						{unitLabel && <span className="ml-1 text-xs font-semibold text-slate-500">{unitLabel}</span>}
					</p>
					<p className="text-[11px] text-slate-500">{t('totalHint')}</p>
				</>
			),
		},
	];

	return (
		<section
			id={GEO_PILLAR_ANCHOR_IDS.rag_authority}
			data-geo-pillar="rag_authority"
			className="pdf-page-item audit-report-section scroll-mt-24 flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-5 sm:p-6"
		>
			<GeoMeasuredCardHeader
				pillarId="rag_authority"
				title={<h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{t('title')}</h2>}
			/>

			<div className="grid gap-3 sm:grid-cols-3">
				{boxes.map((box) => {
					const isActive = activeTab === box.id;
					return (
						<button
							key={box.id}
							type="button"
							data-target={box.id}
							aria-pressed={isActive}
							onClick={() => onTabChange?.(box.id)}
							className={`df-summary-box rounded-xl border bg-slate-50 dark:bg-black/20 px-4 py-3 text-left ${
								isActive ? 'active-box' : 'border-slate-200 dark:border-white/[0.08]'
							}`}
						>
							{box.body}
						</button>
					);
				})}
			</div>
		</section>
	);
}
