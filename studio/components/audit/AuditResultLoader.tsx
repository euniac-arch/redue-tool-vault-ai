'use client';

import { useTranslations } from 'next-intl';

export type AuditResultLoaderVariant = 'hydrate' | 'compose';

interface AuditResultLoaderProps {
	/** hydrate = cached/DB reload · compose = report assembly after a live scan */
	variant?: AuditResultLoaderVariant;
	message?: string;
	className?: string;
}

/**
 * Centered result-page loader. Used whenever report data is not yet renderable
 * (Suspense, cache/DB fetch, dynamic document chunk) so the page never paints blank.
 */
export function AuditResultLoader({
	variant = 'hydrate',
	message,
	className = '',
}: AuditResultLoaderProps) {
	const t = useTranslations('audit');
	const label =
		message ??
		(variant === 'compose' ? t('resultComposeLoading') : t('resultHydrateLoading'));

	return (
		<div
			role="status"
			aria-live="polite"
			aria-busy="true"
			className={`print:hidden flex min-h-[28rem] flex-col items-center justify-center px-4 py-16 sm:min-h-[32rem] ${className}`}
		>
			<div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-slate-200 bg-white px-6 py-10 shadow-2xl shadow-slate-200/60 dark:border-white/[0.08] dark:bg-[#07090d] dark:shadow-black/40 sm:px-8">
				<div className="relative h-12 w-12" aria-hidden>
					<span className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-white/[0.08]" />
					<span className="audit-result-spinner absolute inset-0 rounded-full border-2 border-transparent border-t-accent border-r-cyan-400" />
				</div>

				<div className="flex flex-col items-center gap-2 text-center">
					<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent dark:text-accent-light">
						REDUE AI
					</p>
					<p className="text-sm font-semibold leading-relaxed text-slate-800 dark:text-slate-100 sm:text-[15px]">
						{label}
					</p>
				</div>

				<div
					className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.06]"
					role="progressbar"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-label={label}
				>
					<div className="audit-result-loader-bar h-full rounded-full bg-gradient-to-r from-accent via-cyan-400 to-accent" />
				</div>
			</div>
		</div>
	);
}
