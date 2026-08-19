'use client';

interface PageListLoaderProps {
	label: string;
}

export function PageListLoader({ label }: PageListLoaderProps) {
	return (
		<div
			role="status"
			aria-live="polite"
			aria-busy="true"
			className="flex min-h-[22rem] flex-col items-center justify-center px-4 py-12"
		>
			<div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-slate-200 bg-white px-6 py-10 shadow-sm dark:border-slate-800/80 dark:bg-[#0B1120]/80 dark:shadow-[0_8px_30px_rgba(6,182,212,0.06)] sm:px-8">
				<div className="relative h-12 w-12" aria-hidden>
					<span className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-800" />
					<span className="audit-result-spinner absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-500 border-r-blue-500" />
				</div>
				<div className="flex flex-col items-center gap-2 text-center">
					<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-400">
						REDUE AI
					</p>
					<p className="text-sm font-semibold leading-relaxed text-slate-700 dark:text-slate-200">
						{label}
					</p>
				</div>
				<div
					className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
					role="progressbar"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-label={label}
				>
					<div className="audit-result-loader-bar h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-400" />
				</div>
			</div>
		</div>
	);
}
