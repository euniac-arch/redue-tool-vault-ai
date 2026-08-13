'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

const PROGRESS_STEPS = ['step1', 'step2', 'step3'] as const;
const STEP_INTERVAL_MS = 3000;

/**
 * Skeleton for stages 1–3 while Google Core Web Vitals / PageSpeed Insights is measuring.
 * Covers: 4 category rings → CWV cards → resources & solution guide.
 */
export function PageSpeedSkeleton() {
	const t = useTranslations('audit.pageSpeed');
	const [stepIndex, setStepIndex] = useState(0);
	const [messageKey, setMessageKey] = useState(0);

	useEffect(() => {
		const id = window.setInterval(() => {
			setStepIndex((prev) => {
				const next = (prev + 1) % PROGRESS_STEPS.length;
				setMessageKey((k) => k + 1);
				return next;
			});
		}, STEP_INTERVAL_MS);
		return () => window.clearInterval(id);
	}, []);

	const stepKey = PROGRESS_STEPS[stepIndex];
	const progressPct = ((stepIndex + 1) / PROGRESS_STEPS.length) * 100;

	return (
		<div
			className="flex flex-col gap-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5"
			aria-busy="true"
			aria-live="polite"
			role="status"
		>
			{/* Live progress header */}
			<div className="flex flex-col gap-3">
				<div className="flex items-start gap-3">
					<span className="relative mt-1.5 flex h-2.5 w-2.5 shrink-0">
						<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
						<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
					</span>
					<div className="min-w-0 flex-1">
						<p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-300/70">
							{t('measuring')}
							<span className="ml-2 tabular-nums text-emerald-400/80">
								{t('progressStepLabel', { current: stepIndex + 1, total: PROGRESS_STEPS.length })}
							</span>
						</p>
						<p
							key={messageKey}
							className="psi-progress-msg mt-1.5 text-sm font-semibold leading-snug text-emerald-100/95"
						>
							{t(`progressSteps.${stepKey}`)}
						</p>
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-1.5" aria-hidden>
						{PROGRESS_STEPS.map((_, i) => (
							<span
								key={i}
								className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
									i <= stepIndex ? 'bg-emerald-400/80' : 'bg-white/[0.08]'
								}`}
							/>
						))}
					</div>
					<div className="h-1 w-full overflow-hidden rounded-full bg-black/40">
						<div
							className="h-full rounded-full bg-gradient-to-r from-emerald-500/70 to-emerald-300/90 transition-[width] duration-700 ease-out"
							style={{ width: `${progressPct}%` }}
						/>
					</div>
				</div>
			</div>

			{/* Stage 1 — 4 category score rings */}
			<div>
				<div className="mb-2 h-3 w-40 animate-pulse rounded bg-white/10" />
				<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
					{[0, 1, 2, 3].map((i) => (
						<div
							key={i}
							className="flex h-[148px] flex-col items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.04] p-3.5"
							style={{ animationDelay: `${i * 80}ms` }}
						>
							<div className="h-2.5 w-16 animate-pulse rounded bg-white/10" />
							<div className="h-[72px] w-[72px] animate-pulse rounded-full border-4 border-white/[0.08]" />
							<div className="h-2.5 w-12 animate-pulse rounded bg-white/10" />
						</div>
					))}
				</div>
			</div>

			{/* Stage 2 — Core Web Vitals (LCP / FCP / TBT / CLS) */}
			<div>
				<div className="mb-2 h-3 w-28 animate-pulse rounded bg-white/10" />
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{[0, 1, 2, 3].map((i) => (
						<div
							key={i}
							className="h-24 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.04]"
							style={{ animationDelay: `${120 + i * 80}ms` }}
						/>
					))}
				</div>
			</div>

			{/* Stage 3 — resources + solution guide */}
			<div className="flex flex-col gap-3">
				<div className="h-3 w-52 animate-pulse rounded bg-white/10" />
				<div className="h-28 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.04]" />
				<div className="h-28 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.04]" />
				<div className="h-36 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.04]" />
			</div>

			<p className="text-center text-[11px] text-slate-500">{t('measuringHint')}</p>
		</div>
	);
}
