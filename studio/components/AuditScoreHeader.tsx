'use client';

import { useTranslations } from 'next-intl';
import type { AuditCategory, AuditOverallStatus, AuditReport } from '@/lib/site-auditor';

const STATUS_STYLES: Record<AuditOverallStatus, { text: string; bg: string; ring: string; badge: string }> = {
	CRITICAL: { text: 'text-rose-400', bg: 'bg-rose-500/10', ring: 'ring-rose-400/40', badge: 'bg-rose-500 text-white' },
	POOR: { text: 'text-rose-400', bg: 'bg-rose-500/10', ring: 'ring-rose-400/40', badge: 'bg-rose-500 text-white' },
	FAIR: { text: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-400/40', badge: 'bg-amber-500 text-black' },
	GOOD: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-400/40', badge: 'bg-emerald-500 text-black' },
	EXCELLENT: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-400/40', badge: 'bg-emerald-500 text-black' },
};

const STATUS_ICONS: Record<AuditOverallStatus, string> = {
	CRITICAL: '🔴',
	POOR: '🔴',
	FAIR: '🟡',
	GOOD: '🟢',
	EXCELLENT: '🟢',
};

interface AuditScoreHeaderProps {
	report: AuditReport;
}

/**
 * Fixed 1:1 theme per weighted category — identical across the top summary
 * cards and the 122pt weight-composition bar.
 * 1. SEO 기술 기본기 (29) → Blue · 2. 웹 성능 & 접근성 (30) → Emerald
 * 3. 스키마 구조화 데이터 (37) → Purple · 4. GEO & E-E-A-T 신호 (26) → Amber
 */
const CATEGORY_THEME: Record<
	string,
	{ bar: string; text: string; border: string; badgeBg: string; badgeText: string }
> = {
	seo: {
		bar: 'bg-blue-500',
		text: 'text-blue-400',
		border: 'border-blue-500/30',
		badgeBg: 'bg-blue-500/15',
		badgeText: 'text-blue-300',
	},
	'perf-a11y': {
		bar: 'bg-emerald-500',
		text: 'text-emerald-400',
		border: 'border-emerald-500/30',
		badgeBg: 'bg-emerald-500/15',
		badgeText: 'text-emerald-300',
	},
	schema: {
		bar: 'bg-purple-500',
		text: 'text-purple-400',
		border: 'border-purple-500/30',
		badgeBg: 'bg-purple-500/15',
		badgeText: 'text-purple-300',
	},
	geo: {
		bar: 'bg-amber-500',
		text: 'text-amber-400',
		border: 'border-amber-500/30',
		badgeBg: 'bg-amber-500/15',
		badgeText: 'text-amber-300',
	},
};

const DEFAULT_THEME = CATEGORY_THEME.seo;

function MetricCard({
	label,
	value,
	hint,
	theme,
	index,
}: {
	label: string;
	value: number;
	hint: string;
	theme: (typeof CATEGORY_THEME)[string];
	index: number;
}) {
	return (
		<div className={`rounded-xl border ${theme.border} bg-black/20 px-4 py-3`}>
			<div className="flex items-center justify-between gap-2">
				<p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
				<span
					className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${theme.badgeBg} ${theme.badgeText}`}
				>
					{index}
				</span>
			</div>
			<p className={`mt-1 text-2xl font-extrabold tabular-nums ${theme.text}`}>{value}</p>
			<p className="text-[11px] text-slate-500">{hint}</p>
		</div>
	);
}

function catById(categories: AuditCategory[], id: string): AuditCategory | undefined {
	return categories.find((c) => c.id === id);
}

function formatScore(n: number): string {
	return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function pctOf(score: number, max: number): number {
	if (max <= 0) return 0;
	return Math.min(100, Math.max(0, Math.round((score / max) * 100)));
}

/** Top-band percentile from a 0–100 score (e.g. 85 → top 15%). */
function topPercentile(percentScore: number): number {
	return Math.min(99, Math.max(1, 100 - Math.round(percentScore)));
}

interface DistRow {
	id: string;
	label: string;
	score: number;
	max: number;
	pct: number;
	bonus: boolean;
}

/** Groups the five live categories into the four weighted distribution buckets (29+30+37+26=122). */
function buildDistribution(report: AuditReport, labels: {
	seo: string;
	perfA11y: string;
	schema: string;
	geo: string;
}): DistRow[] {
	const seo = catById(report.categories, 'seo');
	const perf = catById(report.categories, 'performance');
	const a11y = catById(report.categories, 'accessibility');
	const schema = catById(report.categories, 'schema');
	const geo = catById(report.categories, 'geo');

	const seoScore = seo?.score ?? 0;
	const seoMax = seo?.maxScore ?? 29;
	const perfScore = perf?.score ?? 0;
	const perfMax = perf?.maxScore ?? 15;
	const a11yScore = a11y?.score ?? 0;
	const a11yMax = a11y?.maxScore ?? 15;
	const schemaScore = schema?.score ?? 0;
	const schemaMax = schema?.maxScore ?? 37;
	const geoScore = geo?.score ?? 0;
	const geoMax = geo?.maxScore ?? 26;
	const geoBonus = geoScore > geoMax;
	const geoComplete = pctOf(geoScore, geoMax) >= 100 || geoBonus;

	return [
		{
			id: 'seo',
			label: labels.seo,
			score: seoScore,
			max: seoMax,
			pct: pctOf(seoScore, seoMax),
			bonus: false,
		},
		{
			id: 'perf-a11y',
			label: labels.perfA11y,
			score: Math.round((perfScore + a11yScore) * 10) / 10,
			max: perfMax + a11yMax,
			pct: pctOf(perfScore + a11yScore, perfMax + a11yMax),
			bonus: false,
		},
		{
			id: 'schema',
			label: labels.schema,
			score: schemaScore,
			max: schemaMax,
			pct: pctOf(schemaScore, schemaMax),
			bonus: false,
		},
		{
			id: 'geo',
			label: labels.geo,
			score: geoScore,
			max: geoMax,
			pct: geoComplete ? 100 : pctOf(geoScore, geoMax),
			bonus: geoComplete,
		},
	];
}

export function AuditScoreHeader({ report }: AuditScoreHeaderProps) {
	const t = useTranslations('audit');
	const tDist = useTranslations('audit.scoreDistribution');
	const { score, maxScore, status, statusLabel } = report;
	const styles = STATUS_STYLES[status];
	const percent = maxScore > 0 ? Math.min(100, Math.max(0, Math.round((score / maxScore) * 100))) : 0;
	const percentile = topPercentile(percent);

	const rows = buildDistribution(report, {
		seo: tDist('seo'),
		perfA11y: tDist('perfA11y'),
		schema: tDist('schema'),
		geo: tDist('geo'),
	});

	const totalMax = rows.reduce((sum, r) => sum + r.max, 0);

	return (
		<div
			id="sec-scores"
			className={`scroll-mt-24 w-full max-w-full box-border flex flex-col gap-5 rounded-2xl border border-white/[0.08] ${styles.bg} p-6 ring-1 ${styles.ring}`}
		>
			<div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-col gap-1">
					<p className="text-xs uppercase tracking-wide text-slate-500">{t('scoreHeaderLabel')}</p>
					<div className="mt-2 flex flex-wrap items-end gap-2">
						<span className={`text-5xl font-extrabold tabular-nums ${styles.text}`}>
							{tDist('mainScoreUnit', { score: percent })}
						</span>
						<span className="mb-1 text-lg text-slate-400">{tDist('mainScoreSuffix')}</span>
					</div>
					<div className="mt-2 flex flex-wrap items-center gap-2">
						<span className={`rounded-full px-3 py-1 text-xs font-bold ${styles.badge}`}>
							{tDist('statusWithPercentile', {
								icon: STATUS_ICONS[status],
								status: statusLabel,
								percentile,
							})}
						</span>
						<span
							className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold text-cyan-200"
							title={tDist('algoTooltip')}
						>
							{tDist('algoBadge', { score: formatScore(score), max: maxScore })}
						</span>
					</div>
				</div>

				<div className="relative flex h-28 w-28 items-center justify-center">
					<svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
						<circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
						<circle
							cx="60"
							cy="60"
							r="52"
							fill="none"
							strokeWidth="12"
							strokeLinecap="round"
							className={styles.text}
							stroke="currentColor"
							strokeDasharray={`${(percent / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
						/>
					</svg>
					<p className="absolute text-xl font-bold text-white">{percent}%</p>
				</div>
			</div>

			{/* Top summary cards — four weighted categories */}
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{rows.map((row, index) => (
					<MetricCard
						key={row.id}
						label={row.label}
						value={row.pct}
						index={index + 1}
						theme={CATEGORY_THEME[row.id] ?? DEFAULT_THEME}
						hint={
							row.bonus
								? tDist('rowRawScoreBonus', { score: formatScore(row.score), max: row.max })
								: tDist('rowRawScore', { score: formatScore(row.score), max: row.max })
						}
					/>
				))}
			</div>

			{/* 122pt algorithm weight composition */}
			<div className="rounded-xl border border-white/[0.08] bg-black/25 p-4">
				<div className="flex flex-wrap items-start justify-between gap-2">
					<div>
						<p className="text-xs font-bold uppercase tracking-wide text-slate-300">{tDist('title')}</p>
						<p className="mt-1 text-[11px] leading-relaxed text-slate-500">{tDist('subtitle')}</p>
					</div>
					<span
						className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-200"
						title={tDist('totalTooltip')}
					>
						{tDist('totalBadge', { total: totalMax || maxScore })}
					</span>
				</div>

				{/* Weight composition bar: 29 + 30 + 37 + 26 */}
				<div
					className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
					title={tDist('totalTooltip')}
					role="img"
					aria-label={tDist('totalTooltip')}
				>
					{rows.map((row) => {
						const widthPct = totalMax > 0 ? (row.max / totalMax) * 100 : 25;
						const theme = CATEGORY_THEME[row.id] ?? DEFAULT_THEME;
						return (
							<div
								key={row.id}
								className={`${theme.bar} h-full first:rounded-l-full last:rounded-r-full`}
								style={{ width: `${widthPct}%` }}
							/>
						);
					})}
				</div>
			</div>
		</div>
	);
}
