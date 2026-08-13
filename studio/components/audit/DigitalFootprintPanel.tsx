'use client';

import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { resolveExternalReputation } from '@/lib/audit/geo-score';
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
	const { digitalFootprint } = resolveExternalReputation(report, reportData, lang);
	const belowBenchmark = digitalFootprint.googleMentionCount < digitalFootprint.googleMentionBenchmark;
	const unitLabel = lang === 'en' ? '' : '건';

	const boxes: Array<{ id: DfTabId; body: ReactNode }> = [
		{
			id: 'df-google',
			body: (
				<>
					<p className="text-[10px] uppercase tracking-wide text-slate-500">{t('googleLabel')}</p>
					<p
						className={`mt-1 text-2xl font-extrabold tabular-nums ${
							belowBenchmark ? 'text-amber-400' : 'text-emerald-400'
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
							digitalFootprint.naverMentionIssue ? 'text-rose-400' : 'text-emerald-400'
						}`}
					>
						{digitalFootprint.naverMentionCount}
						{unitLabel && <span className="ml-1 text-xs font-semibold text-slate-500">{unitLabel}</span>}
					</p>
					{digitalFootprint.naverMentionIssue && (
						<p className="text-[11px] text-rose-400">{digitalFootprint.naverMentionIssue}</p>
					)}
				</>
			),
		},
		{
			id: 'df-bing',
			body: (
				<>
					<p className="text-[10px] uppercase tracking-wide text-slate-500">{t('bingLabel')}</p>
					<p
						className={`mt-1 text-lg font-extrabold ${
							digitalFootprint.bingPlacesRegistered ? 'text-emerald-400' : 'text-rose-400'
						}`}
					>
						{digitalFootprint.bingPlacesRegistered ? t('bingRegistered') : t('bingNotRegistered')}
					</p>
					{digitalFootprint.bingPlacesNote && (
						<p className="text-[11px] text-rose-400">{digitalFootprint.bingPlacesNote}</p>
					)}
				</>
			),
		},
	];

	return (
		<section className="audit-report-section flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
			<h2 className="text-lg font-extrabold text-white">{t('title')}</h2>

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
							className={`df-summary-box rounded-xl border bg-black/20 px-4 py-3 text-left ${
								isActive ? 'active-box' : 'border-white/[0.08]'
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
