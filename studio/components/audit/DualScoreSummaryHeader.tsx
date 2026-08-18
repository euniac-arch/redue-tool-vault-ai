'use client';

import { memo } from 'react';
import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CORE_SCORE_COLORS, CoreScoreBarChart } from '@/components/audit/CoreScoreBarChart';
import { ScoreGradeBadge } from '@/components/audit/ScoreGradeBadge';
import { QuickConversionCtaBar } from '@/components/audit/QuickConversionCtaBar';
import type { BusinessConversionModel } from '@/lib/audit/business-conversion';
import { GROUP_MAX_SCORES, formatRawScore } from '@/lib/audit/onpage-diagnostic';
import { gradeThemeFromScore } from '@/lib/audit/score-grade';

type ExposureTier = 'danger' | 'partial' | 'top';

interface DualScoreSummaryHeaderProps {
	measuredScore: number;
	measuredPercentile: number;
	geoScore: number;
	geoGrade: string;
	geoPercentile: number;
	geoWeight: number;
	seoScore: number;
	seoWeight: number;
	technicalPercentile: number;
	rawTechnicalScore: number;
	maxRawScore: number;
	securityAlert?: string | null;
	isHttps?: boolean;
	securityCapped?: boolean;
	potentialGain: number;
	targetScore: number;
	exposureTier: ExposureTier;
	roiModel?: BusinessConversionModel | null;
}

const EXPOSURE_TIER_ICONS: Record<ExposureTier, string> = {
	danger: '🔴',
	partial: '🟡',
	top: '🟢',
};

/**
 * Score hierarchy for the Executive Summary header.
 * All numbers come from `auditData.scores` — this component never recalculates.
 */
function DualScoreSummaryHeaderInner({
	measuredScore,
	measuredPercentile,
	geoScore,
	geoGrade,
	geoPercentile,
	geoWeight,
	seoScore,
	seoWeight,
	technicalPercentile,
	rawTechnicalScore,
	maxRawScore,
	securityAlert,
	isHttps = true,
	securityCapped = false,
	potentialGain,
	targetScore,
	exposureTier,
	roiModel,
}: DualScoreSummaryHeaderProps) {
	const tGeo = useTranslations('audit.geoScore');
	const tDist = useTranslations('audit.scoreDistribution');
	const tExec = useTranslations('audit.b2b');

	const technicalScore = seoScore;
	const geoStyles = gradeThemeFromScore(geoScore);
	const schemaStyles = gradeThemeFromScore(technicalScore);
	const targetAchieved = potentialGain === 0;

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
			{/* Box 1 · Score + axis cards + diagnosis / treatment */}
			<div className="relative overflow-visible rounded-2xl border border-[#C9A227]/35 bg-gradient-to-br from-[#C9A227]/[0.12] via-[#D4AF37]/[0.05] to-transparent p-5 sm:p-6">
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
								formula={tExec('execFormula', { geoWeight, seoWeight })}
							/>
						</p>
						<div className="mt-2 flex flex-wrap items-end justify-center gap-x-2.5 gap-y-1 lg:justify-start">
							<span
								className="text-6xl font-extrabold leading-none tabular-nums tracking-tight sm:text-7xl"
								style={{ color: CORE_SCORE_COLORS.overall.chip }}
							>
								{measuredScore}
							</span>
							<span className="mb-1.5 text-xl font-semibold tabular-nums text-slate-500 dark:text-slate-400">
								{tDist('heroScoreSuffix')}
							</span>
						</div>
						<p
							className="mt-3 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400"
							title={tDist('weightedConversionTooltip', {
								max: maxRawScore,
								security: GROUP_MAX_SCORES.security,
								webPerf: GROUP_MAX_SCORES.performance,
								seo: GROUP_MAX_SCORES.seo,
								schema: GROUP_MAX_SCORES.schema,
								geo: GROUP_MAX_SCORES.geo,
							})}
						>
							{tDist('rawScoreLabel')}{' '}
							<span className="font-extrabold text-slate-700 dark:text-slate-200">
								{tDist('rawScoreValue', {
									score: formatRawScore(rawTechnicalScore),
									max: maxRawScore,
								})}
							</span>
						</p>
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
						</div>
					</div>

					{/* Right · 3-score interactive bar chart */}
					<div className="flex w-full min-w-0 flex-col justify-center rounded-xl border border-slate-200/70 bg-white/50 px-3 py-3 dark:border-white/[0.06] dark:bg-black/25 lg:w-[65%] lg:rounded-none lg:border-0 lg:border-l lg:border-[#C9A227]/20 lg:bg-transparent lg:px-0 lg:py-0 lg:pl-8 lg:dark:bg-transparent">
						<CoreScoreBarChart
							overallScore={measuredScore}
							aiTrustScore={geoScore}
							techSeoScore={technicalScore}
						/>
					</div>
				</div>

				{/* Mid · External trust + Technical score (2-col) */}
				<div className="relative mt-5 grid grid-cols-1 items-stretch gap-3 border-t border-slate-100 pt-5 dark:border-white/10 md:grid-cols-2">
					<article
						className={`relative flex h-full flex-col overflow-visible rounded-xl border border-indigo-200 dark:border-indigo-400/20 bg-gradient-to-br from-indigo-50 via-violet-50 to-white dark:from-[#0E1140] dark:via-[#1B1150] dark:to-[#0A0C2E] p-4 ring-1 ${geoStyles.ring}`}
					>
						<div
							className="pointer-events-none absolute inset-0 opacity-30 print:hidden"
							style={{
								background:
									'radial-gradient(circle at 20% 20%, rgba(56,189,248,0.22), transparent 50%), radial-gradient(circle at 80% 10%, rgba(168,85,247,0.2), transparent 45%)',
							}}
						/>
						<div className="relative flex flex-1 flex-col gap-2">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div className="min-w-0">
									<p className="text-xs font-bold leading-snug tracking-wide text-indigo-700 dark:text-indigo-200/85">
										{tDist('reputationCardTitle')}
									</p>
								</div>
								<span className="rounded-full bg-indigo-100/90 px-2 py-0.5 text-[10px] font-extrabold text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-200">
									{tDist('weightBadge', { pct: geoWeight })}
								</span>
							</div>
							<div className="flex flex-wrap items-end gap-1.5">
								<span className="text-3xl font-extrabold tabular-nums sm:text-4xl" style={{ color: CORE_SCORE_COLORS.aiTrust.chip }}>
									{geoScore}
								</span>
								<span className="mb-0.5 text-sm text-slate-600 dark:text-slate-400">{tGeo('scoreSuffix')}</span>
							</div>
							<div className="flex flex-wrap items-center gap-1.5">
								<ScoreGradeBadge score={geoScore} grade={geoGrade} isHttps={isHttps} />
								<span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-800 dark:bg-white/10 dark:text-slate-200">
									{tGeo('percentileLabel', { percentile: geoPercentile })}
								</span>
							</div>
						</div>
					</article>

					<article
						className={`relative flex h-full flex-col overflow-visible rounded-xl border border-slate-200 dark:border-white/[0.08] bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-[#0B1220] dark:to-slate-900 p-4 ring-1 ${schemaStyles.ring}`}
					>
						<div className="flex flex-1 flex-col gap-2">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div className="min-w-0">
									<p className="text-xs font-bold leading-snug tracking-wide text-slate-600 dark:text-slate-400">
										{tDist('schemaCardTitle')}
									</p>
								</div>
								<span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-extrabold text-slate-700 dark:bg-white/10 dark:text-slate-200">
									{tDist('weightBadge', { pct: seoWeight })}
								</span>
							</div>
							<div className="flex flex-wrap items-end gap-1.5">
								<span className="text-3xl font-extrabold tabular-nums sm:text-4xl" style={{ color: CORE_SCORE_COLORS.techSeo.chip }}>
									{tDist('mainScoreUnit', { score: technicalScore })}
								</span>
								<span className="mb-0.5 text-sm text-slate-600 dark:text-slate-400">{tDist('mainScoreSuffix')}</span>
							</div>
							<div className="flex flex-wrap items-center gap-1.5">
								<ScoreGradeBadge score={technicalScore} isHttps={isHttps} securityCapped={securityCapped} />
								<span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-800 dark:bg-white/10 dark:text-slate-200">
									{tGeo('percentileLabel', { percentile: technicalPercentile })}
								</span>
								<span
									className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
									title={tDist('algoTooltip', {
										max: maxRawScore,
										security: GROUP_MAX_SCORES.security,
										webPerf: GROUP_MAX_SCORES.performance,
										seo: GROUP_MAX_SCORES.seo,
										perfA11y: GROUP_MAX_SCORES.performance,
										schema: GROUP_MAX_SCORES.schema,
										geo: GROUP_MAX_SCORES.geo,
									})}
								>
									{tDist('algoBadgeCompact', {
										score: formatRawScore(rawTechnicalScore),
										max: maxRawScore,
									})}
								</span>
							</div>
						</div>
					</article>
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
				className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-[18rem] -translate-x-1/2 rounded-lg bg-gray-900/90 px-3 py-1.5 text-left text-xs leading-relaxed whitespace-normal break-keep text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 md:left-0 md:translate-x-0"
			>
				{formula}
			</span>
		</span>
	);
}
