'use client';

import { useTranslations } from 'next-intl';
import { scrollToAuditForm } from '@/components/landing/scroll-to-audit';

const DEFECTS = [
	{ key: 'https', tone: 'rose' },
	{ key: 'schema', tone: 'rose' },
	{ key: 'llms', tone: 'rose' },
	{ key: 'eeat', tone: 'amber' },
	{ key: 'nap', tone: 'amber' },
] as const;

const GAINS = ['citation', 'leak', 'query'] as const;

export function DiagnosisProofSection() {
	const t = useTranslations('landing.story.proof');

	return (
		<section className="mt-20 sm:mt-24">
			<div className="mx-auto w-full max-w-[960px]">
				<div className="text-center">
					<p className="inline-flex rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-[11px] font-bold tracking-[0.16em] text-rose-400">
						{t('badge')}
					</p>
					<h2 className="mt-4 break-keep text-2xl font-bold leading-snug text-white sm:text-3xl">
						{t('title')}
					</h2>
					<p className="mx-auto mt-2 max-w-[720px] break-keep text-sm leading-relaxed text-slate-400 sm:text-base">
						{t('subtitle')}
					</p>
				</div>

				<div className="mt-8 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
					<article className="col-span-12 flex h-full flex-col justify-between rounded-2xl border border-slate-800/80 bg-[#0B1120] p-6 lg:col-span-7">
						<div>
							<p className="break-keep text-xs text-slate-400">{t('sampleLabel')}</p>
							<div className="mt-3 flex items-end justify-between gap-3">
								<p className="text-sm font-semibold text-slate-300">{t('scoreLabel')}</p>
								<p className="text-3xl font-extrabold tabular-nums leading-none text-rose-400">
									{t('scoreValue')}
									<span className="ml-1 text-sm font-semibold text-slate-500">{t('scoreMax')}</span>
								</p>
							</div>

							<div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
								<div className="flex items-center justify-between gap-3 rounded-lg bg-slate-950/60 p-2.5">
									<p className="text-xs leading-relaxed text-slate-400">{t('aiTrust')}</p>
									<p className="shrink-0 text-right">
										<span className="block text-sm font-bold tabular-nums text-white">{t('aiTrustScore')}</span>
										<span className="block text-[11px] text-slate-500">{t('aiTrustMeta')}</span>
									</p>
								</div>
								<div className="flex items-center justify-between gap-3 rounded-lg bg-slate-950/60 p-2.5">
									<p className="text-xs leading-relaxed text-slate-400">{t('tech')}</p>
									<p className="shrink-0 text-right">
										<span className="block text-sm font-bold tabular-nums text-white">{t('techScore')}</span>
										<span className="block text-[11px] text-rose-300/80">{t('techMeta')}</span>
									</p>
								</div>
							</div>
						</div>

						<ul className="mt-6 space-y-2">
							{DEFECTS.map(({ key, tone }) => (
								<li
									key={key}
									className={`rounded-xl border px-3 py-2.5 ${
										tone === 'rose'
											? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
											: 'border-amber-500/20 bg-amber-500/10 text-amber-300'
									}`}
								>
									<p className="flex flex-wrap items-center gap-2 text-[13px] leading-relaxed">
										<span>{tone === 'rose' ? '❌' : '⚠️'}</span>
										<span className="rounded-md border border-current/20 bg-black/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wide">
											{t(`defects.${key}.tag`)}
										</span>
										<span className="font-semibold text-white">{t(`defects.${key}.title`)}</span>
									</p>
									<p className="mt-1 pl-6 text-[11px] leading-relaxed text-slate-400">
										{t(`defects.${key}.detail`)}
									</p>
								</li>
							))}
						</ul>
					</article>

					<article className="col-span-12 flex h-full flex-col justify-between rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-6 shadow-[0_0_25px_rgba(6,182,212,0.08)] lg:col-span-5">
						<div>
							<p className="text-sm font-semibold text-cyan-400">{t('sim.kicker')}</p>
							<h3 className="mt-1 text-lg font-bold leading-snug text-white">{t('sim.title')}</h3>

							<div className="mt-5 rounded-xl border border-slate-800 bg-[#0B1120] p-4">
								<div className="flex items-center justify-between gap-3 text-sm">
									<div>
										<p className="text-[11px] text-slate-500">{t('sim.fromLabel')}</p>
										<p className="mt-0.5 font-bold text-slate-300">{t('sim.from')}</p>
									</div>
									<span className="text-slate-600" aria-hidden>
										➔
									</span>
									<div className="text-right">
										<p className="text-[11px] text-emerald-400/80">{t('sim.toLabel')}</p>
										<p className="mt-0.5 font-bold text-emerald-300">{t('sim.to')}</p>
									</div>
								</div>
								<p className="mt-4 inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-bold text-emerald-400">
									{t('sim.delta')}
								</p>
							</div>

							<ul className="mt-5 space-y-3">
								{GAINS.map((key) => (
									<li key={key} className="flex items-start gap-2 text-sm leading-relaxed text-slate-300">
										<span className="mt-0.5 text-emerald-400" aria-hidden>
											✓
										</span>
										<span>{t(`sim.gains.${key}`)}</span>
									</li>
								))}
							</ul>
						</div>

						<button
							type="button"
							onClick={scrollToAuditForm}
							className="mt-6 w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-center text-sm font-medium text-cyan-300 transition-all hover:bg-slate-700"
						>
							{t('sim.cta')}
						</button>
					</article>
				</div>
			</div>
		</section>
	);
}
