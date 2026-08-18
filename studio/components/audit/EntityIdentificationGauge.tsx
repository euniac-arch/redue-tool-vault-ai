'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { MetricImpactCard } from '@/components/audit/MetricImpactCard';
import {
	ENTITY_DISAMBIGUATION_WEIGHTS,
	type EntityDisambiguationResult,
} from '@/lib/audit/advancedGeoMetrics';
import type { IndustryConfig } from '@/lib/registry/universalIndustryRegistry';

function gaugeTone(score: number): string {
	if (score >= 80) return 'text-emerald-600 dark:text-emerald-300';
	if (score >= 40) return 'text-amber-600 dark:text-amber-300';
	return 'text-rose-600 dark:text-rose-300';
}

function barTone(pct: number): string {
	if (pct >= 80) return 'bg-emerald-500';
	if (pct >= 40) return 'bg-amber-500';
	return 'bg-rose-500';
}

export function EntityIdentificationGauge({
	entity,
	categoryName,
	industryConfig,
	children,
}: {
	entity: EntityDisambiguationResult;
	categoryName?: string;
	industryConfig?: Pick<IndustryConfig, 'defaultCategory'> | null;
	children?: ReactNode;
}) {
	const t = useTranslations('audit.advancedGeo.entity');
	const clamped = Math.min(100, Math.max(0, entity.score));
	const radius = 46;
	const circ = 2 * Math.PI * radius;
	const offset = circ * (1 - clamped / 100);
	const rows = [
		{
			id: 'taxId',
			label: t('taxId'),
			hint: entity.breakdown.taxId.valid
				? entity.breakdown.taxId.value
				: entity.breakdown.taxId.present
					? t('taxIdInvalid')
					: t('missing'),
			score: entity.breakdown.taxId.score,
			max: ENTITY_DISAMBIGUATION_WEIGHTS.taxId,
		},
		{
			id: 'placeCid',
			label: t('placeCid'),
			hint: entity.breakdown.placeCid.present ? entity.breakdown.placeCid.value : t('missing'),
			score: entity.breakdown.placeCid.score,
			max: ENTITY_DISAMBIGUATION_WEIGHTS.placeCid,
		},
		{
			id: 'sameAs',
			label: t('sameAs'),
			hint: t('sameAsCount', { count: entity.breakdown.sameAs.count }),
			score: entity.breakdown.sameAs.score,
			max: ENTITY_DISAMBIGUATION_WEIGHTS.sameAs,
		},
		{
			id: 'kg',
			label: t('representativeKg'),
			hint: entity.breakdown.representativeKg.linked ? t('linked') : t('unlinked'),
			score: entity.breakdown.representativeKg.score,
			max: ENTITY_DISAMBIGUATION_WEIGHTS.representativeKg,
		},
	] as const;

	return (
		<section
			id="entity-knowledge-graph"
			className="flex flex-col gap-4 rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/80 via-white to-cyan-50/60 p-4 dark:border-indigo-400/20 dark:from-indigo-500/[0.08] dark:via-transparent dark:to-cyan-500/[0.06] sm:p-5"
		>
			<div className="flex flex-wrap items-center gap-4">
				<svg viewBox="0 0 116 116" className="h-28 w-28 shrink-0" aria-hidden>
					<circle cx="58" cy="58" r={radius} className="fill-none stroke-slate-200 dark:stroke-white/10" strokeWidth="10" />
					<circle
						cx="58"
						cy="58"
						r={radius}
						className="fill-none stroke-indigo-500"
						strokeWidth="10"
						strokeLinecap="round"
						strokeDasharray={circ}
						strokeDashoffset={offset}
						transform="rotate(-90 58 58)"
					/>
					<text
						x="58"
						y="54"
						textAnchor="middle"
						className={`fill-current text-[22px] font-extrabold ${gaugeTone(clamped)}`}
					>
						{clamped}
					</text>
					<text x="58" y="72" textAnchor="middle" className="fill-slate-400 text-[10px] font-bold">
						%
					</text>
				</svg>
				<div className="min-w-0 flex-1">
					<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D4AF37]">{t('kicker')}</p>
					<h3 className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">{t('title')}</h3>
					<p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t('subtitle')}</p>
				</div>
			</div>

			<ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
				{rows.map((row) => {
					const pct = row.max > 0 ? Math.round((row.score / row.max) * 100) : 0;
					return (
						<li key={row.id} className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 dark:border-white/[0.08] dark:bg-black/25">
							<div className="flex items-center justify-between gap-2">
								<p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{row.label}</p>
								<p className="text-[11px] font-bold tabular-nums text-slate-500">
									{row.score}/{row.max}
								</p>
							</div>
							<div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.08]">
								<div className={`h-full rounded-full ${barTone(pct)}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
							</div>
							<p className="mt-1.5 break-all font-mono text-[11px] text-slate-500">{row.hint}</p>
						</li>
					);
				})}
			</ul>

			<MetricImpactCard
				type="entity"
				currentScore={clamped}
				categoryName={categoryName}
				industryConfig={industryConfig}
			/>
			{children}
		</section>
	);
}
