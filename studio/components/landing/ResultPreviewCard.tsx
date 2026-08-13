'use client';

import { useTranslations } from 'next-intl';

/** Sample dual-score report card that previews the real audit result. */
export function ResultPreviewCard() {
	const t = useTranslations('landing.preview');

	return (
		<section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] via-[#0B1220] to-indigo-950/40 p-5 sm:p-7">
			<p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-300/80">
				{t('label')}
			</p>

			<div className="mt-5 grid gap-3 sm:grid-cols-2">
				<article className="rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/10 px-4 py-4">
					<p className="text-xs font-semibold text-fuchsia-200/90">🌐 {t('aiTrustLabel')}</p>
					<p className="mt-2 text-3xl font-black tracking-tight text-white">{t('aiTrustScore')}</p>
					<span className="mt-2 inline-flex rounded-full bg-fuchsia-500/20 px-2.5 py-0.5 text-xs font-bold text-fuchsia-200 ring-1 ring-fuchsia-400/40">
						{t('aiTrustGrade')}
					</span>
				</article>
				<article className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-4">
					<p className="text-xs font-semibold text-amber-200/90">⚙️ {t('techScoreLabel')}</p>
					<p className="mt-2 text-3xl font-black tracking-tight text-white">{t('techScoreValue')}</p>
					<span className="mt-2 inline-flex rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-100 ring-1 ring-amber-400/40">
						{t('techScoreGrade')}
					</span>
				</article>
			</div>

			<p className="mt-4 rounded-xl border border-white/[0.08] bg-black/30 px-4 py-3 text-center text-sm font-semibold leading-relaxed text-slate-200">
				{t('summary')}
			</p>
		</section>
	);
}
