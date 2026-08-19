'use client';

import { useTranslations } from 'next-intl';
import { UrlAuditForm } from '@/components/landing/UrlAuditForm';

/** Final conversion banner with a second URL form. */
export function ClosingCta() {
	const t = useTranslations('landing.closing');

	return (
		<section aria-labelledby="final-cta-title" className="mt-16">
			<div className="mx-auto w-full max-w-[960px]">
				<div className="relative overflow-hidden rounded-3xl border-2 border-cyan-500/30 bg-gradient-to-b from-slate-900 via-slate-900 to-cyan-950/40 p-8 text-center shadow-[0_0_50px_rgba(6,182,212,0.12)] sm:p-10">
					<p className="font-mono text-xs font-semibold tracking-widest text-cyan-300">{t('badge')}</p>
					<h2 id="final-cta-title" className="mt-3">
						<span className="block text-lg font-medium text-slate-300 sm:text-xl">{t('title')}</span>
						<span className="mt-1 block text-2xl font-black leading-snug text-white sm:text-4xl">
							{t('titleLine2')}
						</span>
					</h2>
					<p className="mx-auto mt-3 max-w-[540px] break-keep text-xs leading-relaxed text-slate-400 sm:text-sm">
						{t('subtitle')}
					</p>
					<UrlAuditForm
						variant="final"
						buttonLabel={t('button')}
						placeholder={t('placeholder')}
						inputId="closing-audit-url"
					/>
					<p className="mt-4 text-[11px] text-slate-500">{t('note')}</p>
					<p className="mx-auto mt-2 max-w-[620px] break-keep text-[10px] leading-relaxed text-slate-600 sm:text-[11px]">
						{t('disclaimer')}
					</p>
				</div>
			</div>
		</section>
	);
}
