'use client';

import { useTranslations } from 'next-intl';

const LEVELS = [
	{ key: '1', highlight: false, titleClass: 'text-slate-800 dark:text-slate-100', statusClass: 'text-slate-500 dark:text-slate-400' },
	{ key: '2', highlight: false, titleClass: 'text-slate-800 dark:text-slate-100', statusClass: 'text-slate-600 dark:text-slate-300' },
	{ key: '3', highlight: true, titleClass: 'text-slate-900 dark:text-white', statusClass: 'font-medium text-emerald-700 dark:text-emerald-300' },
] as const;

export function ProblemSection() {
	const t = useTranslations('landing.story.problem');

	return (
		<section className="mt-20 sm:mt-24">
			<div className="mx-auto w-full max-w-[960px]">
				<div className="text-center">
					<p className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-bold tracking-[0.16em] text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-300">
						{t('badge')}
					</p>
					<h2 className="mt-4 break-keep text-[22px] leading-snug sm:text-[28px]">
						<span className="block font-normal text-slate-500 dark:text-slate-400">{t('title')}</span>
						<span className="mt-1 block bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 bg-clip-text font-bold text-transparent dark:from-white dark:via-slate-100 dark:to-slate-300">
							{t('titleLine2')}
						</span>
					</h2>
					<p className="mx-auto mt-4 max-w-[720px] break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
						{t('subtitle')}
					</p>
				</div>

				<div className="mt-8 grid grid-cols-1 items-stretch gap-5 md:grid-cols-12">
					<article className="col-span-12 flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0B1120] dark:shadow-none md:col-span-6">
						<div>
							<h3 className="text-[15px] font-bold text-slate-900 dark:text-white">{t('reach.title')}</h3>
							<p className="mt-1 text-xs text-slate-500">{t('reach.subtitle')}</p>
						</div>

						<ol className="relative mt-6 flex flex-1 flex-col gap-4">
							<span
								aria-hidden
								className="absolute bottom-6 left-[15px] top-6 w-px bg-gradient-to-b from-slate-300 via-slate-300 to-cyan-400/50 dark:from-slate-700 dark:via-slate-600"
							/>
							{LEVELS.map(({ key, highlight, titleClass, statusClass }) => (
								<li
									key={key}
									className={`relative rounded-xl border p-4 ${
										highlight
											? 'border-cyan-200 bg-cyan-50 dark:border-cyan-500/30 dark:bg-cyan-500/5'
											: 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60'
									}`}
								>
									<div className="flex items-start gap-3">
										<span
											className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-black ${
												highlight
													? 'border-cyan-300 bg-cyan-100 text-cyan-700 dark:border-cyan-400/40 dark:bg-cyan-400/15 dark:text-cyan-200'
													: 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-[#0B1120] dark:text-slate-400'
											}`}
										>
											{key}
										</span>
										<div className="min-w-0 flex-1">
											<p
												className={`text-[11px] font-bold tracking-wide ${
													highlight ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500'
												}`}
											>
												{t(`reach.levels.${key}.badge`)}
											</p>
											<p className={`mt-1 text-sm font-bold ${titleClass}`}>
												{t(`reach.levels.${key}.title`)}
											</p>
											<p className={`mt-1 text-xs leading-relaxed ${statusClass}`}>
												{t(`reach.levels.${key}.status`)}
											</p>
										</div>
									</div>
								</li>
							))}
						</ol>
					</article>

					<article className="col-span-12 flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0B1120] dark:shadow-none md:col-span-6">
						<div className="flex flex-1 flex-col rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
							<h3 className="text-[15px] font-bold text-slate-900 dark:text-white">{t('impact.title')}</h3>
							<p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{t('impact.sovTitle')}</p>

							<div className="mt-5 space-y-4">
								<div>
									<div className="flex items-baseline justify-between gap-3">
										<span className="text-xs text-slate-500 dark:text-slate-400">{t('impact.currentLabel')}</span>
										<span className="text-lg font-black tabular-nums text-rose-500 dark:text-rose-400">
											{t('impact.currentValue')}
										</span>
									</div>
									<div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
										<div className="h-full w-[5%] rounded-full bg-rose-400" />
									</div>
								</div>
								<div>
									<div className="flex items-baseline justify-between gap-3">
										<span className="text-xs text-slate-500 dark:text-slate-400">{t('impact.targetLabel')}</span>
										<span className="bg-gradient-to-r from-cyan-600 to-emerald-600 bg-clip-text text-lg font-black tabular-nums text-transparent dark:from-cyan-300 dark:to-emerald-300">
											{t('impact.targetValue')}
										</span>
									</div>
									<div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
										<div className="h-full w-[48%] rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" />
									</div>
								</div>
							</div>

							<p className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-[11px] font-bold leading-relaxed text-cyan-800 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-200">
								{t('impact.lift')}
							</p>
						</div>

						<div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
							<p className="break-keep text-lg font-bold leading-snug text-rose-600 dark:text-rose-400 sm:text-xl">
								{t('impact.costTitle')}
								<span className="align-middle text-[11px] font-medium text-slate-500">
									{t('impact.simEstimate')}
								</span>
							</p>
							<p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{t('impact.costBody')}</p>
							<p className="mt-3 text-[11px] leading-relaxed text-slate-500">{t('impact.costNote')}</p>
						</div>
					</article>
				</div>
			</div>
		</section>
	);
}
