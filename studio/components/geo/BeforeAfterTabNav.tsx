'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type PrescriptionViewMode = 'before' | 'after';

export interface BeforeAfterTabNavProps {
	value: PrescriptionViewMode;
	onChange: (mode: PrescriptionViewMode) => void;
	disabled?: boolean;
}

const TABS: readonly PrescriptionViewMode[] = ['before', 'after'];
const THUMB_EASE = { type: 'spring', stiffness: 420, damping: 34 } as const;

export function BeforeAfterTabNav({ value, onChange, disabled = false }: BeforeAfterTabNavProps) {
	const t = useTranslations('audit.geoDiagnosticTab');
	const reduceMotion = useReducedMotion();
	const afterActive = value === 'after';

	return (
		<div
			className={`flex flex-col gap-2.5 rounded-2xl border p-3 sm:px-4 sm:py-3 ${
				afterActive
					? 'border-emerald-200/90 bg-emerald-50/50 dark:border-emerald-400/25 dark:bg-emerald-500/[0.07]'
					: 'border-amber-200/90 bg-amber-50/50 dark:border-amber-400/25 dark:bg-amber-500/[0.07]'
			}`}
		>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div
					role="tablist"
					aria-label={t('compareAria')}
					className="relative isolate inline-grid w-full grid-cols-2 rounded-full bg-slate-900/[0.06] p-1 dark:bg-black/30 sm:w-auto sm:min-w-[22rem]"
				>
					{TABS.map((id) => {
						const active = value === id;
						const isAfter = id === 'after';
						return (
							<button
								key={id}
								type="button"
								role="tab"
								aria-selected={active}
								disabled={disabled}
								onClick={() => onChange(id)}
								className={`relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-extrabold transition disabled:cursor-wait disabled:opacity-60 ${
									active
										? isAfter
											? 'text-emerald-900 dark:text-emerald-50'
											: 'text-amber-950 dark:text-amber-50'
										: 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
								}`}
							>
								{active ? (
									<motion.span
										layoutId={reduceMotion ? undefined : 'geo-before-after-pill'}
										className={`absolute inset-0 -z-10 rounded-full shadow-md ${
											isAfter
												? 'bg-white ring-1 ring-emerald-300/80 dark:bg-emerald-400/20 dark:ring-emerald-300/40'
												: 'bg-white ring-1 ring-amber-300/80 dark:bg-amber-400/20 dark:ring-amber-300/40'
										}`}
										transition={reduceMotion ? { duration: 0 } : THUMB_EASE}
									/>
								) : null}
								{isAfter ? (
									<CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
								) : (
									<AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
								)}
								<span className="whitespace-nowrap">{isAfter ? t('afterToggle') : t('beforeToggle')}</span>
								<span
									className={`hidden rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide sm:inline ${
										active
											? isAfter
												? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/30 dark:text-emerald-100'
												: 'bg-amber-100 text-amber-800 dark:bg-amber-500/30 dark:text-amber-100'
											: 'bg-slate-200/80 text-slate-500 dark:bg-white/10 dark:text-slate-400'
									}`}
								>
									{isAfter ? t('afterBadge') : t('beforeBadge')}
								</span>
							</button>
						);
					})}
				</div>
				<p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{t('compareHintReady')}</p>
			</div>

			<AnimatePresence mode="wait" initial={false}>
				<motion.p
					key={value}
					initial={reduceMotion ? false : { opacity: 0, y: 4 }}
					animate={{ opacity: 1, y: 0 }}
					exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
					transition={{ duration: reduceMotion ? 0 : 0.18 }}
					className={`text-[11px] font-semibold leading-relaxed ${
						afterActive
							? 'text-emerald-800 dark:text-emerald-200'
							: 'text-amber-800 dark:text-amber-200'
					}`}
				>
					{afterActive ? t('afterTabHint') : t('beforeTabHint')}
				</motion.p>
			</AnimatePresence>
		</div>
	);
}
