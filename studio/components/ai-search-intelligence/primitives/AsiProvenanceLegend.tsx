'use client';

import { useTranslations } from 'next-intl';
import { AsiProvenanceBadge } from '@/components/ai-search-intelligence/primitives/AsiProvenanceBadge';

export function AsiProvenanceLegend() {
	const t = useTranslations('intelligence.provenance');

	return (
		<div
			className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40"
			aria-label={t('legendAria')}
		>
			<p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{t('legendTitle')}</p>
			<p className="inline-flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
				<AsiProvenanceBadge badge="observed" />
				<span>{t('legendObserved')}</span>
			</p>
			<p className="inline-flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
				<AsiProvenanceBadge badge="redue_analysis" />
				<span>{t('legendDerived')}</span>
			</p>
		</div>
	);
}
