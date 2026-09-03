'use client';

import { useTranslations } from 'next-intl';
import type { AsiCompetitorIntensity, AsiCompetitorRow } from '@/lib/ai-search-intelligence/types';
import { ASI_HOVER_MOTION } from '@/lib/ui/asi-chrome';

const RING: Record<AsiCompetitorIntensity, string> = {
	high: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200',
	mid: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200',
	low: 'border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
};

const SLOT: Record<number, string> = {
	0: 'left-[8%] top-[14%] sm:left-[12%] sm:top-[18%]',
	1: 'right-[6%] top-[22%] sm:right-[10%] sm:top-[16%]',
	2: 'left-1/2 bottom-[10%] -translate-x-1/2 sm:bottom-[12%]',
};

export function AsiCompetitorMap({
	brandName,
	competitors,
}: {
	brandName: string;
	competitors: AsiCompetitorRow[];
}) {
	const t = useTranslations('intelligence.warRoom');

	return (
		<div className="relative min-h-[260px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 sm:min-h-[300px]">
			<div className="absolute left-1/2 top-1/2 z-10 w-[42%] max-w-[11rem] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-cyan-300 bg-white px-3 py-3 text-center dark:border-cyan-700 dark:bg-slate-900">
				<p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-400">
					{t('brandLabel')}
				</p>
				<p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-white">{brandName}</p>
			</div>
			{competitors.slice(0, 3).map((row, index) => (
				<div
					key={row.name}
					className={`absolute max-w-[42%] rounded-xl border px-3 py-2 ${ASI_HOVER_MOTION} hover:border-cyan-400 dark:hover:border-cyan-600 ${RING[row.intensity]} ${SLOT[index] ?? SLOT[2]}`}
				>
					<p className="truncate text-xs font-bold">{row.name}</p>
					<p className="mt-0.5 text-[10px] font-semibold opacity-80">{row.area}</p>
				</div>
			))}
		</div>
	);
}
