'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useResolvedReputation } from '@/components/audit/AuditDataContext';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { GeoActionPriority } from '@/lib/audit/geo-score';
import type { AuditReport } from '@/lib/site-auditor';

interface GeoActionPlanPanelProps {
	report: AuditReport;
	reportData?: GeoNarrativeReport | null;
}

const PRIORITY_STYLES: Record<GeoActionPriority, string> = {
	urgent: 'bg-rose-500 text-white ring-1 ring-rose-300/40',
	recommended: 'bg-indigo-500 text-white ring-1 ring-indigo-300/50',
};

export function GeoActionPlanPanel({ report, reportData }: GeoActionPlanPanelProps) {
	const t = useTranslations('audit.geoActionPlan');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const actionPlan = useResolvedReputation(report, reportData, lang)?.actionPlan ?? [];

	return (
		<section
			id="action-plan-85"
			className="pdf-page-item audit-report-section scroll-mt-24 flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-5 sm:p-6"
		>
			<div>
				<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('subtitle')}</p>
				<h2 className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">{t('title')}</h2>
			</div>

			<ol className="flex flex-col gap-3">
				{actionPlan.map((item) => (
					<li
						key={item.id}
						className={`flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-white/[0.08] p-4 sm:flex-row sm:items-start sm:gap-4 ${
							item.priority === 'urgent' ? 'bg-rose-50 dark:bg-rose-500/[0.06]' : 'bg-indigo-50 dark:bg-indigo-500/[0.05]'
						}`}
					>
						<div className="flex shrink-0 items-center gap-1.5">
							<span className={`rounded-md px-2 py-1 text-[10px] font-extrabold ${PRIORITY_STYLES[item.priority]}`}>
								{item.priority === 'urgent' ? t('urgentBadge') : t('recommendedBadge')}
							</span>
							<span className="rounded-md bg-[#D4AF37]/15 px-2 py-1 text-[10px] font-extrabold text-[#D4AF37]">
								{t('pointGain', { points: item.pointGain })}
							</span>
						</div>
						<div>
							<p className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.title}</p>
							<p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
								<span className="text-slate-500">└ </span>
								{item.description}
							</p>
						</div>
					</li>
				))}
			</ol>
		</section>
	);
}
