'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { resolveExternalReputation } from '@/lib/audit/geo-score';
import type { AuditReport } from '@/lib/site-auditor';

interface GeoScoreOverviewHeaderProps {
	report: AuditReport;
	reportData?: GeoNarrativeReport | null;
}

/**
 * AI/GEO-exclusive palette (cyan → indigo → fuchsia → rose) — deliberately kept
 * out of the gold/amber family used by the technical score card below, so the
 * two headline cards stay visually distinct at every grade tier.
 */
function gradeStyles(grade: string): { text: string; ring: string; badge: string } {
	if (grade === 'S' || grade === 'A+' || grade === 'A') {
		return {
			text: 'text-cyan-300',
			ring: 'ring-cyan-400/40',
			badge: 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/40',
		};
	}
	if (grade === 'B+' || grade === 'B') {
		return {
			text: 'text-indigo-300',
			ring: 'ring-indigo-400/40',
			badge: 'bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/40',
		};
	}
	if (grade === 'C+' || grade === 'C') {
		return {
			text: 'text-fuchsia-300',
			ring: 'ring-fuchsia-400/40',
			badge: 'bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-fuchsia-400/40',
		};
	}
	return {
		text: 'text-rose-400',
		ring: 'ring-rose-400/40',
		badge: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/40',
	};
}

export function GeoScoreOverviewHeader({ report, reportData }: GeoScoreOverviewHeaderProps) {
	const t = useTranslations('audit.geoScore');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';

	const { overview } = resolveExternalReputation(report, reportData, lang);
	const styles = gradeStyles(overview.grade);
	const percent = clampPercent(overview.score);
	const achievedTop = overview.pointsToTop <= 0;
	const achievedMin = overview.score >= overview.minExposureThreshold;
	const pointsToMin = Math.max(0, overview.minExposureThreshold - overview.score);

	function handleDownloadPdf() {
		if (typeof window !== 'undefined') window.print();
	}

	return (
		<div
			className={`audit-report-section relative w-full max-w-full box-border overflow-hidden flex flex-col gap-5 rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-[#0E1140] via-[#1B1150] to-[#0A0C2E] p-6 ring-1 ${styles.ring}`}
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
					<p className="text-xs font-bold uppercase tracking-wide text-indigo-200/80">{t('summaryTitle')}</p>
					<div className="mt-1 flex flex-wrap items-center gap-3">
						<span className={`text-5xl font-extrabold tabular-nums ${styles.text}`}>{overview.score}</span>
						<span className="text-lg text-slate-400">{t('scoreSuffix')}</span>
						<span className={`rounded-full px-3 py-1 text-xs font-bold ${styles.badge}`}>
							{t('gradeLabel', { grade: overview.grade })}
						</span>
						<span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">
							{t('percentileLabel', { percentile: overview.percentile })}
						</span>
					</div>
					<p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">&ldquo;{overview.summary}&rdquo;</p>
				</div>

				<div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
					<svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
						<defs>
							<linearGradient id="geoScoreRing" x1="0%" y1="0%" x2="100%" y2="100%">
								<stop offset="0%" stopColor="#22d3ee" />
								<stop offset="100%" stopColor="#a855f7" />
							</linearGradient>
						</defs>
						<circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
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
					<p className="absolute text-xl font-bold text-white">{percent}%</p>
				</div>
			</div>

			<div className="relative rounded-xl border border-indigo-400/20 bg-black/25 p-4">
				<p className="text-xs font-bold text-indigo-200">{t('thresholdTitle')}</p>
				<div className="mt-3 grid gap-3 sm:grid-cols-2">
					<div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
						<p className="text-[10px] uppercase tracking-wide text-slate-500">{t('minExposureLabel')}</p>
						<p className="mt-1 text-sm font-semibold text-slate-200">
							{t('minExposureValue', { threshold: overview.minExposureThreshold })}
						</p>
						<p className={`mt-0.5 text-[11px] ${achievedMin ? 'text-emerald-400' : 'text-slate-400'}`}>
							{achievedMin ? t('minExposureAchieved') : t('minExposureShort', { points: pointsToMin })}
						</p>
					</div>
					<div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
						<p className="text-[10px] uppercase tracking-wide text-slate-500">{t('topRecommendationLabel')}</p>
						<p className="mt-1 text-sm font-semibold text-slate-200">
							{t('topRecommendationValue', { threshold: overview.topRecommendationThreshold })}
						</p>
						<p className="mt-0.5 text-[11px] text-cyan-300">
							{achievedTop ? t('topRecommendationAchieved') : t('topRecommendationHint', { points: overview.pointsToTop })}
						</p>
					</div>
				</div>
			</div>

			<div className="relative print:hidden flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<button
					type="button"
					onClick={handleDownloadPdf}
					className="w-fit rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-950/40 transition hover:from-cyan-400 hover:to-indigo-400"
				>
					{t('pdfButton')}
				</button>
				<p className="text-[11px] text-slate-500">{t('disclaimer')}</p>
			</div>
		</div>
	);
}

function clampPercent(score: number): number {
	return Math.min(100, Math.max(0, Math.round(score)));
}
