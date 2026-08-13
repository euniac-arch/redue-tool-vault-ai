'use client';

import { useTranslations } from 'next-intl';
import type { AuditOverallStatus, AuditReport } from '@/lib/site-auditor';

interface DualScoreSummaryHeaderProps {
	report: AuditReport;
	geoScore: number;
	geoGrade: string;
	geoPercentile: number;
	seoScore: number;
}

const SCHEMA_STATUS: Record<AuditOverallStatus, { text: string; badge: string; ring: string }> = {
	CRITICAL: { text: 'text-rose-400', badge: 'bg-rose-500 text-white', ring: 'ring-rose-400/40' },
	POOR: { text: 'text-rose-400', badge: 'bg-rose-500 text-white', ring: 'ring-rose-400/40' },
	FAIR: { text: 'text-amber-400', badge: 'bg-amber-500 text-black', ring: 'ring-amber-400/40' },
	GOOD: { text: 'text-emerald-400', badge: 'bg-emerald-500 text-black', ring: 'ring-emerald-400/40' },
	EXCELLENT: { text: 'text-emerald-400', badge: 'bg-emerald-500 text-black', ring: 'ring-emerald-400/40' },
};

const STATUS_ICONS: Record<AuditOverallStatus, string> = {
	CRITICAL: '🔴',
	POOR: '🔴',
	FAIR: '🟡',
	GOOD: '🟢',
	EXCELLENT: '🟢',
};

function geoGradeStyles(grade: string): { text: string; badge: string; ring: string } {
	if (grade === 'S' || grade === 'A+' || grade === 'A') {
		return {
			text: 'text-cyan-300',
			badge: 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/40',
			ring: 'ring-cyan-400/40',
		};
	}
	if (grade === 'B+' || grade === 'B') {
		return {
			text: 'text-indigo-300',
			badge: 'bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/40',
			ring: 'ring-indigo-400/40',
		};
	}
	if (grade === 'C+' || grade === 'C') {
		return {
			text: 'text-fuchsia-300',
			badge: 'bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-fuchsia-400/40',
			ring: 'ring-fuchsia-400/40',
		};
	}
	return {
		text: 'text-rose-400',
		badge: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/40',
		ring: 'ring-rose-400/40',
	};
}

function formatScore(n: number): string {
	return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function topPercentile(percentScore: number): number {
	return Math.min(99, Math.max(1, 100 - Math.round(percentScore)));
}

/**
 * Dual headline cards: AI-search trust (GEO /100) + on-page technical
 * optimization (SEO/GEO/Schema /100). The 122-point algorithm reading is a
 * compact footnote so it is never confused with the 100-point main score.
 */
export function DualScoreSummaryHeader({
	report,
	geoScore,
	geoGrade,
	geoPercentile,
	seoScore,
}: DualScoreSummaryHeaderProps) {
	const tGeo = useTranslations('audit.geoScore');
	const tDist = useTranslations('audit.scoreDistribution');

	const geoStyles = geoGradeStyles(geoGrade);
	const schemaStyles = SCHEMA_STATUS[report.status] ?? SCHEMA_STATUS.FAIR;
	const schemaPercentile = topPercentile(seoScore);

	return (
		<section className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2" aria-label={tDist('dualAriaLabel')}>
			{/* Left · AI search trust · GEO */}
			<article
				className={`relative flex h-full flex-col overflow-hidden rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-[#0E1140] via-[#1B1150] to-[#0A0C2E] p-5 ring-1 ${geoStyles.ring}`}
			>
				<div
					className="pointer-events-none absolute inset-0 opacity-35 print:hidden"
					style={{
						background:
							'radial-gradient(circle at 20% 20%, rgba(56,189,248,0.22), transparent 50%), radial-gradient(circle at 80% 10%, rgba(168,85,247,0.2), transparent 45%)',
					}}
				/>
				<div className="relative flex flex-1 flex-col gap-2">
					<p className="text-xs font-bold leading-snug tracking-wide text-indigo-200/85">
						{tDist('reputationCardTitle')}
					</p>
					<div className="flex flex-wrap items-end gap-2">
						<span className={`text-4xl font-extrabold tabular-nums sm:text-5xl ${geoStyles.text}`}>
							{geoScore}
						</span>
						<span className="mb-1 text-base text-slate-400">{tGeo('scoreSuffix')}</span>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<span className={`rounded-full px-3 py-1 text-xs font-bold ${geoStyles.badge}`}>
							{tGeo('gradeLabel', { grade: geoGrade })}
						</span>
						<span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">
							{tGeo('percentileLabel', { percentile: geoPercentile })}
						</span>
					</div>
					<p className="mt-1 text-xs leading-relaxed text-slate-400">{tDist('reputationCardSubtitle')}</p>
				</div>
			</article>

			{/* Right · Search technical optimization · SEO/GEO/Schema */}
			<article
				className={`flex h-full flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-950 via-[#0B1220] to-slate-900 p-5 ring-1 ${schemaStyles.ring}`}
			>
				<div className="flex flex-1 flex-col gap-2">
					<p className="text-xs font-bold leading-snug tracking-wide text-slate-400">
						{tDist('schemaCardTitle')}
					</p>
					<div className="flex flex-wrap items-end gap-2">
						<span className={`text-4xl font-extrabold tabular-nums sm:text-5xl ${schemaStyles.text}`}>
							{tDist('mainScoreUnit', { score: seoScore })}
						</span>
						<span className="mb-1 text-base text-slate-400">{tDist('mainScoreSuffix')}</span>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<span className={`rounded-full px-3 py-1 text-xs font-bold ${schemaStyles.badge}`}>
							{tDist('statusWithPercentile', {
								icon: STATUS_ICONS[report.status] ?? '🟡',
								status: report.statusLabel,
								percentile: schemaPercentile,
							})}
						</span>
					</div>
					<p className="mt-1 text-xs leading-relaxed text-slate-400">{tDist('schemaCardSubtitle')}</p>
				</div>
				<p
					className="mt-3 self-end text-right text-[10px] font-medium tabular-nums text-slate-500"
					title={tDist('algoTooltip')}
				>
					{tDist('algoBadgeCompact', {
						score: formatScore(report.score),
						max: report.maxScore,
					})}
				</p>
			</article>
		</section>
	);
}
