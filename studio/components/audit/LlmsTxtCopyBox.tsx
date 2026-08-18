'use client';

import { ArrowUpRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useOptionalAuditData, useResolvedReputation } from '@/components/audit/AuditDataContext';
import { GeoMeasuredCardHeader } from '@/components/audit/GeoMeasuredCardHeader';
import { GeoPillarItemList } from '@/components/audit/GeoPillarItemList';
import { AICrawlerStatusCard } from '@/components/geo/AICrawlerStatusCard';
import { GEO_PILLAR_ANCHOR_IDS } from '@/lib/audit/geoScoreCalculator';
import { openGeoAnswerCenter } from '@/lib/audit/exec-brief';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { buildAiCrawlerStatusesFromAudit } from '@/lib/geo/precision-diagnostics';
import type { AuditReport } from '@/lib/site-auditor';

export function LlmsTxtCopyBox({
	present,
	report,
	reportData,
}: {
	present: boolean;
	report?: AuditReport;
	reportData?: GeoNarrativeReport | null;
}) {
	const t = useTranslations('audit.advancedGeo.llms');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const botItems = useOptionalAuditData()?.snapshot.geoComprehensive.pillars.bot_index.items ?? [];
	const reputation = useResolvedReputation(report, reportData, lang);
	const bots = report
		? reputation?.digitalFootprint.aiBots?.length
			? reputation.digitalFootprint.aiBots
			: buildAiCrawlerStatusesFromAudit(report, lang)
		: [];

	return (
		<section
			id={GEO_PILLAR_ANCHOR_IDS.bot_index}
			data-geo-pillar="bot_index"
			className="pdf-page-item audit-report-section scroll-mt-24 space-y-6 rounded-2xl border border-cyan-200/90 bg-gradient-to-br from-cyan-50 via-white to-indigo-50 p-5 dark:border-cyan-400/25 dark:from-cyan-500/[0.10] dark:via-[#0B1028] dark:to-indigo-500/[0.08] sm:p-6"
		>
			<GeoMeasuredCardHeader
				pillarId="bot_index"
				showItems={false}
				className="border-b border-slate-200 pb-4 dark:border-slate-800"
				title={
					<div className="min-w-0 space-y-1">
						<p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{t('kicker')}</p>
						<h4 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
							<span className="text-xl" aria-hidden>
								🤖
							</span>
							<span>{t('title')}</span>
						</h4>
						<p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
					</div>
				}
			/>

			{botItems.length > 0 && <GeoPillarItemList items={botItems} />}
			{bots.length > 0 && <AICrawlerStatusCard bots={bots} />}

			<div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
				<div
					className={`flex flex-col justify-between gap-3 rounded-xl border p-3 sm:flex-row sm:items-center ${
						present
							? 'border-emerald-500/25 bg-emerald-500/10'
							: 'border-amber-500/25 bg-amber-500/10'
					}`}
				>
					<div
						className={`flex items-center gap-2 text-xs font-bold ${
							present ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'
						}`}
					>
						<span aria-hidden>{present ? '✅' : '⚠️'}</span>
						<span>{present ? t('present') : t('missing')}</span>
					</div>
					<button
						type="button"
						onClick={() => openGeoAnswerCenter('llms')}
						className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-indigo-500"
					>
						<span>{t('goToModule5')}</span>
						<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
					</button>
				</div>
			</div>
		</section>
	);
}
