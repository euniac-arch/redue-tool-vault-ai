'use client';

import { useTranslations } from 'next-intl';

const LEVELS = [
	{
		key: '1',
		card: 'border border-slate-200 bg-white text-slate-500 p-5 shadow-sm dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-400 dark:shadow-none',
		badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400',
		title: 'text-slate-800 dark:text-slate-200',
		chip: 'text-slate-700 dark:text-slate-300',
		fix: 'text-slate-500 dark:text-slate-400',
	},
	{
		key: '2',
		card: 'border border-blue-200 bg-white text-slate-600 shadow-sm p-5 dark:bg-slate-900/70 dark:border-blue-500/30 dark:text-slate-300',
		badge: 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400',
		title: 'text-slate-900 dark:text-slate-100',
		chip: 'text-blue-800 dark:text-blue-100',
		fix: 'text-blue-700 dark:text-blue-200',
	},
	{
		key: '3',
		card: 'relative overflow-hidden border-2 border-cyan-300 bg-gradient-to-b from-white via-white to-cyan-50 p-6 shadow-sm dark:border-cyan-400/50 dark:from-slate-900/90 dark:via-slate-900 dark:to-cyan-950/40 dark:shadow-[0_0_30px_rgba(6,182,212,0.15)]',
		badge: 'border border-cyan-300 bg-cyan-50 font-bold text-cyan-700 dark:border-cyan-400/40 dark:bg-cyan-500/20 dark:text-cyan-300',
		title: 'text-slate-900 dark:text-white',
		chip: 'text-cyan-800 dark:text-cyan-100',
		fix: 'text-cyan-700 dark:text-cyan-300',
	},
] as const;

const ATTRS = ['recognized', 'exposure', 'insight'] as const;

export function QueryReachSection() {
	const t = useTranslations('landing.story.reach');

	return (
		<section className="mt-20 sm:mt-24">
			<div className="mx-auto w-full max-w-[960px]">
				<div className="text-center">
					<p className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold tracking-widest text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-400">
						{t('badge')}
					</p>
					<h2 className="mt-3 break-keep text-2xl font-bold leading-snug text-slate-900 dark:text-white sm:text-3xl">
						{t('title')}
					</h2>
					<p className="mx-auto mt-2 max-w-[720px] break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
						{t('subtitle')}
					</p>
				</div>

				<ol className="mt-10 grid grid-cols-1 items-stretch gap-5 md:grid-cols-3">
					{LEVELS.map(({ key, card, badge, title, chip, fix }, index) => (
						<li key={key} className="relative flex">
							{index < LEVELS.length - 1 ? (
								<>
									<span
										aria-hidden
										className="absolute -bottom-4 left-1/2 z-10 -translate-x-1/2 text-sm text-slate-300 dark:text-slate-600 md:hidden"
									>
										↓
									</span>
									<span
										aria-hidden
										className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-slate-300 dark:text-slate-500 md:block"
									>
										➔
									</span>
								</>
							) : null}

							<article className={`flex h-full w-full flex-col justify-between rounded-2xl ${card}`}>
								<div>
									<p className={`inline-flex rounded-full px-2.5 py-1 text-[11px] tracking-wide ${badge}`}>
										{t(`levels.${key}.badge`)}
									</p>
									<h3 className={`mt-3 text-[17px] font-bold leading-snug ${title}`}>
										{t(`levels.${key}.title`)}
									</h3>
									<p
										className={`mt-4 break-keep rounded-md bg-slate-50 px-2.5 py-1.5 font-mono text-xs leading-relaxed dark:bg-slate-950/80 ${chip}`}
									>
										“{t(`levels.${key}.query`)}”
									</p>
									<dl className="mt-5 space-y-3">
										{ATTRS.map((attr) => (
											<div key={attr} className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0 dark:border-white/5">
												<dt className="text-[11px] font-semibold tracking-wide text-slate-500">
													{t(`levels.${key}.labels.${attr}`)}
												</dt>
												<dd className="mt-1 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
													{t(`levels.${key}.${attr}`)}
												</dd>
											</div>
										))}
									</dl>
								</div>
								<p className={`mt-6 border-t border-slate-100 pt-4 text-[13px] font-medium leading-relaxed dark:border-white/5 ${fix}`}>
									{t(`levels.${key}.fix`)}
								</p>
							</article>
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}
