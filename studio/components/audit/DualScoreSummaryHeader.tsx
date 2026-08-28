'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { Info, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CORE_SCORE_COLORS, CoreScoreBarChart } from '@/components/audit/CoreScoreBarChart';
import { ScoreGradeBadge } from '@/components/audit/ScoreGradeBadge';
import { QuickConversionCtaBar } from '@/components/audit/QuickConversionCtaBar';
import { PdfCoreScoreGauge } from '@/components/audit/print/PdfCoreScoreGauge';
import type { BusinessConversionModel } from '@/lib/audit/business-conversion';
import { gradeForHttps } from '@/lib/audit/score-grade';
import { useCountUp } from '@/lib/audit/use-count-up';
import type { MeasuredScoreBreakdown } from '@/lib/audit/scoreCalculator';

type ExposureTier = 'danger' | 'partial' | 'top';

interface DualScoreSummaryHeaderProps {
	measuredScore: number;
	measuredPercentile: number;
	geoScore: number;
	geoGrade?: string | null;
	geoPercentile: number;
	geoWeight: number;
	seoScore: number;
	seoWeight: number;
	cwvWeight: number;
	technicalPercentile: number;
	securityAlert?: string | null;
	isHttps?: boolean;
	securityCapped?: boolean;
	potentialGain: number;
	targetScore: number;
	exposureTier: ExposureTier;
	roiModel?: BusinessConversionModel | null;
	/** Track1/Track2/CWV blend detail — powers the "산출 내역 보기" breakdown popover. */
	scoreBreakdown?: MeasuredScoreBreakdown | null;
	/** True while the live PageSpeed(Lighthouse) read is still in flight for this audit. */
	cwvLoading?: boolean;
	/** True once a real PSI snapshot has landed — false while the CWV axis is an on-page fallback. */
	cwvMeasured?: boolean;
}

const EXPOSURE_TIER_ICONS: Record<ExposureTier, string> = {
	danger: '🔴',
	partial: '🟡',
	top: '🟢',
};

/** Presentational-only AEO/GEO status chip — derived from the already-computed `measuredScore`, no recalculation. */
type AeoGeoStatusTier = 'top' | 'mid' | 'low';

function aeoGeoStatusTier(score: number): AeoGeoStatusTier {
	if (score >= 80) return 'top';
	if (score >= 50) return 'mid';
	return 'low';
}

const AEO_GEO_STATUS_CLASS: Record<AeoGeoStatusTier, string> = {
	top: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
	mid: 'border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
	low: 'border-rose-400/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

/** While Track 3 is loading, only the overall/track3 bars/radar points pulse — Track1/2 stay solid. */
const PENDING_CWV_KEYS = ['overall', 'track3'] as const;

/** Whole numbers render bare (`37`); only a genuine fraction keeps one decimal (`34.5`). */
function formatTrackNumber(value: number): string {
	const rounded = Math.round(value * 10) / 10;
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Score hierarchy for the Executive Summary header.
 * All numbers come from `auditData.scores` — this component never recalculates.
 */
function DualScoreSummaryHeaderInner({
	measuredScore,
	measuredPercentile,
	geoScore,
	geoWeight,
	seoScore,
	seoWeight,
	cwvWeight,
	securityAlert,
	isHttps = true,
	securityCapped = false,
	potentialGain,
	targetScore,
	exposureTier,
	roiModel,
	scoreBreakdown,
	cwvLoading = false,
	cwvMeasured = true,
}: DualScoreSummaryHeaderProps) {
	const tDist = useTranslations('audit.scoreDistribution');
	const tExec = useTranslations('audit.b2b');

	const targetAchieved = potentialGain === 0;
	const grade = gradeForHttps(measuredScore, isHttps);

	const track1Score = scoreBreakdown?.track1 ?? 0;
	const track2Score = scoreBreakdown?.track2 ?? 0;
	const track3Score = scoreBreakdown?.coreWebVitals ?? 0;
	const weightTrack1 = scoreBreakdown?.weights?.track1 ?? 0.4;
	const weightTrack2 = scoreBreakdown?.weights?.track2 ?? 0.4;
	const weightTrack3 = scoreBreakdown?.weights?.coreWebVitals ?? 0.2;
	const t1Contrib = track1Score * weightTrack1;
	const t2Contrib = track2Score * weightTrack2;
	const cwvContrib = track3Score * weightTrack3;
	const hasSecurityPenalty = (scoreBreakdown?.securityPenalty ?? 0) > 0;
	// Counts up from the previous value the instant Track 3 lands and `cwvLoading` flips
	// false, instead of popping the final number in — skipped entirely while still loading.
	const animatedMeasuredScore = useCountUp(measuredScore);

	return (
		<section className="flex flex-col gap-4" aria-label={tDist('dualAriaLabel')}>
			{securityAlert && (
				<div
					role="alert"
					className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold leading-relaxed text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
				>
					{securityAlert}
				</div>
			)}
			{/* Box 1 · Score + axis cards + diagnosis / treatment.
			    z-20 + overflow-visible so the breakdown popover paints above the opportunity-cost card (sibling isolate z-10). */}
			<div className="relative z-20 overflow-visible rounded-2xl border border-[#C9A227]/35 bg-gradient-to-br from-[#C9A227]/[0.12] via-[#D4AF37]/[0.05] to-transparent p-5 sm:p-6">
				<div
					className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl opacity-40 print:hidden"
					style={{
						background:
							'radial-gradient(circle at 12% 20%, rgba(212,175,55,0.22), transparent 48%), radial-gradient(circle at 88% 0%, rgba(99,102,241,0.12), transparent 42%)',
					}}
				/>
				<div className="relative flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-0">
					{/* Left · Score summary */}
					<div className="flex w-full flex-col items-center justify-center text-center lg:w-[35%] lg:shrink-0 lg:items-start lg:pl-2.5 lg:pr-6 lg:text-left">
						<p className="inline-flex items-center justify-center text-sm font-bold text-[#B8860B] dark:text-[#D4AF37] lg:justify-start">
							🏆 {tDist('heroLabel')}
							<FormulaInfoTooltip
								label={tExec('execFormulaAria')}
								formula={tExec('execFormula', { geoWeight, seoWeight, cwvWeight })}
							/>
						</p>
						{cwvLoading ? (
							<div key="score-pending" className="relative z-10 mt-2 flex flex-col items-center gap-3 lg:items-start" role="status" aria-live="polite">
								<div className="flex flex-wrap items-end justify-center gap-x-2.5 gap-y-1 lg:justify-start">
									<span className="animate-pulse text-6xl font-extrabold leading-none tracking-tight text-slate-300 sm:text-7xl dark:text-white/15">
										{tDist('heroScorePending')}
									</span>
								</div>
								<p className="flex flex-wrap items-center gap-x-1 font-sans text-[10px] text-slate-600 sm:text-[12px] dark:text-slate-300 print:text-slate-700 print:opacity-100">
									<span className="font-medium text-slate-700 dark:text-slate-300 print:text-slate-700">{tDist('weightCompositionTechLabel')}</span>
									<span className="font-semibold text-slate-700 dark:text-slate-100 print:text-slate-800">{formatTrackNumber(t1Contrib)}</span>
									<span className="text-slate-400 dark:text-slate-500 print:text-slate-500">+</span>
									<span className="font-medium text-slate-700 dark:text-slate-300 print:text-slate-700">{tDist('weightCompositionGeoLabel')}</span>
									<span className="font-semibold text-slate-700 dark:text-slate-100 print:text-slate-800">{formatTrackNumber(t2Contrib)}</span>
									<span className="text-slate-400 dark:text-slate-500 print:text-slate-500">+</span>
									<span className="animate-pulse font-semibold text-emerald-600 dark:text-emerald-400 print:text-emerald-700">
										{tDist('weightCompositionPerfPending')}
									</span>
								</p>
								<span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-[#C9A227]/30 bg-[#D4AF37]/10 px-3 py-1 text-[11px] font-bold text-[#8B6914] dark:bg-[#D4AF37]/10 dark:text-[#E8C547]">
									<Loader2 className="h-3 w-3 animate-spin" aria-hidden />
									{tDist('cwvLoadingBadge')}
								</span>
							</div>
						) : (
							<div key="score-ready" className="relative z-10 animate-fadeIn">
								<div className="mt-2 flex flex-wrap items-end justify-center gap-x-2.5 gap-y-1 lg:justify-start">
									<span
										className="text-6xl font-extrabold leading-none tabular-nums tracking-tight sm:text-7xl"
										style={{ color: CORE_SCORE_COLORS.overall.chip }}
									>
										{animatedMeasuredScore}
									</span>
									<span className="mb-1.5 text-xl font-semibold tabular-nums text-slate-500 dark:text-slate-400">
										{tDist('heroScoreSuffix')}
									</span>
								</div>
								<div className="mt-3 flex flex-col gap-1.5">
									<p className="flex flex-wrap items-center gap-x-1 font-sans text-[10px] text-slate-600 sm:text-[12px] dark:text-slate-300 print:text-slate-700 print:opacity-100">
										<span className="font-medium text-slate-700 dark:text-slate-300 print:text-slate-700">{tDist('weightCompositionTechLabel')}</span>
										<span className="font-semibold text-slate-700 dark:text-slate-100 print:text-slate-800">{formatTrackNumber(t1Contrib)}</span>
										<span className="text-slate-400 dark:text-slate-500 print:text-slate-500">+</span>
										<span className="font-medium text-slate-700 dark:text-slate-300 print:text-slate-700">{tDist('weightCompositionGeoLabel')}</span>
										<span className="font-semibold text-slate-700 dark:text-slate-100 print:text-slate-800">{formatTrackNumber(t2Contrib)}</span>
										<span className="text-slate-400 dark:text-slate-500 print:text-slate-500">+</span>
										<span className="font-medium text-slate-700 dark:text-slate-300 print:text-slate-700">{tDist('weightCompositionPerfLabel')}</span>
										<span className="font-semibold text-slate-700 dark:text-slate-100 print:text-slate-800">{formatTrackNumber(cwvContrib)}</span>
									</p>
									{hasSecurityPenalty ? (
										<span className="mt-0.5 inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1 font-sans text-[10px] font-bold text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.2)]">
											<span aria-hidden>⚠️</span>
											{tDist('weightCompositionSecurityPenaltyStrip', {
												penalty: scoreBreakdown?.securityPenalty ?? 0,
												final: formatTrackNumber(measuredScore),
											})}
										</span>
									) : (
										<span className="mt-0.5 inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 font-sans text-[10px] font-bold text-emerald-400/90">
											<span aria-hidden>🛡️</span>
											{tDist('weightCompositionSecurityOkStrip')}
										</span>
									)}
								</div>
								<div className="mt-3 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
									<ScoreGradeBadge
										score={measuredScore}
										isHttps={isHttps}
										securityCapped={securityCapped}
										size="md"
									/>
									<span className="inline-flex rounded-full bg-[#D4AF37]/20 px-3 py-1 text-xs font-extrabold text-[#8B6914] ring-1 ring-[#C9A227]/35 dark:bg-[#D4AF37]/15 dark:text-[#E8C547]">
										{tExec('exposureTierWithPercentile', {
											icon: EXPOSURE_TIER_ICONS[exposureTier],
											tier: tExec(`exposureTier.${exposureTier}`),
											percentile: measuredPercentile,
										})}
									</span>
									<span
										className={`inline-flex rounded-full border px-3 py-1 text-xs font-extrabold ${AEO_GEO_STATUS_CLASS[aeoGeoStatusTier(measuredScore)]}`}
									>
										{tExec(`aeoGeoStatus.${aeoGeoStatusTier(measuredScore)}`)}
									</span>
								</div>
								<div className="mt-3 flex justify-center lg:justify-start">
									<ScoreBreakdownDisclosure
										measuredScore={measuredScore}
										grade={grade}
										breakdown={scoreBreakdown}
										cwvMeasured={cwvMeasured}
									/>
								</div>
							</div>
						)}
					</div>

					{/* Right · 3-score interactive bar chart — Track1/2 render normally even while
					    Track 3 is still loading; only the overall/track3 bars/radar points pulse.
					    Recharts SVG (defs/gradients/grid/radar paths) is the heaviest node html2canvas
					    has to rasterize, so it is screen-only and swapped for a plain CSS gauge —
					    see `PdfCoreScoreGauge` — during A4 capture/print for a fast (1–2s) export. */}
					<div className="flex w-full min-w-0 flex-col justify-center rounded-xl border border-slate-200/70 bg-white/50 px-3 py-3 dark:border-white/[0.06] dark:bg-black/25 lg:w-[65%] lg:rounded-none lg:border-0 lg:border-l lg:border-[#C9A227]/20 lg:bg-transparent lg:px-0 lg:py-0 lg:pl-8 lg:dark:bg-transparent">
						<div className="pdf-screen-only print:hidden">
							<CoreScoreBarChart
								overallScore={measuredScore}
								track1Score={track1Score}
								track2Score={track2Score}
								track3Score={track3Score}
								pendingKeys={cwvLoading ? PENDING_CWV_KEYS : undefined}
							/>
						</div>
						<PdfCoreScoreGauge
							overallScore={measuredScore}
							track1Score={track1Score}
							track2Score={track2Score}
							track3Score={track3Score}
						/>
					</div>
				</div>

				{/* Bottom · Diagnosis + treatment effect */}
				<div
					className="relative mt-5 flex flex-col gap-3 border-t border-zinc-200/80 pt-4 dark:border-zinc-800/80"
					role="status"
					aria-label={tExec('execDiagnosisRxLabel')}
				>
					<div className="flex flex-col gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-3 dark:border-zinc-800/60 dark:bg-zinc-900/40 sm:flex-row sm:items-center sm:gap-4">
						<div className="flex min-w-[120px] shrink-0 items-center gap-2">
							<span className="text-base" aria-hidden>🚨</span>
							<span className="text-xs font-bold tracking-tight text-rose-500 dark:text-rose-400">
								{tExec('execDiagnosisLabel')}
							</span>
						</div>
						<div className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
							{tExec('execDiagnosisRxBody')}
						</div>
					</div>
					<div className="flex flex-col gap-2 rounded-xl border border-indigo-200/70 bg-indigo-50/70 p-3 dark:border-indigo-500/20 dark:bg-indigo-950/20 sm:flex-row sm:items-center sm:gap-4">
						<div className="flex min-w-[120px] shrink-0 items-center gap-2">
							<span className="text-base" aria-hidden>💡</span>
							<span className="text-xs font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
								{tExec('execRxLabel')}
							</span>
						</div>
						<div className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-200">
							{targetAchieved
								? tExec('execPotentialAchieved')
								: tExec.rich('execDiagnosisRxEffect', {
										gain: potentialGain,
										current: measuredScore,
										target: targetScore,
										score: (chunks) => (
											<strong className="font-semibold text-emerald-600 dark:text-emerald-400">
												{chunks}
											</strong>
										),
									})}
						</div>
					</div>
				</div>
			</div>

			<QuickConversionCtaBar
				score={measuredScore}
				model={roiModel}
				urgent={exposureTier === 'danger' || Boolean(roiModel?.showLeakageBadge)}
			/>
		</section>
	);
}

export const DualScoreSummaryHeader = memo(DualScoreSummaryHeaderInner);

function FormulaInfoTooltip({ label, formula }: { label: string; formula: string }) {
	return (
		<span className="group relative ml-1.5 inline-flex print:hidden">
			<button
				type="button"
				className="inline-flex cursor-pointer items-center justify-center text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50 dark:hover:text-gray-200"
				aria-label={label}
			>
				<Info className="h-3.5 w-3.5" aria-hidden />
			</button>
			<span
				role="tooltip"
				className="pointer-events-none invisible absolute bottom-full left-1/2 z-[9999] mb-1.5 w-max max-w-[18rem] -translate-x-1/2 rounded-lg bg-gray-900/90 px-3 py-1.5 text-left text-xs leading-relaxed whitespace-normal break-keep text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 md:left-0 md:translate-x-0"
			>
				{formula}
			</span>
		</span>
	);
}

/**
 * "산출 내역 보기" — click or hover to reveal the Track1/Track2/CWV blend
 * that produced the composite score, matching the console-only breakdown
 * so the headline number is never a black box for the viewer.
 */
function ScoreBreakdownDisclosure({
	measuredScore,
	grade,
	breakdown,
	cwvMeasured,
}: {
	measuredScore: number;
	grade: string;
	breakdown?: MeasuredScoreBreakdown | null;
	cwvMeasured: boolean;
}) {
	const t = useTranslations('audit.b2b');
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		function handlePointerDown(event: MouseEvent) {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setOpen(false);
			}
		}
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') setOpen(false);
		}
		document.addEventListener('mousedown', handlePointerDown);
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('mousedown', handlePointerDown);
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [open]);

	const weightTrack1 = breakdown?.weights?.track1 ?? 0.4;
	const weightTrack2 = breakdown?.weights?.track2 ?? 0.4;
	const weightTrack3 = breakdown?.weights?.coreWebVitals ?? 0.2;
	const track1Score = breakdown?.track1 ?? 0;
	const track2Score = breakdown?.track2 ?? 0;
	const track3Score = breakdown?.coreWebVitals ?? 0;
	const track1Weight = Math.round(weightTrack1 * 100);
	const track2Weight = Math.round(weightTrack2 * 100);
	const cwvWeight = Math.round(weightTrack3 * 100);
	const track1Contribution = track1Score * weightTrack1;
	const track2Contribution = track2Score * weightTrack2;
	const cwvContribution = track3Score * weightTrack3;
	const securityPenalty = breakdown?.securityPenalty ?? 0;

	return (
		<div ref={containerRef} className="group relative z-50 inline-flex overflow-visible print:hidden">
			<button
				type="button"
				onClick={() => setOpen((prev) => !prev)}
				onMouseEnter={() => setOpen(true)}
				onMouseLeave={() => setOpen(false)}
				aria-expanded={open}
				aria-label={t('breakdownButtonAria')}
				className="inline-flex items-center gap-1 rounded-full border border-slate-300/70 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-[#C9A227]/50 hover:text-[#8B6914] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/40 dark:border-white/15 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:text-[#E8C547]"
			>
				<Info className="h-3 w-3" aria-hidden />
				{t('breakdownButtonLabel')}
			</button>
			{open && (
				<div
					role="dialog"
					aria-label={t('breakdownTitle')}
					onMouseEnter={() => setOpen(true)}
					onMouseLeave={() => setOpen(false)}
					className="absolute left-1/2 top-full z-[60] mt-2 w-[19rem] -translate-x-1/2 rounded-xl border border-[#C9A227]/25 bg-white p-3.5 text-left shadow-2xl ring-1 ring-black/5 lg:left-0 lg:translate-x-0 dark:border-white/10 dark:bg-[#0B0F28] dark:ring-white/10"
				>
					<div className="flex items-center justify-between gap-2">
						<p className="text-xs font-extrabold text-slate-800 dark:text-white">{t('breakdownTitle')}</p>
						<button
							type="button"
							onClick={() => setOpen(false)}
							aria-label={t('breakdownCloseAria')}
							className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
						>
							<X className="h-3.5 w-3.5" aria-hidden />
						</button>
					</div>
					<p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
						{t('breakdownSubtitle')}
					</p>
					<div className="mt-3 flex flex-col gap-2">
						<BreakdownRow
							label={t('breakdownTrack1Label')}
							weight={track1Weight}
							scoreText={t('breakdownScoreToContribution', {
								score: track1Score,
								contribution: track1Contribution.toFixed(1),
							})}
						/>
						<BreakdownRow
							label={t('breakdownTrack2Label')}
							weight={track2Weight}
							scoreText={t('breakdownScoreToContribution', {
								score: track2Score,
								contribution: track2Contribution.toFixed(1),
							})}
						/>
						<BreakdownRow
							label={t('breakdownCwvLabel')}
							weight={cwvWeight}
							scoreText={t('breakdownScoreToContribution', {
								score: track3Score,
								contribution: cwvContribution.toFixed(1),
							})}
						/>
						{!cwvMeasured && (
							<p className="text-[10px] leading-relaxed text-amber-600 dark:text-amber-400">
								{t('breakdownCwvFallbackNote')}
							</p>
						)}
						{securityPenalty > 0 ? (
							<div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-2 text-xs dark:border-white/10">
								<span className="font-semibold text-rose-600 dark:text-rose-400">
									{t('breakdownSecurityPenaltyLabel')}
								</span>
								<span className="font-extrabold tabular-nums text-rose-600 dark:text-rose-400">
									{t('breakdownSecurityPenaltyValue', { penalty: securityPenalty })}
								</span>
							</div>
						) : (
							<p className="border-t border-dashed border-slate-200 pt-2 text-[11px] font-medium text-emerald-600 dark:border-white/10 dark:text-emerald-400">
								{t('breakdownSecurityOkLabel')}
							</p>
						)}
					</div>
					<div className="mt-3 flex items-center justify-between rounded-lg bg-[#D4AF37]/10 px-2.5 py-2 dark:bg-[#D4AF37]/10">
						<span className="text-xs font-extrabold text-slate-800 dark:text-white">
							{t('breakdownFinalLabel')}
						</span>
						<span className="text-sm font-extrabold tabular-nums text-[#8B6914] dark:text-[#E8C547]">
							{t('breakdownFinalValue', { score: measuredScore, grade })}
						</span>
					</div>
				</div>
			)}
		</div>
	);
}

function BreakdownRow({
	label,
	weight,
	scoreText,
}: {
	label: string;
	weight: number;
	scoreText: string;
}) {
	return (
		<div className="flex items-center justify-between gap-3 text-xs">
			<span className="text-slate-600 dark:text-slate-300">
				{label} <span className="text-slate-400 dark:text-slate-500">({weight}%)</span>
			</span>
			<span className="shrink-0 font-bold tabular-nums text-slate-800 dark:text-slate-100">{scoreText}</span>
		</div>
	);
}
