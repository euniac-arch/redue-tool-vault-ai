'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ASI_LOOP_STAGES, type AsiLoopStage } from '@/lib/ai-search-intelligence/types';
import { ASI_LOOP_HREF, asiLoopStageFromPath } from '@/lib/ai-search-intelligence/loop/stages';
import { asiFocusRing } from '@/lib/ui/asi-chrome';

export function AsiLoopNav({ current }: { current?: AsiLoopStage | null }) {
	const t = useTranslations('intelligence.loop');
	const pathname = usePathname();
	const active = current ?? asiLoopStageFromPath(pathname || '');

	return (
		<nav aria-label={t('aria')} className="flex flex-wrap items-center gap-1.5">
			{ASI_LOOP_STAGES.map((stage, index) => (
				<span key={stage} className="inline-flex items-center gap-1.5">
					{index > 0 ? <span className="text-[10px] text-zinc-400">→</span> : null}
					<Link
						href={ASI_LOOP_HREF[stage]}
						className={asiFocusRing(
							`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
								active === stage
									? 'border-cyan-400 bg-cyan-50 text-cyan-800 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200'
									: 'border-slate-200 text-slate-500 hover:border-cyan-300 dark:border-slate-700 dark:text-slate-400'
							}`,
						)}
					>
						{t(`stage.${stage}`)}
					</Link>
				</span>
			))}
		</nav>
	);
}
