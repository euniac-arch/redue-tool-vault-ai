'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';

const HOLD_CAP = 95;
const TICK_MS = 50;
const COMPLETE_HOLD_MS = 80;
const FADE_MS = 120;

type LoaderStep = 'track1' | 'track2' | 'track3' | 'complete';

function stepFromProgress(progress: number): LoaderStep {
	if (progress >= 96) return 'complete';
	if (progress >= 71) return 'track3';
	if (progress >= 36) return 'track2';
	return 'track1';
}

const SHEETS = [
	{
		id: 'track1' as const,
		appearAt: 4,
		accent: 'from-cyan-200 via-white to-slate-50',
		rule: 'bg-cyan-400',
		labelClass: 'text-cyan-700',
		folded: { y: 72, rotateZ: -14, rotateX: 18, opacity: 0, z: -40 },
		stacked: { y: 18, rotateZ: -8, rotateX: 8, opacity: 1, z: 0 },
	},
	{
		id: 'track2' as const,
		appearAt: 36,
		accent: 'from-violet-200 via-white to-slate-50',
		rule: 'bg-violet-400',
		labelClass: 'text-violet-700',
		folded: { y: 86, rotateZ: 12, rotateX: 20, opacity: 0, z: -50 },
		stacked: { y: 2, rotateZ: 1, rotateX: 4, opacity: 1, z: 24 },
	},
	{
		id: 'track3' as const,
		appearAt: 71,
		accent: 'from-emerald-200 via-white to-slate-50',
		rule: 'bg-emerald-400',
		labelClass: 'text-emerald-700',
		folded: { y: 96, rotateZ: -10, rotateX: 22, opacity: 0, z: -60 },
		stacked: { y: -16, rotateZ: 7, rotateX: 0, opacity: 1, z: 48 },
	},
] as const;

export interface PdfGeneratingLoaderProps {
	/** True only after the real A4 page-build / async fetch has finished. */
	isReady: boolean;
	/** Fires after 100% holds for 0.4s and the overlay has faded out. */
	onComplete?: () => void;
	className?: string;
}

/**
 * Interactive A4 compile loader — three mini sheets stack with a 3D tilt,
 * a scan beam loops over the top card, and the progress copy/bar stay in
 * lockstep with the real preview-build gate (`isReady`).
 */
export function PdfGeneratingLoader({ isReady, onComplete, className = '' }: PdfGeneratingLoaderProps) {
	const t = useTranslations('audit.pdfPreview.loader');
	const reduceMotion = useReducedMotion();
	const [progress, setProgress] = useState(0);
	const [fadingOut, setFadingOut] = useState(false);
	const completedRef = useRef(false);
	const onCompleteRef = useRef(onComplete);
	onCompleteRef.current = onComplete;

	useEffect(() => {
		const id = window.setInterval(() => {
			setProgress((prev) => {
				const cap = isReady ? 100 : HOLD_CAP;
				if (prev >= cap) return cap;
				if (isReady) {
					return 100;
				}
				const step = prev < 35 ? 2.4 : prev < 70 ? 1.8 : 1.1;
				return Math.min(HOLD_CAP, prev + step);
			});
		}, TICK_MS);
		return () => window.clearInterval(id);
	}, [isReady]);

	useEffect(() => {
		if (progress < 100 || fadingOut || completedRef.current) return;
		const hold = window.setTimeout(() => setFadingOut(true), COMPLETE_HOLD_MS);
		return () => window.clearTimeout(hold);
	}, [progress, fadingOut]);

	useEffect(() => {
		if (!fadingOut || completedRef.current) return;
		const fade = window.setTimeout(() => {
			if (completedRef.current) return;
			completedRef.current = true;
			onCompleteRef.current?.();
		}, reduceMotion ? 0 : FADE_MS);
		return () => window.clearTimeout(fade);
	}, [fadingOut, reduceMotion]);

	const rounded = Math.round(progress);
	const step = stepFromProgress(progress);
	const stackedCount = SHEETS.filter((sheet) => progress >= sheet.appearAt).length;
	const topSheetId = useMemo(() => {
		const visible = [...SHEETS].reverse().find((sheet) => progress >= sheet.appearAt);
		return visible?.id ?? 'track1';
	}, [progress]);

	return (
		<AnimatePresence>
			{!fadingOut ? (
				<motion.div
					key="pdf-generating-loader"
					role="status"
					aria-live="polite"
					aria-busy={rounded < 100}
					initial={reduceMotion ? false : { opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={reduceMotion ? undefined : { opacity: 0 }}
					transition={{ duration: FADE_MS / 1000, ease: 'easeOut' }}
					className={`pdf-generating-loader flex h-full w-full flex-col items-center justify-center bg-slate-950/55 px-6 text-center backdrop-blur-2xl ${className}`}
				>
					<div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-white/5 px-6 py-8 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:px-8">
						<p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-300/80">
							{t('kicker')}
						</p>
						<h2 className="mt-1.5 text-lg font-extrabold tracking-tight text-white sm:text-xl">
							{t('title')}
						</h2>
						<p className="mt-1 text-xs font-medium text-slate-400">{t('hint')}</p>

						<div
							className="pdf-loader-stack relative mx-auto mt-8 h-[168px] w-[168px]"
							style={{ perspective: '900px' }}
							aria-hidden
						>
							{SHEETS.map((sheet, index) => {
								const visible = progress >= sheet.appearAt;
								const pose = visible ? sheet.stacked : sheet.folded;
								return (
									<motion.article
										key={sheet.id}
										className={`pdf-loader-sheet absolute left-1/2 top-6 h-[124px] w-[88px] origin-bottom overflow-hidden rounded-[3px] bg-gradient-to-b ${sheet.accent} shadow-[0_10px_24px_rgba(15,23,42,0.35)]`}
										style={{ transformStyle: 'preserve-3d' }}
										initial={false}
										animate={
											reduceMotion
												? {
														x: '-50%',
														y: 18 - index * 16,
														rotateZ: 0,
														rotateX: 0,
														opacity: visible ? 1 : 0.35,
														zIndex: index + 1,
													}
												: {
														x: '-50%',
														y: pose.y,
														rotateZ: pose.rotateZ,
														rotateX: pose.rotateX,
														z: pose.z,
														opacity: pose.opacity,
														zIndex: index + 1,
													}
										}
										transition={{ type: 'spring', stiffness: 220, damping: 22, mass: 0.8 }}
									>
										<div className={`h-1.5 w-full rounded-t-[3px] ${sheet.rule}`} />
										<div className="px-2.5 pt-2">
											<p className={`text-[8px] font-extrabold tracking-wide ${sheet.labelClass}`}>
												{t('sheetLabel', { n: index + 1 })}
											</p>
											<div className="mt-2 space-y-1.5">
												<span className="block h-1 w-[78%] rounded-full bg-slate-300/80" />
												<span className="block h-1 w-full rounded-full bg-slate-200" />
												<span className="block h-1 w-[64%] rounded-full bg-slate-200" />
												<span className="block h-1 w-[86%] rounded-full bg-slate-200" />
												<span className="mt-2 block h-6 w-full rounded-sm bg-slate-100" />
											</div>
										</div>
										{topSheetId === sheet.id && visible ? (
											<span className="pdf-loader-scanner-beam" />
										) : null}
									</motion.article>
								);
							})}
						</div>

						<p
							key={step}
							className="mt-6 min-h-[2.5rem] text-sm font-semibold leading-relaxed text-slate-100 sm:text-[15px]"
						>
							{t(step)}
						</p>
						<p className="mt-1 text-[11px] font-medium text-slate-400">
							{t('stacked', { count: stackedCount })}
						</p>

						<div className="mt-5">
							<div className="mb-2 flex items-end justify-between gap-3">
								<span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
									{t('progressLabel')}
								</span>
								<span className="font-mono text-2xl font-extrabold tabular-nums text-white">
									{rounded}
									<span className="ml-0.5 text-sm font-bold text-slate-400">%</span>
								</span>
							</div>
							<div
								className="h-2 overflow-hidden rounded-full bg-white/10"
								role="progressbar"
								aria-valuemin={0}
								aria-valuemax={100}
								aria-valuenow={rounded}
								aria-label={t('progressLabel')}
							>
								<div
									className="pdf-loader-progress-bar h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-emerald-400"
									style={{ width: `${Math.min(100, Math.max(progress, 2))}%` }}
								/>
							</div>
						</div>
					</div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
