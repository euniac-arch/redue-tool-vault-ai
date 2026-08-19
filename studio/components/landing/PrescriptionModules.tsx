'use client';

import { useTranslations } from 'next-intl';
import { scrollToAuditForm } from '@/components/landing/scroll-to-audit';

const STEPS = [
	{ key: 'problem', mark: '🔴', badge: 'bg-rose-500/15 text-rose-300' },
	{ key: 'prescription', mark: '⚡', badge: 'bg-cyan-500/15 text-cyan-300' },
	{ key: 'effect', mark: '🟢', badge: 'bg-emerald-500/15 text-emerald-300' },
] as const;

const MODULES = [
	{ key: 'schema', hero: true, badge: 'bg-cyan-500/10 text-cyan-400' },
	{ key: 'faq', hero: false, badge: 'bg-indigo-500/10 text-indigo-400' },
	{ key: 'nap', hero: false, badge: 'bg-blue-500/10 text-blue-400' },
	{ key: 'rag', hero: false, badge: 'bg-emerald-500/10 text-emerald-400' },
	{ key: 'llms', hero: false, badge: 'bg-amber-500/10 text-amber-400' },
] as const;

export function PrescriptionModules() {
	const t = useTranslations('landing.story.modules');

	return (
		<section className="mt-20 sm:mt-24">
			<div className="mx-auto w-full max-w-[960px]">
				<div className="text-center">
					<p className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold tracking-widest text-cyan-400">
						{t('badge')}
					</p>
					<h2 className="mt-3">
						<span className="block font-mono text-xs uppercase tracking-widest text-slate-400">{t('kicker')}</span>
						<span className="mt-1 block text-2xl font-extrabold leading-snug text-white sm:text-3xl">
							{t('title')}
						</span>
					</h2>
					<p className="mx-auto mt-2 max-w-[640px] break-keep text-sm leading-relaxed text-slate-400 sm:text-base">
						{t('subtitle')}
					</p>
				</div>

				<ul className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
					{MODULES.map(({ key, hero, badge }) => (
						<li key={key} className={hero ? 'col-span-full' : 'col-span-1'}>
							<article className="h-full rounded-2xl border border-slate-800/90 bg-[#0B1120] p-5 sm:p-6">
								<p className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${badge}`}>
									{t(`items.${key}.badge`)}
								</p>
								<h3 className="mt-3 text-[17px] font-bold leading-snug text-white">{t(`items.${key}.title`)}</h3>
								<p className="mt-1.5 text-sm leading-relaxed text-slate-400">{t(`items.${key}.summary`)}</p>

								<div
									className={`mt-4 gap-3 ${
										hero
											? 'grid grid-cols-1 rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 sm:grid-cols-3'
											: 'flex flex-col'
									}`}
								>
									{STEPS.map(({ key: step, mark, badge: stepBadge }) => (
										<div
											key={step}
											className={hero ? '' : 'rounded-xl border border-slate-800/80 bg-slate-900/70 p-3.5'}
										>
											<p
												className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold ${stepBadge}`}
											>
												<span aria-hidden>{mark}</span>
												{t(`labels.${step}`)}
											</p>
											<p className="mt-2 text-[13px] leading-relaxed text-slate-300">
												{t(`items.${key}.${step}`)}
											</p>
										</div>
									))}
								</div>
							</article>
						</li>
					))}
				</ul>

				<div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/80 p-4 sm:flex-row">
					<p className="text-center text-xs leading-relaxed text-slate-300 sm:text-left sm:text-sm">
						{t.rich('trust', {
							strong: (chunks) => <strong className="font-semibold text-white">{chunks}</strong>,
						})}
					</p>
					<button
						type="button"
						onClick={scrollToAuditForm}
						className="shrink-0 text-xs font-semibold text-cyan-400 transition-colors hover:text-cyan-300 sm:text-sm"
					>
						{t('cta')}
					</button>
				</div>
			</div>
		</section>
	);
}
