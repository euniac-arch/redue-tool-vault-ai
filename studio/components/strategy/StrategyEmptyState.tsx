'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface StrategyEmptyStateProps {
	reason: 'missing' | 'invalid' | 'network';
}

export function StrategyEmptyState({ reason }: StrategyEmptyStateProps) {
	const t = useTranslations('strategyStudio');

	return (
		<div className="px-1 py-12 text-center">
			<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
				{t('eyebrow')}
			</p>
			<h1 className="mt-3 text-[1.75rem] font-extrabold tracking-tight text-slate-900 dark:text-white">{t('emptyTitle')}</h1>
			<p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300">
				{reason === 'network' ? t('emptyNetwork') : t('emptyBody')}
			</p>
			<div className="mt-6 flex flex-wrap items-center justify-center gap-2">
				<Link
					href="/audit/history"
					className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-slate-950"
				>
					{t('emptyHistory')}
				</Link>
				<Link
					href="/"
					className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 dark:border-[#1f3a5a] dark:bg-[#0b1726] dark:text-slate-100"
				>
					{t('emptyScan')}
				</Link>
			</div>
		</div>
	);
}
