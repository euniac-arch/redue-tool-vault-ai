'use client';

import { Bot, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AiCrawlerBotStatus } from '@/types/geo-diagnostic';

interface AICrawlerStatusCardProps {
	bots: readonly AiCrawlerBotStatus[];
}

export function AICrawlerStatusCard({ bots }: AICrawlerStatusCardProps) {
	const t = useTranslations('audit.digitalFootprint.crawlers');
	if (!bots.length) return null;

	const blocked = bots.filter((bot) => !bot.allowed);
	const claudeWarning = bots.find((bot) => bot.id === 'claudebot' && !bot.allowed)?.warning;

	return (
		<div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-black/20 px-3.5 py-3 sm:px-4">
			<div className="flex min-w-0 items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2">
					<span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
						<Bot className="h-3.5 w-3.5" aria-hidden />
					</span>
					<p className="min-w-0 text-[11px] font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-200">
						{t('title')}
					</p>
				</div>
				<span className="group relative inline-flex shrink-0">
					<button
						type="button"
						className="inline-flex cursor-pointer items-center justify-center text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 dark:hover:text-slate-200"
						aria-label={t('tooltip')}
					>
						<Info className="h-3.5 w-3.5" aria-hidden />
					</button>
					<span
						role="tooltip"
						className="pointer-events-none invisible absolute bottom-full right-0 z-50 mb-1.5 w-max max-w-[18rem] rounded-lg bg-gray-900/90 px-3 py-1.5 text-left text-xs leading-relaxed whitespace-normal break-keep text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
					>
						{t('tooltip')}
					</span>
				</span>
			</div>

			<ul className="mt-2.5 flex flex-wrap gap-1.5">
				{bots.map((bot) => (
					<li key={bot.id}>
						<span
							title={bot.warning || (bot.allowed ? t('allowed') : t('blocked'))}
							className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold ring-1 ${
								bot.allowed
									? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 ring-emerald-400/40'
									: 'bg-amber-50 dark:bg-amber-500/15 text-amber-900 dark:text-amber-200 ring-amber-400/50'
							}`}
						>
							<span className="max-w-[11rem] truncate">{bot.label}</span>
							<span className="font-bold opacity-80">{bot.allowed ? t('allowed') : t('blocked')}</span>
						</span>
					</li>
				))}
			</ul>

			{claudeWarning || blocked.length ? (
				<p className="mt-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
					{claudeWarning || t('blockedHint', { count: blocked.length })}
				</p>
			) : null}
		</div>
	);
}
