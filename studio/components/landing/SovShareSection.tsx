'use client';

import { useTranslations } from 'next-intl';
import { scrollToAuditForm } from '@/components/landing/scroll-to-audit';

const SEGMENTS = [
	{ key: 'other', pct: 52, bar: 'bg-slate-400 hover:bg-slate-500 dark:bg-slate-600 dark:hover:bg-slate-500', dot: 'bg-slate-400 dark:bg-slate-500', value: 'text-slate-700 dark:text-slate-200' },
	{ key: 'a', pct: 27, bar: 'bg-amber-500 hover:bg-amber-400', dot: 'bg-amber-500', value: 'text-amber-600 dark:text-amber-300' },
	{ key: 'b', pct: 16, bar: 'bg-orange-500 hover:bg-orange-400 dark:bg-orange-600 dark:hover:bg-orange-500', dot: 'bg-orange-500', value: 'text-orange-600 dark:text-orange-300' },
	{ key: 'own', pct: 5, bar: 'bg-rose-500 hover:bg-rose-400', dot: 'bg-rose-500', value: 'text-rose-600 dark:text-rose-400' },
] as const;

export function SovShareSection() {
	const t = useTranslations('landing.story.sov');

	return (
		<section className="mt-20 sm:mt-24">
			<div className="mx-auto w-full max-w-[960px]">
				<div className="text-center">
					<p className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-bold tracking-[0.16em] text-violet-700 dark:border-violet-400/25 dark:bg-violet-500/10 dark:text-violet-300">
						{t('badge')}
					</p>
					<h2 className="mt-3">
						<span className="block text-lg font-medium text-slate-500 dark:text-slate-400 sm:text-xl">{t('title')}</span>
						<span className="mt-1 block text-2xl font-extrabold leading-snug text-slate-900 dark:text-white sm:text-3xl">
							{t('titleLine2')}
						</span>
					</h2>
					<p className="mx-auto mt-2 max-w-[680px] break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
						{t('subtitle')}
					</p>
				</div>

				<div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0B1120] dark:shadow-none sm:p-8">
					<p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('barTitle')}</p>

					<div
						className="mt-3 flex h-4 overflow-hidden rounded-full border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-950"
						role="img"
						aria-label={t('barTitle')}
					>
						{SEGMENTS.map(({ key, pct, bar }) => (
							<div
								key={key}
								title={`${t(`rows.${key}.name`)} ${pct}%`}
								className={`h-full cursor-default transition-all duration-200 first:rounded-l-full last:rounded-r-full ${bar}`}
								style={{ width: `${pct}%` }}
							/>
						))}
					</div>

					<ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
						{SEGMENTS.map(({ key, pct, dot, value }) => (
							<li
								key={key}
								className="rounded-xl border border-transparent bg-slate-50 p-3 transition-colors duration-200 hover:border-slate-200 hover:bg-white dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-900"
							>
								<p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
									<span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
									{t(`rows.${key}.name`)}
								</p>
								<p className={`mt-1 text-xl font-extrabold tabular-nums ${value}`}>{pct}%</p>
								<p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{t(`rows.${key}.note`)}</p>
							</li>
						))}
					</ul>

					<div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800/80 dark:bg-slate-950/70">
						<div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
							<div className="text-center sm:text-left">
								<p className="text-xs text-slate-500">{t('asIs.label')}</p>
								<p className="mt-1 text-3xl font-extrabold tabular-nums text-rose-400 transition-colors hover:text-rose-300">
									{t('asIs.value')}
								</p>
								<p className="mt-1 text-xs text-slate-500">{t('asIs.status')}</p>
							</div>

							<div className="flex flex-col items-center gap-2">
								<span className="text-slate-500 sm:hidden" aria-hidden>
									↓
								</span>
								<span className="hidden text-slate-500 sm:inline" aria-hidden>
									➔
								</span>
								<p className="rounded-full border border-cyan-200 bg-cyan-50 px-3.5 py-1.5 text-xs font-bold text-cyan-700 shadow-sm dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300">
									{t('lift')}
								</p>
							</div>

							<div className="text-center sm:text-right">
								<p className="text-xs text-slate-500">{t('toBe.label')}</p>
								<p className="mt-1 text-3xl font-extrabold tabular-nums text-emerald-400 transition-colors hover:text-emerald-300">
									{t('toBe.value')}
								</p>
								<p className="mt-1 break-keep text-xs font-medium text-emerald-400/80">{t('toBe.status')}</p>
							</div>
						</div>
					</div>
				</div>

				<div className="mt-8 text-center">
					<button
						type="button"
						onClick={scrollToAuditForm}
						className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition-all duration-200 hover:from-cyan-400 hover:to-blue-500 sm:text-base"
					>
						{t('cta')}
					</button>
					<p className="mt-2.5 text-xs text-slate-500">{t('ctaNote')}</p>
				</div>
			</div>
		</section>
	);
}
