'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export const PRESCRIPTION_LOADING_STEPS = [1, 2, 3] as const;

export interface ApplyPrescriptionProgressProps {
	visible: boolean;
	progress: number;
	currentStep: number;
	targetUrl: string;
	brandName: string;
}

export function ApplyPrescriptionProgress({
	visible,
	progress,
	currentStep,
	targetUrl,
	brandName,
}: ApplyPrescriptionProgressProps) {
	const t = useTranslations('audit.geoDiagnosticTab');
	const reduceMotion = useReducedMotion();
	const rounded = Math.round(progress);

	return (
		<AnimatePresence initial={false}>
			{visible ? (
				<motion.div
					key="prescription-steps"
					initial={reduceMotion ? false : { opacity: 0, height: 0, marginTop: 0 }}
					animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
					exit={reduceMotion ? undefined : { opacity: 0, height: 0, marginTop: 0 }}
					transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
					className="print:hidden w-full min-w-0 overflow-hidden"
					aria-live="polite"
				>
					<ol className="flex w-full flex-col gap-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50/70 px-3.5 py-3 dark:border-indigo-400/20 dark:bg-indigo-500/[0.08]">
						<li className="mb-1">
							<div className="mb-1.5 flex items-center justify-between gap-2">
								<p className="min-w-0 text-[11px] font-extrabold text-indigo-800 dark:text-indigo-200">
									{t('progressLabel')}
								</p>
								<span className="shrink-0 tabular-nums text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
									{rounded}%
								</span>
							</div>
							<div
								className="h-1.5 overflow-hidden rounded-full bg-indigo-100 dark:bg-white/10"
								role="progressbar"
								aria-valuemin={0}
								aria-valuemax={100}
								aria-valuenow={rounded}
								aria-label={t('progressLabel')}
							>
								<div
									className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-[width] duration-150"
									style={{ width: `${Math.max(8, Math.min(100, progress))}%` }}
								/>
							</div>
						</li>
						{PRESCRIPTION_LOADING_STEPS.map((step) => {
							const done = currentStep > step;
							const active = currentStep === step;
							return (
								<li key={step} className="flex items-start gap-2 text-[12px] font-semibold sm:items-center">
									{done ? (
										<CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 sm:mt-0" aria-hidden />
									) : active ? (
										<Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-indigo-600 dark:text-indigo-300 sm:mt-0" aria-hidden />
									) : (
										<span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300 dark:border-white/20 sm:mt-0" aria-hidden />
									)}
									<span
										className={
											active
												? 'min-w-0 animate-pulse text-indigo-800 dark:text-indigo-200'
												: done
													? 'min-w-0 text-emerald-800 dark:text-emerald-300'
													: 'min-w-0 text-slate-400'
										}
									>
										{t(`steps.${step}`, { url: targetUrl, brand: brandName })}
									</span>
								</li>
							);
						})}
					</ol>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
