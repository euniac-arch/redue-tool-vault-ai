'use client';

import { Bot, FileCheck, ShieldCheck, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

const CARDS: Array<{
	key: 'citation' | 'eeat' | 'report';
	Icon: LucideIcon;
	iconWrap: string;
}> = [
	{
		key: 'citation',
		Icon: Bot,
		iconWrap: 'border-indigo-400/30 bg-indigo-500/15 text-indigo-300',
	},
	{
		key: 'eeat',
		Icon: ShieldCheck,
		iconWrap: 'border-accent/40 bg-accent/15 text-accent-light',
	},
	{
		key: 'report',
		Icon: FileCheck,
		iconWrap: 'border-violet-400/30 bg-violet-500/15 text-violet-300',
	},
];

/** Three CRO value cards directly under the hero URL scanner. */
export function WhyGeoCards() {
	const t = useTranslations('hero.whyCards');

	return (
		<div className="grid w-full grid-cols-1 gap-3 text-left md:grid-cols-3 md:gap-4">
			{CARDS.map(({ key, Icon, iconWrap }) => (
				<article
					key={key}
					className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-indigo-950/30 p-4 transition hover:border-accent/35 hover:bg-white/[0.05] sm:p-5"
				>
					<div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${iconWrap}`}>
						<Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
					</div>
					<div>
						<p className="text-sm font-extrabold text-white sm:text-[15px]">{t(`${key}.title`)}</p>
						<p className="mt-0.5 text-xs font-semibold text-accent-light">{t(`${key}.subtitle`)}</p>
					</div>
					<p className="text-xs leading-relaxed text-slate-400 sm:text-[13px]">{t(`${key}.description`)}</p>
				</article>
			))}
		</div>
	);
}
