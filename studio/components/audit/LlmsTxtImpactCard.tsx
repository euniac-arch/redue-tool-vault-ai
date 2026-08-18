'use client';

import { AlertTriangle, CheckCircle2, FileCode2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { resolveLlmsCategoryName } from '@/lib/audit/llms-txt-impact';
import type { IndustryConfig } from '@/lib/registry/universalIndustryRegistry';

export interface LlmsTxtImpactCardProps {
	/** `industryConfig.defaultCategory` (fallback: 전문 비즈니스). */
	categoryName?: string;
	industryConfig?: Pick<IndustryConfig, 'defaultCategory'> | null;
	className?: string;
}

export function LlmsTxtImpactCard({ categoryName, industryConfig, className = 'mb-4' }: LlmsTxtImpactCardProps) {
	const t = useTranslations('audit.advancedGeo.llms.impact');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const resolvedCategory = resolveLlmsCategoryName(industryConfig, lang, categoryName);

	return (
		<div
			className={`rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-900/50 ${className}`}
		>
			<div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2 dark:border-slate-800">
				<div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
					<FileCode2 className="h-4 w-4 text-indigo-500" aria-hidden />
					<span>{t('title')}</span>
				</div>
				<span className="rounded-md border border-indigo-200/60 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-400">
					{t('badge')}
				</span>
			</div>

			<div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
				<div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
					<div className="mb-1 flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
						<CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
						<span>{t('withLabel')}</span>
					</div>
					<p className="break-keep leading-relaxed text-slate-600 dark:text-slate-400">
						{t('with', { categoryName: resolvedCategory })}
					</p>
				</div>

				<div className="rounded-lg border border-rose-100 bg-rose-50/60 p-2.5 dark:border-rose-900/40 dark:bg-rose-950/20">
					<div className="mb-1 flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400">
						<AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
						<span>{t('withoutLabel')}</span>
					</div>
					<p className="break-keep leading-relaxed text-slate-600 dark:text-slate-400">{t('without')}</p>
				</div>
			</div>
		</div>
	);
}
