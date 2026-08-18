'use client';

import { useTranslations } from 'next-intl';
import { CategoryScoreSection } from '@/components/audit/CategoryScoreSection';
import { ScoreGradeBadge } from '@/components/audit/ScoreGradeBadge';
import { gradeThemeFromScore } from '@/lib/audit/score-grade';
import {
	GROUP_MAX_SCORES,
	ONPAGE_MAX_SCORE,
	formatRawScore,
	normalizeScore100,
	type OnPageDiagnosticProps,
} from '@/lib/audit/onpage-diagnostic';
import type { AuditScores } from '@/lib/audit/scoreCalculator';

interface AuditScoreHeaderProps {
	diagnostic: OnPageDiagnosticProps;
	/** Unified packet from `buildDiagnosisScoreSnapshot` — render as-is. */
	scores: AuditScores;
}

export function AuditScoreHeader({ diagnostic, scores }: AuditScoreHeaderProps) {
	const t = useTranslations('audit');
	const tDist = useTranslations('audit.scoreDistribution');
	const tGeo = useTranslations('audit.geoScore');
	const totalRawScore = scores.rawScore122;
	const maxPossibleScore = scores.maxRawScore || ONPAGE_MAX_SCORE;
	const normalizedScore = scores.technicalScore;
	const percentile = scores.technicalPercentile;
	const styles = gradeThemeFromScore(normalizedScore);
	const scaleCopy = {
		max: maxPossibleScore,
		security: GROUP_MAX_SCORES.security,
		webPerf: GROUP_MAX_SCORES.performance,
		seo: GROUP_MAX_SCORES.seo,
		perfA11y: GROUP_MAX_SCORES.performance,
		perf: GROUP_MAX_SCORES.performance,
		a11y: GROUP_MAX_SCORES.performance,
		schema: GROUP_MAX_SCORES.schema,
		geo: GROUP_MAX_SCORES.geo,
	};

	return (
		<div
			id="technical-score-summary"
			className={`pdf-page-item scroll-mt-24 w-full max-w-full box-border flex flex-col gap-5 rounded-2xl border border-slate-200 dark:border-white/[0.08] ${styles.bg} p-6 ring-1 ${styles.ring}`}
		>
			<div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-col gap-1">
					<p className="text-xs uppercase tracking-wide text-slate-500">{t('scoreHeaderLabel')}</p>
					<div className="mt-2 flex flex-wrap items-end gap-2">
						<span className={`text-5xl font-extrabold tabular-nums ${styles.text}`}>
							{tDist('mainScoreUnit', { score: normalizedScore })}
						</span>
						<span className="mb-1 text-lg text-slate-600 dark:text-slate-400">{tDist('mainScoreSuffix')}</span>
					</div>
					{/* <p
						className="mt-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400"
						title={tDist('weightedConversionTooltip', scaleCopy)}
					>
						{tDist('weightedConversion', {
							score: formatRawScore(totalRawScore),
							max: maxPossibleScore,
							pct: normalizedScore,
						})}
					</p> */}
					<div className="mt-2 flex flex-wrap items-center gap-2">
						<ScoreGradeBadge
							score={normalizedScore}
							size="md"
							isHttps={scores.isHttps}
							securityCapped={scores.securityCapped}
						/>
						<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800 dark:bg-white/10 dark:text-slate-200">
							{tGeo('percentileLabel', { percentile })}
						</span>
						<span
							className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
							title={tDist('algoTooltip', scaleCopy)}
						>
							{tDist('algoBadge', {
								score: formatRawScore(totalRawScore),
								max: maxPossibleScore,
								pct: normalizeScore100(totalRawScore, maxPossibleScore),
							})}
						</span>
					</div>
				</div>

				<div className="relative flex h-28 w-28 items-center justify-center">
					<svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
						<circle cx="60" cy="60" r="52" fill="none" className="stroke-slate-200 dark:stroke-white/10" strokeWidth="12" />
						<circle
							cx="60"
							cy="60"
							r="52"
							fill="none"
							strokeWidth="12"
							strokeLinecap="round"
							className={styles.text}
							stroke="currentColor"
							strokeDasharray={`${(normalizedScore / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
						/>
					</svg>
					<p className="absolute text-xl font-bold text-slate-900 dark:text-white">{normalizedScore}%</p>
				</div>
			</div>

			<CategoryScoreSection diagnostic={diagnostic} scores={scores} />

			<div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/25 p-4">
				<div className="flex flex-wrap items-start justify-between gap-2">
					<div>
						<p className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">{tDist('title', scaleCopy)}</p>
						<p className="mt-1 text-[11px] leading-relaxed text-slate-500">{tDist('subtitle', scaleCopy)}</p>
					</div>
					<span
						className="rounded-full border border-cyan-200 dark:border-cyan-400/30 bg-cyan-50 dark:bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-800 dark:text-cyan-200"
						title={tDist('totalTooltip', scaleCopy)}
					>
						{tDist('totalBadge', { total: maxPossibleScore })}
					</span>
				</div>
			</div>
		</div>
	);
}
