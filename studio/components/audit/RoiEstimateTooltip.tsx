'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useOptionalAuditData } from '@/components/audit/AuditDataContext';
import type { BusinessConversionModel } from '@/lib/audit/business-conversion';
import { getFinancialImpact, isOpportunityCost } from '@/lib/audit/financial-impact';
import { formatKrw } from '@/lib/audit/solution-packages';

interface RoiEstimateTooltipProps {
	reasoning: string;
	model?: BusinessConversionModel | null;
	/** Compact trigger next to a headline loss figure. */
	variant?: 'inline' | 'block';
}

export function RoiEstimateTooltip({ reasoning, model, variant = 'inline' }: RoiEstimateTooltipProps) {
	const t = useTranslations('audit.businessConversion');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const tooltipId = useId();
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setOpen(false);
		};
		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [open]);

	return (
		<div ref={rootRef} className={`group relative inline-flex shrink-0 ${variant === 'block' ? 'w-full' : ''}`}>
			<button
				type="button"
				aria-expanded={open}
				aria-controls={tooltipId}
				onClick={() => setOpen((prev) => !prev)}
				className="inline-flex items-center gap-1 text-[11px] text-zinc-500 underline underline-offset-2 transition-all hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 dark:text-zinc-400 dark:hover:text-zinc-200"
			>
				<span>{t('roiBasisTrigger')}</span>
			</button>
			<div
				id={tooltipId}
				role="tooltip"
				className={`pointer-events-none absolute bottom-full right-0 z-20 mb-2 w-72 rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-300 shadow-2xl ${
					open ? 'block' : 'hidden group-hover:block group-focus-within:block'
				}`}
			>
				<p className="mb-1 font-bold text-white">{t('roiBasisTitle')}</p>
				<p>{reasoning}</p>
				{model ? (
					<ul className="mt-2 list-disc space-y-1 border-t border-zinc-800 pt-2 pl-4 text-zinc-400">
						<li>{t('roiBasisCpc', { value: formatKrw(model.cpcKrw, lang) })}</li>
						<li>{t('roiBasisVolume', { value: formatKrw(model.monthlySearchVolume, lang) })}</li>
						<li>
							{t('roiBasisGap', {
								brand: model.brandSharePct,
								competitor: model.competitorSharePct,
								gap: model.citationGapPct,
							})}
						</li>
					</ul>
				) : null}
				<p className="mt-1.5 border-t border-zinc-800 pt-1.5 text-[10px] text-zinc-500">{t('roiBasisDisclaimer')}</p>
			</div>
		</div>
	);
}

interface RoiLossHeadlineProps {
	/** Comprehensive measured score (0–100). Falls back to AuditDataContext. */
	score?: number;
	model?: BusinessConversionModel | null;
}

export function RoiLossHeadline({ score, model = null }: RoiLossHeadlineProps) {
	const t = useTranslations('audit.businessConversion');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const ctxScore = useOptionalAuditData()?.scores.totalScore;
	const resolved = typeof score === 'number' && Number.isFinite(score) ? score : ctxScore;
	if (typeof resolved !== 'number' || !Number.isFinite(resolved)) return null;

	const impact = getFinancialImpact(resolved, lang);

	return (
		<div
			className={`flex flex-col items-start justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${impact.badgeColor}`}
		>
			<div className="flex items-center gap-3">
				<span className="select-none text-2xl" aria-hidden>
					{impact.icon}
				</span>
				<div>
					<div className="flex flex-wrap items-center gap-2">
						<h4 className="text-base font-black tracking-tight text-slate-900 dark:text-white md:text-lg">
							{impact.mainText}
						</h4>
						<span className="rounded border border-zinc-200 bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300">
							{isOpportunityCost(impact.type) ? t('roiImpactBadgeCost') : t('roiImpactBadgeValue')}
						</span>
					</div>
					<p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{impact.subText}</p>
				</div>
			</div>

			<div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
				<RoiEstimateTooltip reasoning={impact.reasoning} model={model} />
			</div>
		</div>
	);
}
