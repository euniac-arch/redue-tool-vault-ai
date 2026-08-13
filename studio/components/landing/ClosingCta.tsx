'use client';

import { useTranslations } from 'next-intl';
import { scrollToAuditForm } from '@/components/landing/scroll-to-audit';

/** Bottom conversion block that returns focus to the hero URL form. */
export function ClosingCta() {
	const t = useTranslations('landing.closing');

	return (
		<section className="flex flex-col items-center rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/15 via-[#0B1220] to-indigo-950/40 px-5 py-10 text-center sm:px-8 sm:py-12">
			<h2 className="max-w-2xl text-xl font-extrabold leading-snug tracking-tight text-white sm:text-2xl">
				{t('title')}
			</h2>
			<button
				type="button"
				onClick={scrollToAuditForm}
				className="mt-6 rounded-xl bg-accent px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-accent/35 transition hover:bg-accent-light"
			>
				{t('button')}
			</button>
		</section>
	);
}
