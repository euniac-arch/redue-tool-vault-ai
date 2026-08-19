'use client';

import { useTranslations } from 'next-intl';

const PILLARS = ['defend', 'reach', 'asset'] as const;

export function RoiValueSection() {
	const t = useTranslations('landing.story.roi');

	return (
		<section className="mt-20 sm:mt-24">
			<div className="mx-auto w-full max-w-[960px]">
				<div className="text-center">
					<p className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tracking-widest text-emerald-400">
						{t('badge')}
					</p>
					<h2 className="mt-3">
						<span className="block text-lg font-medium text-slate-300 sm:text-xl">{t('title')}</span>
						<span className="mt-1 block bg-gradient-to-r from-white via-cyan-200 to-emerald-400 bg-clip-text text-2xl font-extrabold leading-snug text-transparent sm:text-3xl">
							{t('titleLine2')}
						</span>
					</h2>
					<p className="mx-auto mt-2 max-w-[680px] break-keep text-sm leading-relaxed text-slate-400 sm:text-base">
						{t('subtitle')}
					</p>
				</div>

				<div className="mt-8 grid grid-cols-1 items-stretch gap-5 md:grid-cols-12">
					<article className="col-span-12 flex h-full flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-950/70 p-6 md:col-span-5">
						<div>
							<p className="text-xs uppercase tracking-wider text-slate-400">{t('score.label')}</p>
							<div className="mt-5">
								<p className="text-xs text-slate-500">{t('score.fromLabel')}</p>
								<p className="mt-1 text-3xl font-extrabold tabular-nums text-rose-400">{t('score.from')}</p>
							</div>
							<p className="mt-3 text-xs font-bold text-cyan-400">{t('score.delta')}</p>
							<div className="mt-3">
								<p className="text-xs text-slate-500">{t('score.toLabel')}</p>
								<p className="mt-1 text-4xl font-extrabold tabular-nums text-emerald-400">{t('score.to')}</p>
							</div>
							<div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
								<span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 font-medium text-rose-300">
									{t('score.fromGrade')}
								</span>
								<span className="text-slate-600" aria-hidden>
									➔
								</span>
								<span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-300">
									{t('score.toGrade')}
								</span>
							</div>
						</div>
						<p className="mt-4 text-xs leading-relaxed text-slate-500">{t('score.note')}</p>
					</article>

					<article className="relative col-span-12 flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 p-6 shadow-[0_0_30px_rgba(16,185,129,0.08)] md:col-span-7">
						<div>
							<p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">{t('value.label')}</p>
							<p className="mt-4 break-keep text-sm font-medium text-slate-400">
								{t('value.from')}
								<span className="text-[11px] font-medium text-slate-500">{t('value.simEstimate')}</span>
							</p>
							<p className="mt-0.5 break-keep text-2xl font-black tracking-tight text-emerald-300 sm:text-3xl">
								{t('value.to')}
								<span className="align-middle text-[11px] font-medium text-slate-500">
									{t('value.simEstimate')}
								</span>
							</p>
							<p className="mt-2 text-sm leading-relaxed text-slate-400">{t('value.desc')}</p>
							<ul className="mt-5 space-y-2.5">
								{PILLARS.map((key) => (
									<li key={key} className="text-sm leading-relaxed text-slate-200">
										{t(`value.pillars.${key}`)}
									</li>
								))}
							</ul>
						</div>
						<p className="mt-3 text-[11px] leading-relaxed text-slate-500">{t('value.note')}</p>
					</article>
				</div>

				<div className="mt-6 flex flex-col items-center justify-between gap-5 rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/60 via-slate-900 to-blue-950/60 p-6 shadow-lg sm:flex-row">
					<div className="text-center sm:text-left">
						<p className="text-base font-bold leading-snug text-white sm:text-lg">{t('offer.title')}</p>
						<p className="mt-1 text-xs text-cyan-300/80 sm:text-sm">{t('offer.body')}</p>
					</div>
					<a
						href="#pricing"
						className="shrink-0 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-900/40 transition-all duration-200 hover:from-cyan-400 hover:to-blue-500"
					>
						{t('offer.cta')}
					</a>
				</div>
			</div>
		</section>
	);
}
