'use client';

import { useTranslations } from 'next-intl';
import { useOptionalAuditData } from '@/components/audit/AuditDataContext';
import { RoiLossHeadline } from '@/components/audit/RoiEstimateTooltip';
import type { BusinessConversionModel } from '@/lib/audit/business-conversion';

interface CompetitorLeakageRoiBannerProps {
	model: BusinessConversionModel;
	/** After-prescription view — keep ROI, drop the Level 1 warning. */
	applied?: boolean;
}

export function CompetitorLeakageRoiBanner({ model, applied = false }: CompetitorLeakageRoiBannerProps) {
	const t = useTranslations('audit.businessConversion');
	const measuredScore = useOptionalAuditData()?.scores.totalScore;
	const showBadge = model.showLeakageBadge && !applied;

	return (
		<div
			className="flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 shadow-none p-4 dark:border-slate-800/80 dark:bg-slate-900/90 dark:shadow-2xl dark:backdrop-blur-md md:p-5"
			aria-label={t('roiAria')}
		>
			{showBadge ? (
				<p className="inline-flex w-fit max-w-full items-start gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-extrabold leading-snug text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400 md:text-base">
					<span aria-hidden>🚨</span>
					<span className="min-w-0 break-keep">
						{t('leakageBadge', { keyword: model.targetQuery })}
					</span>
				</p>
			) : null}

			<div
				className={`flex items-start gap-3 rounded-xl border bg-white dark:bg-slate-950/50 px-3.5 py-3 md:px-4 md:py-3.5 ${
					applied ? 'border-emerald-200 dark:border-emerald-500/30' : 'border-amber-200 dark:border-amber-500/30'
				}`}
			>
				<span
					className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base ${
						applied
							? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
							: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
					}`}
					aria-hidden
				>
					{applied ? '✅' : '💰'}
				</span>
				<div className="min-w-0 space-y-2">
					<p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-300">
						{applied ? t('roiAppliedLabel') : t('roiLabel')}
					</p>
					{applied ? (
						<p className="text-sm font-bold leading-relaxed text-slate-900 dark:text-white md:text-base">
							{t('roiAppliedBody', { value: model.monthlyValueManwon })}
						</p>
					) : (
						<>
							<RoiLossHeadline score={measuredScore} model={model} />
							<p className="text-sm font-bold leading-relaxed text-slate-900 dark:text-white md:text-base">
								{t('roiBody', { value: model.monthlyValueManwon })}
							</p>
						</>
					)}
					<p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-500">{t('roiHint')}</p>
				</div>
			</div>
		</div>
	);
}
