'use client';

interface PdfDownloadSpinnerProps {
	label: string;
	hint?: string;
	currentPage?: number;
	totalPages?: number;
	progressLabel?: string;
}

/** Overlay shown while each A4 sheet is captured into the PDF. */
export function PdfDownloadSpinner({
	label,
	hint,
	currentPage = 0,
	totalPages = 0,
	progressLabel,
}: PdfDownloadSpinnerProps) {
	const hasPages = totalPages > 0;
	const pct = hasPages ? Math.round((Math.min(currentPage, totalPages) / totalPages) * 100) : 0;

	return (
		<div
			className="pdf-preview-chrome pdf-download-spinner fixed inset-0 z-30 flex items-center justify-center bg-slate-950/55 backdrop-blur-sm"
			role="status"
			aria-live="polite"
			aria-busy="true"
		>
			<div className="flex w-[min(22rem,calc(100vw-2rem))] flex-col items-center gap-3 rounded-2xl border border-white/15 bg-slate-900/90 px-8 py-7 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
				<span
					className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-300/25 border-t-cyan-400"
					aria-hidden
				/>
				<p className="text-sm font-semibold text-white">{label}</p>
				{hasPages ? (
					<>
						<p className="font-mono text-lg font-extrabold tabular-nums text-white">
							{progressLabel ?? `${currentPage} / ${totalPages}`}
						</p>
						<div
							className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
							role="progressbar"
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={pct}
							aria-label={progressLabel ?? `${currentPage} / ${totalPages}`}
						>
							<div
								className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-400 transition-[width] duration-150"
								style={{ width: `${Math.min(100, Math.max(pct, 2))}%` }}
							/>
						</div>
					</>
				) : null}
				{hint ? <p className="text-xs font-medium text-slate-400">{hint}</p> : null}
			</div>
		</div>
	);
}
