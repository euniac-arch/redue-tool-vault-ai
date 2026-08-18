'use client';

import { useTranslations } from 'next-intl';
import { scrollToAuditForm } from '@/components/landing/scroll-to-audit';
import { CHECKLIST_ITEM_COUNT } from '@/lib/audit/checklistDefinitions';

/** Simple final conversion banner — one CTA that focuses the hero URL input. */
export function ClosingCta() {
	const t = useTranslations('landing.closing');

	return (
		<section
			aria-labelledby="final-cta-title"
			className="relative overflow-hidden rounded-3xl border border-indigo-300/50 bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50 px-5 py-10 text-center shadow-[0_0_48px_-12px_rgba(99,102,241,0.28)] dark:border-indigo-500/30 dark:from-blue-900/30 dark:via-indigo-950/40 dark:to-indigo-900/30 dark:shadow-[0_0_64px_-8px_rgba(99,102,241,0.45)] sm:px-8 sm:py-14 lg:px-12"
		>
			<div
				aria-hidden
				className="pointer-events-none absolute -left-16 top-0 h-40 w-40 rounded-full bg-sky-400/20 blur-3xl dark:bg-sky-400/15"
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute -right-10 bottom-0 h-44 w-44 rounded-full bg-indigo-500/20 blur-3xl dark:bg-violet-500/20"
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/70 to-transparent dark:via-indigo-300/50"
			/>

			<div className="relative mx-auto flex max-w-3xl flex-col items-center">
				<h2
					id="final-cta-title"
					className="text-2xl font-bold leading-snug tracking-tight text-slate-900 dark:text-white"
				>
					{t('title')}
				</h2>
				<p className="mt-3 max-w-2xl break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-400">
					{t('subtitle', { count: CHECKLIST_ITEM_COUNT })}
				</p>

				<button
					type="button"
					onClick={scrollToAuditForm}
					className="mt-8 w-full max-w-xl rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 px-8 py-4 text-base font-bold text-white shadow-lg shadow-indigo-500/40 transition hover:brightness-110 hover:shadow-xl hover:shadow-indigo-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
				>
					{t('button')}
				</button>
			</div>
		</section>
	);
}
