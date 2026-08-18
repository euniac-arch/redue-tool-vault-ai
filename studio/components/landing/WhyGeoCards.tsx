'use client';

import { useTranslations } from 'next-intl';

const CARDS = [
	{
		key: 'aiTrust',
		emoji: '🌐',
		iconWrap: 'border-indigo-400/30 bg-indigo-500/15',
	},
	{
		key: 'techScore',
		emoji: '⚙️',
		iconWrap: 'border-accent/40 bg-accent/15',
	},
	{
		key: 'defects',
		emoji: '🎯',
		iconWrap: 'border-violet-400/30 bg-violet-500/15',
	},
] as const;

/** Three outcome-led cards: what the audit actually returns. */
export function WhyGeoCards() {
	const t = useTranslations('hero');

	return (
		<div className="flex flex-col gap-5">
			<h2 className="text-center text-lg font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-xl md:text-2xl">
				{t('whyCardsSectionTitle')}
			</h2>
			<div className="grid w-full grid-cols-1 gap-3 text-left md:grid-cols-3 md:gap-4">
				{CARDS.map(({ key, emoji, iconWrap }) => (
					<article
						key={key}
						className="flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-gradient-to-br from-white to-indigo-50 dark:from-white/[0.04] dark:to-indigo-950/30 p-4 transition hover:border-accent/35 hover:bg-slate-50 dark:hover:bg-white/[0.05] sm:p-5"
					>
						<div
							className={`flex h-10 w-10 items-center justify-center rounded-xl border text-lg ${iconWrap}`}
							aria-hidden
						>
							{emoji}
						</div>
						<div>
							<p className="text-sm font-extrabold text-slate-900 dark:text-white sm:text-[15px]">{t(`whyCards.${key}.title`)}</p>
							<p className="mt-0.5 text-xs font-semibold text-indigo-700 dark:text-accent-light">{t(`whyCards.${key}.subtitle`)}</p>
						</div>
						<p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400 sm:text-[13px]">
							{t(`whyCards.${key}.description`)}
						</p>
					</article>
				))}
			</div>
		</div>
	);
}
