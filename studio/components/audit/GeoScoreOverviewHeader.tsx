'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FileDown, Info } from 'lucide-react';
import { GeoPillarScoreTable } from '@/components/audit/GeoPillarScoreTable';
import { ScoreGradeBadge } from '@/components/audit/ScoreGradeBadge';
import { TrackingStatusBadge } from '@/components/audit/TrackingStatusBadge';
import { useAuditPayload } from '@/components/audit/AuditPayloadProvider';
import { useAuditData } from '@/components/audit/AuditDataContext';
import {
	daysUntilNextCitationMeasurement,
	hostnameFromAuditUrl,
	latestAppliedEventForHost,
	resolveTrackingStatus,
} from '@/lib/audit/domain-tracking';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { countAuditDefects } from '@/lib/audit/latest-audit-payload';
import {
	resolveReputationInsight,
	type ReputationInsight,
	type ReputationInsightKind,
} from '@/lib/audit/reputation-insight';
import { formatRawScore } from '@/lib/audit/onpage-diagnostic';
import { gradeThemeFromScore } from '@/lib/audit/score-grade';
import type { AuditReport } from '@/lib/site-auditor';

const INSIGHT_TONE: Record<ReputationInsightKind, string> = {
	httpsCritical:
		'border-rose-200 bg-rose-50/90 text-rose-900 dark:border-rose-400/25 dark:bg-rose-500/[0.08] dark:text-rose-100',
	bothWeak:
		'border-rose-200 bg-rose-50/90 text-rose-900 dark:border-rose-400/25 dark:bg-rose-500/[0.08] dark:text-rose-100',
	schemaWeakReputationGood:
		'border-amber-200 bg-amber-50/90 text-amber-950 dark:border-amber-400/25 dark:bg-amber-500/[0.08] dark:text-amber-100',
	schemaGoodReputationWeak:
		'border-indigo-200 bg-indigo-50/90 text-indigo-950 dark:border-indigo-400/25 dark:bg-indigo-500/[0.08] dark:text-indigo-100',
	bothGood:
		'border-emerald-200 bg-emerald-50/90 text-emerald-950 dark:border-emerald-400/25 dark:bg-emerald-500/[0.08] dark:text-emerald-100',
};

const CHIP_TONE: Record<ReputationInsightKind, { defect: string; reputation: string }> = {
	httpsCritical: {
		defect: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
		reputation: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
	},
	bothWeak: {
		defect: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
		reputation: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
	},
	schemaWeakReputationGood: {
		defect: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
		reputation: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
	},
	schemaGoodReputationWeak: {
		defect: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
		reputation: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
	},
	bothGood: {
		defect: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
		reputation: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
	},
};

interface GeoScoreOverviewHeaderProps {
	report: AuditReport;
	reportData?: GeoNarrativeReport | null;
	onOpenPdfPreview?: () => void;
}

export function GeoScoreOverviewHeader({
	report,
	onOpenPdfPreview,
}: GeoScoreOverviewHeaderProps) {
	const t = useTranslations('audit.geoScore');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';

	const { appliedResult } = useAuditPayload();
	const { scores, snapshot } = useAuditData();
	const geoScore = scores.geoScore;
	const geoAi = snapshot.geoAiMeasured;
	const overview = snapshot.reputation.overview;
	const insight = resolveReputationInsight(countAuditDefects(report), geoScore, lang, {
		isHttps: scores.isHttps,
	});
	const styles = gradeThemeFromScore(geoScore);
	const chipTone = CHIP_TONE[insight.kind];
	const [storedEvent, setStoredEvent] = useState<ReturnType<typeof latestAppliedEventForHost>>(null);
	useEffect(() => {
		setStoredEvent(latestAppliedEventForHost(hostnameFromAuditUrl(report.url)));
	}, [report.url, report.prescriptionAppliedAt, appliedResult?.appliedAt]);
	const appliedAt = report.prescriptionAppliedAt ?? appliedResult?.appliedAt ?? storedEvent?.timestamp ?? null;
	const trackingStatus = resolveTrackingStatus({ appliedAt });
	const daysUntilNext = daysUntilNextCitationMeasurement(appliedAt);
	const expectedScore =
		report.expectedScore ?? appliedResult?.expectedScore ?? storedEvent?.expectedScore ?? null;
	const percent = geoScore;
	const achievedTop = overview.pointsToTop <= 0;
	const achievedMin = geoScore >= overview.minExposureThreshold;
	const pointsToMin = Math.max(0, overview.minExposureThreshold - geoScore);

	function handleDownloadPdf() {
		onOpenPdfPreview?.();
	}

	return (
		<div
			id="geo-score-summary"
			className={`pdf-page-item audit-report-section scroll-mt-24 relative w-full max-w-full box-border overflow-visible flex flex-col gap-5 rounded-2xl border border-indigo-200 dark:border-indigo-400/20 bg-gradient-to-br from-indigo-50 via-violet-50 to-white dark:from-[#0E1140] dark:via-[#1B1150] dark:to-[#0A0C2E] p-6 ring-1 ${styles.ring}`}
		>
			<div
				className="pointer-events-none absolute inset-0 opacity-40 print:hidden"
				style={{
					background:
						'radial-gradient(circle at 15% 20%, rgba(56,189,248,0.25), transparent 45%), radial-gradient(circle at 85% 15%, rgba(168,85,247,0.25), transparent 45%)',
				}}
			/>
			<div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-2">
						<span className="text-xl" aria-hidden>
							🌐
						</span>
						<h3 className="text-lg font-bold text-slate-900 dark:text-white">
							{t('summaryTitle')}{' '}
							<span className="text-sm font-normal text-slate-500 dark:text-zinc-400">{t('summaryTitleHint')}</span>
						</h3>
					</div>
					<div className="mt-1 flex flex-wrap items-baseline gap-2">
						<span className={`text-5xl font-extrabold tabular-nums ${styles.text}`}>{geoScore}</span>
						<span className="text-lg text-slate-600 dark:text-slate-400">{t('scoreSuffix')}</span>
					</div>
					<p className="text-xs text-slate-500 dark:text-zinc-400">
						{t('percentileLabel', { percentile: scores.geoPercentile })} · {t('gradeLabel', { grade: snapshot.geoGrade })}
					</p>
					<div className="mt-2 flex flex-wrap items-center gap-3">
						<ScoreGradeBadge score={geoScore} grade={snapshot.geoGrade} size="md" isHttps={scores.isHttps} />
						<TrackingStatusBadge
							status={trackingStatus}
							daysUntilNext={daysUntilNext}
							expectedScore={expectedScore}
							compact
						/>
					</div>
				</div>

				<div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
					<svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
						<defs>
							<linearGradient id="geoScoreRing" x1="0%" y1="0%" x2="100%" y2="100%">
								<stop offset="0%" stopColor="#22d3ee" />
								<stop offset="100%" stopColor="#a855f7" />
							</linearGradient>
						</defs>
						<circle cx="60" cy="60" r="52" fill="none" className="stroke-slate-200 dark:stroke-white/10" strokeWidth="12" />
						<circle
							cx="60"
							cy="60"
							r="52"
							fill="none"
							strokeWidth="12"
							strokeLinecap="round"
							stroke="url(#geoScoreRing)"
							strokeDasharray={`${(percent / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
						/>
					</svg>
					<p className="absolute text-xl font-bold text-slate-900 dark:text-white">{percent}%</p>
				</div>
			</div>

			<div className="relative rounded-xl border border-indigo-200/80 bg-white/80 px-4 py-3 dark:border-indigo-400/20 dark:bg-white/[0.04]">
				<div className="mb-2 flex items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-1.5">
						<span className="text-sm font-medium text-slate-800 dark:text-zinc-200">
							{t('category5Title')}{' '}
							<span className="text-xs font-normal text-slate-500 dark:text-zinc-400">{t('category5TitleHint')}</span>
						</span>
						<MeasuredScoreInfoTooltip
							label={t('category5TooltipAria')}
							text={t('category5Tooltip', {
								score: formatRawScore(geoAi.rawScore),
								max: geoAi.maxScore,
								pct: geoAi.score100,
								comprehensive: geoScore,
							})}
						/>
					</div>
					<span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold tabular-nums ${chipTone.defect}`}>
						{geoAi.defectCount > 0
							? t('category5Defects', { count: geoAi.defectCount })
							: geoAi.warningCount > 0
								? t('category5Warnings', { count: geoAi.warningCount })
								: t('category5Clean')}
					</span>
				</div>
				<div className="flex items-center gap-2 text-sm">
					<span className="font-semibold tabular-nums text-slate-900 dark:text-white">
						{t('category5Score', { score: formatRawScore(geoAi.rawScore), max: geoAi.maxScore })}
					</span>
					<span className="text-slate-400 dark:text-zinc-500" aria-hidden>
						·
					</span>
					<span className="text-slate-500 dark:text-zinc-400">
						{t('category5Converted', { pct: geoAi.score100 })}
					</span>
				</div>
			</div>

			<GeoPillarScoreTable />

			<div
				className={`relative flex flex-col gap-2 rounded-xl border px-4 py-3.5 ${INSIGHT_TONE[insight.kind]}`}
			>
				<div className="flex flex-wrap items-center gap-2">
					<p className="text-xs font-extrabold tracking-wide">{t('insightLabel')}</p>
					<div className="flex flex-wrap gap-1.5">
						<span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold tabular-nums ${chipTone.defect}`}>
							{t('insightDefectChip', { count: insight.defectCount })}
						</span>
						<span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold tabular-nums ${chipTone.reputation}`}>
							{t('insightReputationChip', { score: insight.reputationScore })}
						</span>
					</div>
				</div>
				<p className="min-w-0 whitespace-normal break-keep text-left text-base font-semibold leading-relaxed">
					{getDiagnosticMessage(insight)}
				</p>
			</div>

			<div className="relative rounded-xl border border-indigo-200 dark:border-indigo-400/20 bg-slate-50 dark:bg-black/25 p-4">
				<p className="text-xs font-bold text-indigo-700 dark:text-indigo-200">{t('thresholdTitle')}</p>
				<div className="mt-3 grid gap-3 sm:grid-cols-2">
					<div className="rounded-lg border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] px-3 py-2.5">
						<p className="text-[10px] uppercase tracking-wide text-slate-500">{t('minExposureLabel')}</p>
						<p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
							{t('minExposureValue', { threshold: overview.minExposureThreshold })}
						</p>
						<p className={`mt-0.5 text-[11px] ${achievedMin ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
							{achievedMin ? t('minExposureAchieved') : t('minExposureShort', { points: pointsToMin })}
						</p>
					</div>
					<div className="rounded-lg border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] px-3 py-2.5">
						<p className="text-[10px] uppercase tracking-wide text-slate-500">{t('topRecommendationLabel')}</p>
						<p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
							{t('topRecommendationValue', { threshold: overview.topRecommendationThreshold })}
						</p>
						<p className="mt-0.5 text-[11px] text-cyan-800 dark:text-cyan-300">
							{achievedTop ? t('topRecommendationAchieved') : t('topRecommendationHint', { points: overview.pointsToTop })}
						</p>
					</div>
				</div>
			</div>

			<div className="relative print:hidden pdf-screen-only flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
				<button
					type="button"
					onClick={handleDownloadPdf}
					disabled={!onOpenPdfPreview}
					className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-950/30 transition hover:from-cyan-400 hover:to-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-[#0E1140] sm:w-auto"
				>
					<FileDown className="h-4 w-4" aria-hidden />
					{t('pdfButton')}
				</button>
				<p className="flex-1 whitespace-nowrap break-keep text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 sm:text-right">
					{t('disclaimer')}
				</p>
			</div>
		</div>
	);
}

function MeasuredScoreInfoTooltip({ label, text }: { label: string; text: string }) {
	return (
		<span className="group relative inline-flex print:hidden">
			<button
				type="button"
				className="inline-flex cursor-pointer items-center justify-center text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 dark:text-zinc-400 dark:hover:text-zinc-200"
				aria-label={label}
			>
				<Info className="h-3.5 w-3.5" aria-hidden />
			</button>
			<span
				role="tooltip"
				className="pointer-events-none invisible absolute bottom-full left-0 z-20 mb-2 w-64 rounded-lg border border-slate-200 bg-white p-2 text-left text-[11px] leading-relaxed whitespace-normal break-keep text-slate-600 opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
			>
				{text}
			</span>
		</span>
	);
}

/** 상태에 따른 한 줄 진단 요약 — [진단 현황] + [행동 촉구]. */
function getDiagnosticMessage(insight: ReputationInsight) {
	return (
		<>
			&ldquo;{insight.message}&rdquo;
		</>
	);
}
