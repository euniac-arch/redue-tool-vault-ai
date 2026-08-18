'use client';

import { useLocale, useTranslations } from 'next-intl';
import { RoiEstimateTooltip } from '@/components/audit/RoiEstimateTooltip';
import type { BusinessConversionModel } from '@/lib/audit/business-conversion';
import { getFinancialImpact, isOpportunityCost } from '@/lib/audit/financial-impact';
import { scrollToSolutionPackages } from '@/lib/audit/solution-packages';

interface QuickConversionCtaBarProps {
	score: number;
	model?: BusinessConversionModel | null;
	urgent?: boolean;
}

const CARD_TONE = {
	LOSS: 'bg-rose-50/70 border-rose-200/80 dark:bg-rose-500/[0.08] dark:border-rose-500/25',
	RECOVERABLE_LOSS: 'bg-amber-50/70 border-amber-200/80 dark:bg-amber-500/[0.08] dark:border-amber-500/25',
	UPSIDE: 'bg-emerald-50/70 border-emerald-200/80 dark:bg-emerald-500/[0.08] dark:border-emerald-500/25',
	PROTECTED: 'bg-indigo-50/70 border-indigo-200/80 dark:bg-indigo-500/[0.08] dark:border-indigo-500/25',
} as const;

const KICKER_TONE = {
	LOSS: 'text-rose-600 dark:text-rose-400',
	RECOVERABLE_LOSS: 'text-amber-700 dark:text-amber-400',
	UPSIDE: 'text-emerald-700 dark:text-emerald-400',
	PROTECTED: 'text-indigo-700 dark:text-indigo-400',
} as const;

const WARN_TONE = {
	urgent: 'border-rose-100 dark:border-rose-500/20',
	priority: 'border-amber-100 dark:border-amber-500/20',
} as const;

export function QuickConversionCtaBar({ score, model = null, urgent = true }: QuickConversionCtaBarProps) {
	const t = useTranslations('audit.b2b');
	const tRoi = useTranslations('audit.businessConversion');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const impact = getFinancialImpact(score, lang);
	const loss = isOpportunityCost(impact.type);

	return (
		<div className={`print:hidden space-y-4 rounded-2xl border p-5 ${CARD_TONE[impact.type]}`}>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<span className={`text-xs font-bold uppercase tracking-wide ${KICKER_TONE[impact.type]}`}>
						{loss ? t('quickCtaLossKicker') : t('quickCtaValueKicker')}
					</span>
					<h4 className="mt-0.5 text-xl font-extrabold text-slate-900 dark:text-white">
						<span className="mr-1.5 select-none" aria-hidden>
							{impact.icon}
						</span>
						{impact.mainText}
					</h4>
					<p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{impact.subText}</p>
				</div>
				<div className="flex shrink-0 items-center gap-2 self-start">
					<span className="rounded border border-zinc-200 bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300">
						{loss ? tRoi('roiImpactBadgeCost') : tRoi('roiImpactBadgeValue')}
					</span>
					<RoiEstimateTooltip reasoning={impact.reasoning} model={model} />
				</div>
			</div>

			<div
				className={`space-y-1 rounded-xl border bg-white/80 p-3 text-xs text-slate-700 dark:bg-white/[0.04] dark:text-slate-300 ${
					urgent ? WARN_TONE.urgent : WARN_TONE.priority
				}`}
			>
				<div className="flex flex-wrap items-center gap-1">
					<span
						className={`font-bold ${
							urgent ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'
						}`}
					>
						🚨 {urgent ? t('quickCtaUrgent') : t('quickCtaPriority')}
					</span>
					{model ? (
						<span className="font-medium text-slate-800 dark:text-slate-200">
							· {t('quickCtaTitle', { count: model.monthlySearchVolume })}
						</span>
					) : null}
				</div>
				<p className="text-slate-500 dark:text-slate-400">{t('quickCtaHint')}</p>
			</div>

			<button
				type="button"
				onClick={scrollToSolutionPackages}
				className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
			>
				<span>{t('quickCtaButton')}</span>
			</button>
		</div>
	);
}
