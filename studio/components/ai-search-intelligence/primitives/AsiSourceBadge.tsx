'use client';

import { useTranslations } from 'next-intl';
import type { AsiSource } from '@/lib/ai-search-intelligence/types';
import { ASI_BADGE } from '@/lib/ui/asi-chrome';

const TONE: Record<AsiSource, string> = {
	mock: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
	audit: 'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200',
	live: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
	derived: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300',
	fallback: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200',
};

export function AsiSourceBadge({ source }: { source: AsiSource }) {
	const t = useTranslations('intelligence.warRoom');
	return (
		<span className={`${ASI_BADGE} ${TONE[source]}`}>
			{t(`source.${source}`)}
		</span>
	);
}
