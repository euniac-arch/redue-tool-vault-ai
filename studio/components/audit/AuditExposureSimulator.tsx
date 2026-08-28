'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EnterpriseBlueprintModal } from '@/components/audit/EnterpriseBlueprintModal';
import { useAuditData } from '@/components/audit/AuditDataContext';
import { topPercentileFromScore } from '@/lib/audit/score-grade';
import { buildExecStorytelling, buildSimulatorInsightData, isSharpExposureLift } from '@/lib/audit/exec-insight';
import type { AuditReport } from '@/lib/site-auditor';

type ExposureTier = 'danger' | 'partial' | 'top';

const EXPOSURE_TIER_STYLES: Record<ExposureTier, { icon: string; text: string; bar: string; border: string; bg: string }> = {
	danger: { icon: '🔴', text: 'text-rose-700 dark:text-rose-300', bar: 'bg-rose-500', border: 'border-slate-200 dark:border-white/10', bg: 'bg-slate-50 dark:bg-black/25' },
	partial: { icon: '🟡', text: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-400', border: 'border-slate-200 dark:border-white/10', bg: 'bg-slate-50 dark:bg-black/25' },
	top: { icon: '🟢', text: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/30', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
};

function exposureTier(score: number, minThreshold: number, topThreshold: number): ExposureTier {
	if (score >= topThreshold) return 'top';
	if (score >= minThreshold) return 'partial';
	return 'danger';
}

const EXPOSURE_BENEFIT_ITEMS = [
	{ key: 'ai', icon: '🤖' },
	{ key: 'cost', icon: '📈' },
	{ key: 'trust', icon: '💎' },
] as const;
const EXPOSURE_ROADMAP_ITEMS = [
	{ key: 'footprint', icon: '🌐' },
	{ key: 'local', icon: '📍' },
	{ key: 'eeat', icon: '📝' },
] as const;

interface AuditExposureSimulatorProps {
	report: AuditReport;
}

/** Optimization potential simulator (current → projected) + enterprise blueprint CTA. */
export function AuditExposureSimulator({ report }: AuditExposureSimulatorProps) {
	const t = useTranslations('audit.b2b');
	const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);
	const { scores, snapshot } = useAuditData();
	const overview = snapshot.reputation.overview;
	const findingsCount = report.findings?.length ?? 0;

	const derived = useMemo(() => {
		const story = buildExecStorytelling({
			geoScore: scores.geoScore,
			seoScore: scores.technicalScore,
			url: report.url,
			hasSsl: report.hasSsl,
		});
		const currentScore = scores.totalScore;
		const potentialGain = Math.max(0, story.targetScore - currentScore);
		const insight = buildSimulatorInsightData({
			currentScore,
			scoreDelta: potentialGain,
			schemaDefectCount: findingsCount,
		});
		const currentTier = exposureTier(
			currentScore,
			overview.minExposureThreshold,
			overview.topRecommendationThreshold,
		);
		return {
			currentScore,
			potentialGain,
			targetAchieved: potentialGain === 0,
			schemaDefectCount: insight.schemaDefectCount,
			projectedScore: insight.projectedScore,
			scoreDelta: insight.scoreDelta,
			currentTier,
			currentTierStyle: EXPOSURE_TIER_STYLES[currentTier],
			currentPercentile: scores.percentile,
			targetPercentile: topPercentileFromScore(insight.projectedScore),
		};
	}, [
		scores.geoScore,
		scores.technicalScore,
		scores.totalScore,
		scores.percentile,
		report.url,
		report.hasSsl,
		findingsCount,
		overview.minExposureThreshold,
		overview.topRecommendationThreshold,
	]);

	const {
		currentScore,
		potentialGain,
		targetAchieved,
		schemaDefectCount,
		projectedScore,
		scoreDelta,
		currentTier,
		currentTierStyle,
		currentPercentile,
		targetPercentile,
	} = derived;
	const exposureFooter =
		scoreDelta <= 0
			? t('exposureFooterNoteStable')
			: schemaDefectCount === 0
				? t('exposureFooterNoteClean', { target: projectedScore })
				: isSharpExposureLift(currentScore, projectedScore)
					? t('exposureFooterNote', { count: schemaDefectCount, target: projectedScore })
					: t('exposureFooterNoteHold', { count: schemaDefectCount, target: projectedScore });

	return (
		<section
			id="exposure-simulator"
			className="pdf-page-item audit-report-section scroll-mt-24 overflow-visible rounded-2xl border border-[#C9A227]/25 bg-white px-5 py-6 dark:bg-[#0B0F28] sm:px-6"
		>
			<div>
				<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('exposureCompareKicker')}</p>
				<p className="mt-1 text-sm font-extrabold tracking-wide text-slate-800 dark:text-slate-100">{t('exposureCompareTitle')}</p>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('exposureCompareHint')}</p>
			</div>

			<div className="mt-5 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
				<div className={`rounded-xl border ${currentTierStyle.border} ${currentTierStyle.bg} px-4 py-4`}>
					<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
						{t('exposureCurrentLabel')}
					</p>
					<div className="mt-2 flex items-baseline gap-1.5">
						<span className="text-4xl font-extrabold tabular-nums text-slate-900 dark:text-white">{currentScore}</span>
						<span className="text-sm font-semibold text-slate-400">{t('exposureScoreSuffix')}</span>
					</div>
					<p className={`mt-2 text-[11px] font-semibold ${currentTierStyle.text}`}>
						{t('exposureTierWithPercentile', {
							icon: currentTierStyle.icon,
							tier: t(`exposureTier.${currentTier}`),
							percentile: currentPercentile,
						})}
					</p>
				</div>

				<div className="flex items-center justify-center py-0.5 sm:px-1 sm:py-0">
					<div className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3.5 py-2 text-center">
						<p className="text-sm font-extrabold tabular-nums text-[#B8860B] dark:text-[#D4AF37]">
							{targetAchieved ? t('exposureAchieved') : t('exposureGain', { gain: potentialGain })}
						</p>
					</div>
				</div>

				<div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-4">
					<p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300/80">
						{t('exposureTargetLabel')}
					</p>
					<div className="mt-2 flex items-baseline gap-1.5">
						<span className="text-4xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">{projectedScore}</span>
						<span className="text-sm font-semibold text-emerald-600/70 dark:text-emerald-300/60">{t('exposureScoreSuffix')}</span>
					</div>
					<p className="mt-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
						{t('exposureTargetTier', { percentile: targetPercentile })}
					</p>
				</div>
			</div>

			<div className="relative mt-5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-black/40">
				<div
					className={`h-full rounded-full transition-all ${currentTierStyle.bar}`}
					style={{ width: `${Math.min(100, Math.max(currentScore, 3))}%` }}
				/>
				<div
					className="absolute inset-y-0 w-0.5 bg-emerald-400"
					style={{ left: `${Math.min(100, projectedScore)}%` }}
					aria-hidden
				/>
			</div>

			<p className="mt-5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400" title={exposureFooter}>
				{exposureFooter}
			</p>

			<details className="group mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 open:shadow-sm dark:border-white/10 dark:bg-black/20">
				<summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-slate-800 transition-colors hover:bg-blue-50/60 dark:text-slate-100 dark:hover:bg-blue-500/10 [&::-webkit-details-marker]:hidden">
					<span>{t('exposureGuideTitle')}</span>
					<svg
						className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ease-out group-open:rotate-180 dark:text-slate-500"
						viewBox="0 0 20 20"
						fill="currentColor"
						aria-hidden
					>
						<path
							fillRule="evenodd"
							d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
							clipRule="evenodd"
						/>
					</svg>
				</summary>
				<div className="animate-fadeIn border-t border-slate-200 dark:border-white/10">
					<div className="px-4 py-4">
						<p className="text-sm font-bold text-amber-900 dark:text-amber-200">
							{t('exposureBenefitsTitle')}
						</p>
						<ul className="mt-6 grid grid-cols-1 items-stretch gap-5 md:grid-cols-3">
							{EXPOSURE_BENEFIT_ITEMS.map(({ key, icon }) => (
								<li
									key={key}
									className="flex h-full flex-col justify-between break-keep whitespace-normal rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/60"
								>
									<div>
										<div className="mb-3 text-2xl" aria-hidden>
											{icon}
										</div>
										<h4 className="mb-2 text-base font-bold text-slate-900 dark:text-white">
											{t(`exposureBenefitsItems.${key}.title`)}
										</h4>
										<p className="text-xs leading-relaxed text-slate-500 sm:text-sm dark:text-slate-400">
											{t(`exposureBenefitsItems.${key}.body`)}
										</p>
									</div>
								</li>
							))}
						</ul>
					</div>
					<div className="border-t border-dashed border-slate-200 px-4 py-4 dark:border-white/15">
						<p className="text-sm font-bold text-slate-800 dark:text-slate-100">
							{t('exposureRoadmapTitle')}
						</p>
						<ul className="mt-3 grid grid-cols-1 items-stretch gap-2 md:grid-cols-3 md:gap-3">
							{EXPOSURE_ROADMAP_ITEMS.map(({ key, icon }) => (
								<li
									key={key}
									className="flex h-full flex-col justify-between break-keep whitespace-normal rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40"
								>
									<span className="text-2xl leading-none" aria-hidden>
										{icon}
									</span>
									<p className="mt-2.5 text-sm font-bold leading-snug text-slate-800 dark:text-slate-100">
										{t(`exposureRoadmapItems.${key}.title`)}
									</p>
									<p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
										{t(`exposureRoadmapItems.${key}.body`)}
									</p>
								</li>
							))}
						</ul>
						<p className="mt-6 text-center text-[11px] text-slate-500">
							{t('exposureGuideDisclaimer')}
						</p>
					</div>
				</div>
			</details>

			<div className="print:hidden mt-3 flex w-full flex-col items-start justify-between gap-3.5 rounded-xl border border-indigo-500/35 bg-gradient-to-r from-indigo-950/50 via-purple-950/25 to-zinc-950 p-4 shadow-lg sm:flex-row sm:items-center">
				<div className="flex items-center gap-3 pl-1">
					<span className="shrink-0 select-none text-2xl" aria-hidden>
						👑
					</span>
					<div>
						<h4 className="text-sm font-extrabold tracking-tight text-white md:text-base">
							{t('blueprint.bannerTitle')}
						</h4>
						<p className="mt-0.5 text-xs text-zinc-400">{t('blueprint.bannerSubtitle')}</p>
					</div>
				</div>
				<button
					type="button"
					onClick={() => setIsBlueprintModalOpen(true)}
					className="flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition-all hover:bg-indigo-500 sm:w-auto md:text-sm"
				>
					<span>{t('blueprint.bannerCta')}</span>
					<span className="text-xs" aria-hidden>
						➔
					</span>
				</button>
			</div>

			<EnterpriseBlueprintModal
				open={isBlueprintModalOpen}
				onClose={() => setIsBlueprintModalOpen(false)}
			/>
		</section>
	);
}
