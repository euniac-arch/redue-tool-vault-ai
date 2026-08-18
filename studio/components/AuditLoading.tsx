'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AUDIT_PARSER_STEPS } from '@/lib/audit/parser-steps';

const TOTAL_STEPS = AUDIT_PARSER_STEPS.length;
/** Pace while waiting on the network / parser. */
const SLOW_INTERVAL_MS = 450;
/** Pace once backend payload is ready — fast-forward remaining checks. */
const FAST_INTERVAL_MS = 180;
/** Hold 6/6 + full bar so the user can see completion before reveal. */
const COMPLETE_HOLD_MS = 300;

interface AuditLoadingProps {
	url: string;
	/** True when the audit API / cache payload is already available. */
	isDataReady?: boolean;
	/** Fires after 6/6 UI completion (+ short hold). */
	onComplete?: () => void;
	/** Force-refresh re-audit copy ("🔄 실시간 재진단 중..."). */
	forceRefresh?: boolean;
}

/**
 * Step runner for the precision-scan terminal.
 * Backend readiness and UI step progress are independent — the UI always
 * walks 1/6 → 6/6 before calling onComplete (fast-forward if data is ready).
 */
export function AuditLoading({
	url,
	isDataReady = false,
	onComplete,
	forceRefresh = false,
}: AuditLoadingProps) {
	const t = useTranslations('audit');
	const locale = useLocale();
	const steps = AUDIT_PARSER_STEPS;
	/** Number of checks fully activated (0–6). */
	const [completedSteps, setCompletedSteps] = useState(0);
	const completedRef = useRef(false);
	const onCompleteRef = useRef(onComplete);
	onCompleteRef.current = onComplete;

	// Reset runner when URL changes (new scan session).
	useEffect(() => {
		setCompletedSteps(0);
		completedRef.current = false;
	}, [url]);

	// Sequential step timer — slow until data ready, then fast-forward.
	useEffect(() => {
		if (completedSteps >= TOTAL_STEPS) return;

		const interval = isDataReady ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS;
		const timer = window.setTimeout(() => {
			setCompletedSteps((prev) => Math.min(prev + 1, TOTAL_STEPS));
		}, interval);

		return () => window.clearTimeout(timer);
	}, [completedSteps, isDataReady]);

	// Reveal only after 6/6 + data ready + short hold.
	useEffect(() => {
		if (completedSteps < TOTAL_STEPS || !isDataReady || completedRef.current) return;

		const timer = window.setTimeout(() => {
			if (completedRef.current) return;
			completedRef.current = true;
			onCompleteRef.current?.();
		}, COMPLETE_HOLD_MS);

		return () => window.clearTimeout(timer);
	}, [completedSteps, isDataReady]);

	const progressPct = (completedSteps / TOTAL_STEPS) * 100;
	const activeIndex = completedSteps >= TOTAL_STEPS ? TOTAL_STEPS - 1 : completedSteps;

	return (
		<div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#07090d] shadow-2xl shadow-slate-200/60 dark:shadow-black/40">
			<div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03] px-4 py-2.5">
				<span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
				<span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
				<span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
				<span className="ml-2 font-mono text-[11px] text-slate-500">{t('loadingTerminalTitle')}</span>
			</div>

			<div className="px-5 py-6 sm:px-7">
				<div className="mb-5 flex flex-col gap-1">
					<p className="text-base font-bold text-slate-900 dark:text-white sm:text-lg">
						{forceRefresh ? t('loadingRescanTitle') : t('loadingTitle')}
					</p>
					<p className="truncate font-mono text-xs text-cyan-400/90">{url || '—'}</p>
				</div>

				<div className="space-y-2 font-mono text-[12px] leading-relaxed sm:text-[13px]">
					{steps.map((step, index) => {
						const done = index < completedSteps;
						const active = index === activeIndex && completedSteps < TOTAL_STEPS;
						const allDone = completedSteps >= TOTAL_STEPS && index < TOTAL_STEPS;
						const isCompleteRow = done || (allDone && index === TOTAL_STEPS - 1);
						return (
							<div
								key={step.tag}
								className={`flex flex-nowrap items-center gap-2 rounded-lg px-2 py-1.5 transition-all duration-200 ${
									active
										? 'bg-accent/10 ring-1 ring-accent/30'
										: isCompleteRow
											? 'opacity-90'
											: 'opacity-35'
								}`}
							>
								<span
									className={`shrink-0 tabular-nums ${
										isCompleteRow && !active
											? 'text-emerald-700 dark:text-emerald-400'
											: active
												? 'text-accent-light'
												: 'text-slate-600'
									}`}
								>
									{isCompleteRow && !active ? '✔' : active ? '▸' : '·'}
								</span>
								<span
									className={`shrink-0 font-bold ${
										active ? 'text-cyan-800 dark:text-cyan-300' : isCompleteRow ? 'text-slate-600 dark:text-slate-400' : 'text-slate-600'
									}`}
								>
									[{step.tag}]
								</span>
								<span
									className={`min-w-0 truncate ${
										active ? 'text-slate-900 dark:text-slate-100' : isCompleteRow ? 'text-slate-600 dark:text-slate-400' : 'text-slate-600'
									}`}
								>
									{locale === 'en' ? step.descEn : step.desc}
								</span>
								{active && <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse bg-accent-light" />}
							</div>
						);
					})}
				</div>

				<div className="mt-6">
					<div className="mb-1.5 flex justify-between text-[10px] uppercase tracking-wider text-slate-500">
						<span>{t('loadingProgress')}</span>
						<span className="tabular-nums">
							{completedSteps}/{TOTAL_STEPS}
						</span>
					</div>
					<div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.06]">
						<div
							className="h-full rounded-full bg-gradient-to-r from-accent to-cyan-400 transition-all duration-300 ease-out"
							style={{ width: `${progressPct}%` }}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
