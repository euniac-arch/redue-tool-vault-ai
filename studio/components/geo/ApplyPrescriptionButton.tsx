'use client';

import { CheckCircle2, Loader2, RefreshCw, Rocket } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';

export interface ApplyPrescriptionButtonProps {
	isApplied: boolean;
	isLoading: boolean;
	onApply: () => void;
	onReapply: () => void;
}

export function ApplyPrescriptionButton({
	isApplied,
	isLoading,
	onApply,
	onReapply,
}: ApplyPrescriptionButtonProps) {
	const t = useTranslations('audit.geoDiagnosticTab');
	const reduceMotion = useReducedMotion();

	if (isLoading) {
		return (
			<button
				type="button"
				disabled
				aria-busy="true"
				className="print:hidden inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-indigo-500/35 disabled:cursor-wait disabled:opacity-90"
			>
				<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
				{t('applying')}
			</button>
		);
	}

	if (isApplied) {
		return (
			<div className="print:hidden flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
				<p
					role="status"
					className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-extrabold text-emerald-800 ring-1 ring-emerald-400/50 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/35"
				>
					<CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
					<span className="whitespace-nowrap">{t('appliedButton')}</span>
				</p>
				<button
					type="button"
					onClick={onReapply}
					aria-label={t('reapplyAria')}
					className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-200"
				>
					<RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
					<span>{t('reapplyButton')}</span>
				</button>
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={onApply}
			className={`print:hidden relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-indigo-500/40 transition hover:from-indigo-500 hover:via-blue-500 hover:to-cyan-400 ${
				reduceMotion ? '' : 'geo-apply-pulse'
			}`}
		>
			<span
				className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent geo-apply-sheen"
				aria-hidden
			/>
			<Rocket className="relative h-4 w-4 shrink-0" aria-hidden />
			<span className="relative whitespace-nowrap">{t('applyPrescription')}</span>
		</button>
	);
}
