'use client';

import { useTranslations } from 'next-intl';

interface GEOGuideHighlightCardProps {
	onOpen: () => void;
}

/**
 * Independent GEO guidebook banner placed directly under the hero URL form.
 * Opens the white-paper modal without competing with the diagnose CTA.
 */
export function GEOGuideHighlightCard({ onOpen }: GEOGuideHighlightCardProps) {
	const t = useTranslations('landing.guideHighlight');

	return (
		<section
			aria-labelledby="geo-guide-highlight-title"
			className="rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50 via-white to-violet-50 px-5 py-5 dark:border-indigo-400/20 dark:from-indigo-950/50 dark:via-[#0B1220] dark:to-violet-950/30 sm:px-6 sm:py-5"
		>
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
				<div className="min-w-0 flex-1 text-left">
					<h2
						id="geo-guide-highlight-title"
						className="break-keep text-base font-extrabold leading-snug tracking-tight text-slate-900 dark:text-white sm:text-lg"
					>
						{t('title')}
					</h2>
					<p className="mt-1.5 break-keep text-sm leading-relaxed text-slate-600 dark:text-slate-400">
						{t('subtitle')}
					</p>
				</div>
				<button
					type="button"
					onClick={onOpen}
					className="inline-flex w-full shrink-0 items-center justify-center whitespace-nowrap rounded-xl border-2 border-accent bg-transparent px-5 py-3 text-sm font-bold text-indigo-700 transition hover:bg-accent hover:text-white dark:text-accent-light md:w-auto"
				>
					{t('button')}
				</button>
			</div>
		</section>
	);
}
