'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AsiBilingualTitle, AsiCategoryBadge } from '@/components/ai-search-intelligence/primitives/AsiBilingualTitle';
import { getIntelligenceCategory, getIntelligenceToolByEntryId } from '@/constants/aiIntelligenceTools';
import { useAsiIaContext } from '@/lib/ai-search-intelligence/ia/use-asi-ia-context';
import {
	ASI_PILLARS,
	asiIaEntries,
	isAsiIaEntryActive,
	isAsiIaGroupActive,
} from '@/lib/ai-search-intelligence/routes';
import { asiFocusRing } from '@/lib/ui/asi-chrome';

export function AsiGnbDropdown({
	pathname,
	onNavigate,
	open,
}: {
	pathname: string;
	onNavigate: () => void;
	open: boolean;
}) {
	const t = useTranslations('intelligence');
	const context = useAsiIaContext();
	const hash = typeof window !== 'undefined' ? window.location.hash : '';

	return (
		<div className="rounded-xl border border-cyan-200/80 bg-white/95 p-3 opacity-100 shadow-2xl shadow-cyan-950/10 backdrop-blur-xl dark:border-cyan-800/40 dark:bg-[#0a1626]/95 dark:shadow-cyan-950/50">
			<p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">
				{t('ia.gnbHint')}
			</p>
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
				{ASI_PILLARS.map((group) => {
					const groupActive = isAsiIaGroupActive(group, pathname, hash);
					const category = getIntelligenceCategory(group.id);
					return (
						<section key={group.id} className="min-w-[10.5rem]">
							<Link
								href={group.href}
								tabIndex={open ? 0 : -1}
								onClick={onNavigate}
								className={asiFocusRing(
									`block rounded-lg px-2 py-1.5 ${
										groupActive ? 'bg-cyan-50 dark:bg-[#13233a]' : ''
									}`,
								)}
							>
								<p className="text-[10px] font-semibold text-cyan-700 dark:text-cyan-400">
									<AsiCategoryBadge categoryKo={category.categoryKo} categoryEn={category.categoryEn} />
								</p>
							</Link>
							<ul className="mt-1 flex flex-col gap-0.5">
								{asiIaEntries(group).map((entry) => {
									const active = isAsiIaEntryActive(entry, pathname, hash);
									const ctx = context?.[entry.id];
									const tool = getIntelligenceToolByEntryId(entry.id);
									return (
										<li key={entry.id}>
											<Link
												href={entry.href}
												aria-current={active ? 'page' : undefined}
												tabIndex={open ? 0 : -1}
												onClick={onNavigate}
												className={`block rounded-md px-2 py-1.5 text-[12px] leading-snug ${
													active
														? 'bg-cyan-50 font-semibold text-cyan-800 dark:bg-[#13233a] dark:text-cyan-300'
														: 'text-slate-600 hover:bg-cyan-50 hover:text-cyan-700 dark:text-slate-300 dark:hover:bg-[#13233a] dark:hover:text-cyan-300'
												}`}
											>
												{tool ? (
													<AsiBilingualTitle titleKo={tool.titleKo} titleEn={tool.titleEn} />
												) : (
													<span className="block truncate">{t(entry.titleKey)}</span>
												)}
												<span className="mt-0.5 flex gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
													<span>{t(`status.${ctx?.status ?? 'empty'}`)}</span>
													<span className="tabular-nums">{ctx?.score == null ? '—' : ctx.score}</span>
												</span>
											</Link>
										</li>
									);
								})}
							</ul>
						</section>
					);
				})}
			</div>
		</div>
	);
}
