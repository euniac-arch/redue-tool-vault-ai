'use client';

import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
	isMetricImpactPassed,
	metricImpactBand,
	metricImpactThreshold,
	resolveBenefitCategoryName,
	type MetricBenefitType,
	type MetricImpactBand,
} from '@/lib/audit/metric-benefit';
import type { IndustryConfig } from '@/lib/registry/universalIndustryRegistry';

export interface MetricImpactCardProps {
	type: MetricBenefitType;
	currentScore: number;
	/** `industryConfig.defaultCategory` (fallback: 전문 기업/기관). */
	categoryName?: string;
	industryConfig?: Pick<IndustryConfig, 'defaultCategory'> | null;
}

const BAND_BADGE: Record<MetricImpactBand, string> = {
	good: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
	warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
	danger: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};

export function MetricImpactCard({
	type,
	currentScore,
	categoryName,
	industryConfig,
}: MetricImpactCardProps) {
	const t = useTranslations('audit.advancedGeo.benefit');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const resolvedCategory = resolveBenefitCategoryName(industryConfig, lang, categoryName);
	const threshold = metricImpactThreshold(type);
	const passed = isMetricImpactPassed(type, currentScore);
	const band = metricImpactBand(type, currentScore);
	const score = Math.min(100, Math.max(0, Math.round(Number.isFinite(currentScore) ? currentScore : 0)));
	const scope = type === 'entity' ? 'entity' : 'rag';

	return (
		<div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-900/50">
			<div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5 dark:border-slate-800">
				<div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
					<ShieldCheck className="h-4 w-4 text-indigo-500" aria-hidden />
					<span>{t('criteriaTitle', { title: t(`${scope}.title`) })}</span>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<span className="rounded-md border border-indigo-200/60 bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-400">
						{t('target', { targetLabel: t(`${scope}.targetLabel`, { threshold }) })}
					</span>
					<span className={`rounded-md px-2 py-0.5 font-bold ${BAND_BADGE[band]}`}>
						{passed
							? t('currentPass', { score })
							: t('currentFail', { score })}
					</span>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
				<div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
					<div className="mb-1 flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
						<CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
						<span>{t('withLabel')}</span>
					</div>
					<p className="break-keep leading-relaxed text-slate-600 dark:text-slate-400">
						{t(`${scope}.with`, { categoryName: resolvedCategory })}
					</p>
				</div>

				<div className="rounded-lg border border-rose-100 bg-rose-50/60 p-2.5 dark:border-rose-900/40 dark:bg-rose-950/20">
					<div className="mb-1 flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400">
						<AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
						<span>{t('withoutLabel')}</span>
					</div>
					<p className="break-keep leading-relaxed text-slate-600 dark:text-slate-400">
						{t(`${scope}.without`)}
					</p>
				</div>
			</div>
		</div>
	);
}
