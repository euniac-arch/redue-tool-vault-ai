'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AUDIT_PARSER_STEPS } from '@/lib/audit/parser-steps';
import type { AuditScanProgressPayload } from '@/lib/audit/scan-stream-client';

const TOTAL_STEPS = AUDIT_PARSER_STEPS.length;
/** Steps 1–5 (DOM/온페이지/GEO/SoV) animate through instantly — no real gate. */
const FAST_STEPS_COUNT = TOTAL_STEPS - 1;
/** Gauge % for 0..5 fast steps completed — index 0 is the starting 0%. */
const FAST_STEP_TARGET_PCT = [0, 12, 24, 36, 48, 60];
/** Pace for the fast steps while nothing is gating them. */
const FAST_STEP_INTERVAL_MS = 260;
/** Pace for the fast steps if the real API already resolved before we got here. */
const CATCHUP_STEP_INTERVAL_MS = 90;
/**
 * Single settle point for the final row — the gauge eases here once (one-directional,
 * never oscillates) and then holds perfectly still for the (usually brief) moment Track
 * 1/2's own HTML crawl is still finishing. A shimmer sweep across the filled bar (see
 * `.audit-loading-shimmer` in globals.css) communicates "still computing" instead of
 * moving the number.
 */
const WAIT_SETTLE_PCT = 90;
/** Hard ceiling — the gauge may NEVER cross this until `isDataReady` is true. */
const WAIT_PCT_CAP = 95;
/**
 * Brief beat before flipping the final row → 100% once real data lands (feels
 * intentional, not instant-cut) + a short hold at 100% so the checkmark is visible
 * before the reveal. Kept to a 150–300ms *total* transition budget — this is purely
 * a perceptual polish delay now that `isDataReady` itself resolves promptly (the
 * `/api/audit/scan` response no longer waits on background history/DB writes), so
 * it must never grow into a multi-second "Dashboard Ready" stall again.
 */
const DATA_READY_SETTLE_MS = 100;
/** Hold 100% so the user can see completion before reveal. */
const COMPLETE_HOLD_MS = 150;

interface AuditLoadingProps {
	url: string;
	/**
	 * True once the real `/api/audit/scan` response (Track 1 + 2 only — Track 3
	 * PageSpeed is fired in the background and never gates this modal) has actually
	 * resolved. The gauge is NEVER allowed to reach 100% before this flips true.
	 */
	isDataReady?: boolean;
	/** Fires after the final row completes (+ short hold). */
	onComplete?: () => void;
	/** Force-refresh re-audit copy ("🔄 실시간 재진단 중..."). */
	forceRefresh?: boolean;
	/**
	 * Live per-phase/per-page status streamed from `/api/audit/scan` (NDJSON progress
	 * events — see `consumeAuditScanResponse`). Once the cosmetic fast steps finish but
	 * `isDataReady` hasn't landed yet, a menu-heavy site's real full-audit crawl can take
	 * tens of seconds — surfacing this keeps the wait from looking frozen instead of
	 * sitting on a fixed placeholder. `null`/absent falls back to the original shimmer.
	 */
	liveProgress?: AuditScanProgressPayload | null;
}

/**
 * Step runner for the precision-scan terminal.
 *
 * Covers only Track 1/2 (DOM/온페이지/GEO/SoV), which resolve from a single HTML crawl in
 * a couple of seconds — so this modal typically completes in ~2-3s. Track 3
 * (PageSpeed/Lighthouse) is deliberately absent here; it renders progressively on the
 * result dashboard instead (see `Tab3CoreWebVitalsSection`). All steps are cosmetic and
 * fast-forward on their own timer; the only real gate is `isDataReady`, which the gauge
 * waits on (holding at a fixed point, never oscillating) if the actual crawl happens to
 * outlast the animation.
 */
export function AuditLoading({
	url,
	isDataReady = false,
	onComplete,
	forceRefresh = false,
	liveProgress = null,
}: AuditLoadingProps) {
	const t = useTranslations('audit');
	const locale = useLocale();
	const steps = AUDIT_PARSER_STEPS;

	/** How many of the fast steps have fully completed. */
	const [fastStepsDone, setFastStepsDone] = useState(0);
	/** True once real data landed AND the settle beat has passed — triggers 100%. */
	const [finished, setFinished] = useState(false);
	/** Elapsed time (ms) since this scan session started — drives the header timer badge. */
	const [elapsedMs, setElapsedMs] = useState(0);

	const completedRef = useRef(false);
	const onCompleteRef = useRef(onComplete);
	onCompleteRef.current = onComplete;
	const startTimeRef = useRef(Date.now());

	// Reset runner when URL changes (new scan session).
	useEffect(() => {
		setFastStepsDone(0);
		setFinished(false);
		completedRef.current = false;
		startTimeRef.current = Date.now();
		setElapsedMs(0);
	}, [url]);

	// Elapsed timer: ticks every 100ms so the seconds counter reads smoothly,
	// stops the instant the scan finishes (or this component unmounts) so it
	// never keeps a stray interval alive.
	useEffect(() => {
		if (finished) return;
		const interval = window.setInterval(() => {
			setElapsedMs(Date.now() - startTimeRef.current);
		}, 100);
		return () => window.clearInterval(interval);
	}, [finished, url]);

	// Fast steps: always advance to completion regardless of API state. If the
	// real response already landed early, catch up faster instead of jumping —
	// the terminal-typing feel is intentional, it just never blocks on it.
	useEffect(() => {
		if (fastStepsDone >= FAST_STEPS_COUNT) return;
		const interval = isDataReady ? CATCHUP_STEP_INTERVAL_MS : FAST_STEP_INTERVAL_MS;
		const timer = window.setTimeout(() => {
			setFastStepsDone((prev) => Math.min(prev + 1, FAST_STEPS_COUNT));
		}, interval);
		return () => window.clearTimeout(timer);
	}, [fastStepsDone, isDataReady]);

	// The only path to 100%: real data must have landed AND the fast steps must
	// have finished animating. This can never fire from the timer alone.
	useEffect(() => {
		if (fastStepsDone < FAST_STEPS_COUNT || !isDataReady || finished) return;
		const timer = window.setTimeout(() => setFinished(true), DATA_READY_SETTLE_MS);
		return () => window.clearTimeout(timer);
	}, [fastStepsDone, isDataReady, finished]);

	// Reveal only after the final row completes (`finished`) + short hold.
	useEffect(() => {
		if (!finished || completedRef.current) return;
		const timer = window.setTimeout(() => {
			if (completedRef.current) return;
			completedRef.current = true;
			onCompleteRef.current?.();
		}, COMPLETE_HOLD_MS);
		return () => window.clearTimeout(timer);
	}, [finished]);

	/** True the instant fast steps are done but Track 1/2's real crawl hasn't landed yet. */
	const isWaitingOnData = !finished && fastStepsDone >= FAST_STEPS_COUNT;

	/** Rows counted as fully done (checkmarked). */
	const completedRowCount = finished ? TOTAL_STEPS : fastStepsDone;
	/** Row currently pulsing — null once fully finished. */
	const activeIndex = finished ? null : isWaitingOnData ? FAST_STEPS_COUNT : fastStepsDone;

	// Gauge width: 0–60% while the fast steps animate, then either eases to a fixed 90%
	// (no real progress data yet — the common, few-second case) or tracks the real
	// full-audit crawl percent once `liveProgress` starts arriving (a menu-heavy site's
	// crawl can run long enough to actually move this instead of sitting still) — never
	// allowed to regress below where the fast steps left off. 100% only once `finished`.
	// The `Math.min(..., WAIT_PCT_CAP)` is a hard safety net — even if a future edit
	// changes the branches above, the gauge still cannot cross 95% before `finished`.
	const liveWaitPct = liveProgress
		? Math.max(FAST_STEP_TARGET_PCT[FAST_STEPS_COUNT] ?? WAIT_SETTLE_PCT, liveProgress.percent)
		: WAIT_SETTLE_PCT;
	const progressPct = finished
		? 100
		: fastStepsDone < FAST_STEPS_COUNT
			? FAST_STEP_TARGET_PCT[fastStepsDone] ?? 0
			: Math.min(liveWaitPct, WAIT_PCT_CAP);

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
					<div className="flex items-center justify-between gap-3">
						<p className="text-base font-bold text-slate-900 dark:text-white sm:text-lg">
							{forceRefresh ? t('loadingRescanTitle') : t('loadingTitle')}
						</p>
						<span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-mono text-slate-500 dark:border-slate-700/50 dark:bg-slate-800/60 dark:text-slate-400">
							<span aria-hidden>⏱️</span>
							<span className="tabular-nums">
								{(elapsedMs / 1000).toFixed(1)}
								{locale === 'en' ? 's' : '초'}
							</span>
						</span>
					</div>
					<p className="truncate font-mono text-xs text-cyan-400/90">{url || '—'}</p>
				</div>

				<div className="space-y-2 font-mono text-[12px] leading-relaxed sm:text-[13px]">
					{steps.map((step, index) => {
						const done = index < completedRowCount;
						const active = index === activeIndex;
						const isCompleteRow = done;
						const descText = locale === 'en' ? step.descEn : step.desc;
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
									{descText}
								</span>
								{active && <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse bg-accent-light" />}
							</div>
						);
					})}
				</div>

				{isWaitingOnData && liveProgress ? (
					<p
						role="status"
						className="mt-3 flex items-center gap-1.5 truncate font-mono text-[11px] text-emerald-700 dark:text-emerald-400"
					>
						<span aria-hidden className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500" />
						<span className="truncate">{liveProgress.message}</span>
						{liveProgress.pagesFound > 0 ? (
							<span className="shrink-0 tabular-nums text-emerald-700/70 dark:text-emerald-400/70">
								({liveProgress.pagesParsed}/{liveProgress.pagesFound})
							</span>
						) : null}
					</p>
				) : null}

				<div className="mt-6">
					<div className="mb-1.5 flex justify-between text-[10px] uppercase tracking-wider text-slate-500">
						<span>{t('loadingProgress')}</span>
						<span className="tabular-nums">
							{completedRowCount}/{TOTAL_STEPS} · {Math.round(progressPct)}%
						</span>
					</div>
					<div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.06]">
						<div
							className={`relative h-full overflow-hidden rounded-full ease-out ${
								isWaitingOnData
									? 'bg-gradient-to-r from-emerald-500/80 via-teal-300 to-emerald-500/80 transition-[width] duration-700'
									: 'bg-gradient-to-r from-accent to-cyan-400 transition-[width] duration-300'
							}`}
							style={{ width: `${progressPct}%` }}
						>
							{isWaitingOnData ? (
								<span
									aria-hidden
									className="audit-loading-shimmer absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/50"
								/>
							) : null}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
