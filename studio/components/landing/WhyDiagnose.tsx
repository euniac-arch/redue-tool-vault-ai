'use client';

import { useTranslations } from 'next-intl';

/** Short WHY DIAGNOSE block between the hero URL form and outcome cards. */
export function WhyDiagnose() {
	const t = useTranslations('landing.whyDiagnose');

	return (
		<section className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-indigo-950/40 via-white/[0.03] to-transparent px-5 py-7 text-center sm:px-8 sm:py-8">
			<h2 className="text-lg font-extrabold tracking-tight text-white sm:text-xl md:text-2xl">
				{t('title')}
			</h2>
			<p className="mx-auto mt-3 max-w-3xl break-keep text-sm leading-relaxed text-slate-400 sm:text-[15px]">
				{t('body')}
			</p>
			<p className="mt-5 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-xs font-bold text-accent-light sm:text-sm">
				<span>{t('from')}</span>
				<span aria-hidden className="text-accent-light/80">
					➔
				</span>
				<span>{t('to')}</span>
			</p>
		</section>
	);
}
