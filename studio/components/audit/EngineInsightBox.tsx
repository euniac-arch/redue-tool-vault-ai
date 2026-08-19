'use client';

import { useTranslations } from 'next-intl';
import type { EngineAnalysis } from '@/lib/audit/engine-insight';

interface EngineInsightBoxProps {
	analysis: EngineAnalysis;
}

export function EngineInsightBox({ analysis }: EngineInsightBoxProps) {
	const t = useTranslations('audit.aiEngines');

	return (
		<div
			className={`mt-4 rounded-xl border p-3.5 text-xs leading-relaxed ${
				analysis.isCited
					? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-300'
					: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-300'
			}`}
		>
			<div className="mb-2 flex items-start gap-1.5 text-[12.5px] font-bold">
				<span className="shrink-0">
					{analysis.isCited ? t('insightCitedMechanism') : t('insightUncitedCause')}
				</span>
				<span className="font-normal text-slate-500 dark:text-slate-400">| {analysis.reasonTitle}</span>
			</div>

			<ul className="space-y-1.5 pl-1 text-[11.5px] text-slate-700 dark:text-slate-300">
				{analysis.reasonDetails.map((detail) => (
					<li key={detail} className="flex items-start gap-1.5">
						<span className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden>
							•
						</span>
						<span>{detail}</span>
					</li>
				))}
			</ul>

			{analysis.isCited && analysis.citedSources && analysis.citedSources.length > 0 ? (
				<div className="mt-2.5 border-t border-emerald-200/80 pt-2 dark:border-emerald-800/30">
					<div className="mb-1 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-400">
						{t('insightCitedPath')}
					</div>
					<div className="flex flex-wrap gap-1">
						{analysis.citedSources.map((src) => (
							<span
								key={src}
								className="max-w-[200px] truncate rounded border border-emerald-200 bg-emerald-100/80 px-2 py-0.5 font-mono text-[10px] text-slate-700 dark:border-emerald-700/30 dark:bg-emerald-900/40 dark:text-slate-300"
								title={src}
							>
								{src}
							</span>
						))}
					</div>
				</div>
			) : null}

			{!analysis.isCited ? (
				<div className="mt-2.5 border-t border-rose-200/80 pt-2 text-[11px] text-rose-800 dark:border-rose-800/30 dark:text-rose-200">
					<strong className="font-semibold text-rose-600 dark:text-rose-400">{t('insightActionRequired')}</strong>{' '}
					{analysis.actionRequired}
				</div>
			) : (
				<div className="mt-2.5 border-t border-emerald-200/80 pt-2 text-[11px] text-emerald-800 dark:border-emerald-800/30 dark:text-emerald-200">
					<strong className="font-semibold text-emerald-700 dark:text-emerald-400">{t('insightNextStep')}</strong>{' '}
					{analysis.actionRequired}
				</div>
			)}
		</div>
	);
}
