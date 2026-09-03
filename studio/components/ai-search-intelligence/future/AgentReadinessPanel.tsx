'use client';

import { useTranslations } from 'next-intl';
import { AsiScore } from '@/components/ai-search-intelligence/primitives/AsiScore';
import type { AsiAgentReadinessSnapshot, AsiReadinessStatus } from '@/lib/ai-search-intelligence/types';
import { ASI_BADGE } from '@/lib/ui/asi-chrome';
import { useAsiMotion } from '@/lib/ui/asi-motion';

const STATUS_TONE: Record<AsiReadinessStatus, string> = {
	ready:
		'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
	partial:
		'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
	gap: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
};

const BAR_TONE: Record<AsiReadinessStatus, string> = {
	ready: 'bg-emerald-500',
	partial: 'bg-amber-500',
	gap: 'bg-rose-500',
};

export function AgentReadinessPanel({ snapshot }: { snapshot: AsiAgentReadinessSnapshot }) {
	const t = useTranslations('intelligence.future');
	const { reduce, chartMs } = useAsiMotion();

	return (
		<ol className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
			{snapshot.items.map((item, index) => (
				<li key={item.id} className="py-5 first:pt-0 last:pb-0">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="min-w-0">
							<p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
								{String(index + 1).padStart(2, '0')}
							</p>
							<h3 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{t(`criterion.${item.id}`)}</h3>
							<p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t(`criterionHint.${item.id}`)}</p>
						</div>
						<div className="flex items-center gap-3">
							<AsiScore value={item.score} label={t('score')} metric="readinessItem" size="sm" />
							<span className={`${ASI_BADGE} py-1 ${STATUS_TONE[item.status]}`}>
								{t(`status.${item.status}`)}
							</span>
						</div>
					</div>
					<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
						<div
							className={`h-full rounded-full ${BAR_TONE[item.status]}`}
							style={{
								width: `${item.score}%`,
								transition: reduce ? undefined : `width ${chartMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
							}}
						/>
					</div>
					<dl className="mt-4 grid gap-3 md:grid-cols-2">
						<div>
							<dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('issue')}</dt>
							<dd className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.issue}</dd>
						</div>
						<div>
							<dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('fix')}</dt>
							<dd className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.fix}</dd>
						</div>
					</dl>
				</li>
			))}
		</ol>
	);
}
