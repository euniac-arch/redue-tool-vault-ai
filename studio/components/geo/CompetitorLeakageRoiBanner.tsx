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
			className="flex flex-col gap-2.5 rounded-2xl border border-slate-700/30 bg-gradient-to-br from-[#0F172A] via-[#111827] to-[#0B1C2C] p-4 md:p-5"
			aria-label={t('roiAria')}
		>
			{showBadge ? (
				<p className="inline-flex w-fit max-w-full items-start gap-2 rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-sm font-extrabold leading-snug text-rose-100 md:text-base">
					<span aria-hidden>🚨</span>
					<span className="min-w-0 break-keep">
						{t('leakageBadge', { keyword: model.targetQuery })}
					</span>
				</p>
			) : null}

			<div
				className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 md:px-4 md:py-3.5 ${
					applied
						? 'border-emerald-400/30 bg-emerald-500/[0.12]'
						: 'border-cyan-400/25 bg-cyan-500/[0.10]'
				}`}
			>
				<span
					className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base ${
						applied
							? 'bg-emerald-400/20 text-emerald-200'
							: 'bg-cyan-400/20 text-cyan-200'
					}`}
					aria-hidden
				>
					{applied ? '✅' : '💰'}
				</span>
				<div className="min-w-0 space-y-2">
					<p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
						{applied ? t('roiAppliedLabel') : t('roiLabel')}
					</p>
					{applied ? (
						<p className="text-sm font-bold leading-relaxed text-white md:text-base">
							{t('roiAppliedBody', { value: model.monthlyValueManwon })}
						</p>
					) : (
						<>
							<RoiLossHeadline score={measuredScore} model={model} />
							<p className="text-sm font-bold leading-relaxed text-white md:text-base">
								{t('roiBody', { value: model.monthlyValueManwon })}
							</p>
						</>
					)}
					<p className="text-[11px] leading-relaxed text-slate-400">{t('roiHint')}</p>
				</div>
			</div>
		</div>
	);
}
