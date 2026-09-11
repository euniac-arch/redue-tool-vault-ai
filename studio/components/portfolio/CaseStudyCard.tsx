'use client';

import { ArrowRight, ExternalLink, FlaskConical } from 'lucide-react';
import type { CaseStudyAxis, CaseStudyData } from '@/lib/case-study-types';

interface CaseStudyCardProps {
	data: CaseStudyData;
	/** Override auto-derived outcome pills (e.g. "SEO 최적화 완료"). */
	outcomeLabels?: string[];
	/** Diagnostic report URL. Defaults to `/portfolio/case-study/{id}`. */
	resultHref?: string;
	/** Opens the executive-summary layer instead of navigating away. */
	onViewResult?: (data: CaseStudyData) => void;
}

const AXIS_SHORT_LABELS: Record<string, string> = {
	seo: 'SEO',
	cwv: 'CWV',
	performance: 'CWV',
	schema: 'Schema',
	geo: 'GEO',
};

function formatScore(n: number): string {
	return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function deriveOutcomeLabels(data: CaseStudyData): string[] {
	const labels: string[] = [];
	const seo = data.axes.find((axis) => axis.key === 'seo');
	const schema = data.axes.find((axis) => axis.key === 'schema');

	if (seo && seo.after.score >= 85) labels.push('SEO 최적화 완료');
	if (schema && schema.after.score >= 100) labels.push('Schema 100%');
	else if (schema && schema.after.score >= 80) labels.push('Schema 주입 완료');

	return labels;
}

function isMassiveJump(axis: CaseStudyAxis): boolean {
	const delta = axis.after.score - axis.before.score;
	return delta >= 80 || (axis.key === 'schema' && axis.before.score === 0 && axis.after.score >= 90);
}

/**
 * Horizontal list-item case study card — identity, hero Before→After score,
 * a compact 4-axis breakdown, and a pinned diagnostic-result CTA.
 */
export function CaseStudyCard({ data, outcomeLabels, onViewResult }: CaseStudyCardProps) {
	const { siteInfo, normalizedScore } = data;
	const verified = data.kind === 'verified';
	const lift = Number((normalizedScore.after.score - normalizedScore.before.score).toFixed(1));
	const pills = outcomeLabels ?? deriveOutcomeLabels(data);

	return (
		<article
			className={`group relative mt-3 flex flex-col justify-between overflow-visible rounded-2xl px-5 pb-5 pt-8 backdrop-blur-md transition-all duration-300 sm:px-6 sm:pb-6 ${
				verified
					? 'border-2 border-cyan-400/80 bg-gradient-to-br from-cyan-50/90 via-white to-white shadow-[0_0_36px_rgba(6,182,212,0.28)] hover:border-cyan-300 hover:shadow-[0_0_52px_rgba(6,182,212,0.42)] dark:border-cyan-400/70 dark:from-cyan-950/40 dark:via-[#0B1120]/85 dark:to-[#0B1120]/85 dark:shadow-[0_0_40px_rgba(6,182,212,0.28)] dark:hover:border-cyan-300/80 dark:hover:shadow-[0_0_56px_rgba(6,182,212,0.4)]'
					: 'border border-slate-200 bg-white/80 shadow-sm hover:border-cyan-400/50 hover:bg-white/60 hover:shadow-[0_0_40px_rgba(6,182,212,0.16)] dark:border-slate-800/80 dark:bg-[#0B1120]/70 dark:shadow-none dark:hover:border-cyan-400/40 dark:hover:bg-[#0E162B]/75'
			}`}
			aria-label={
				data.hasBaseline !== false
					? `${siteInfo.name} 진단 점수 ${formatScore(normalizedScore.before.score)}점에서 ${formatScore(normalizedScore.after.score)}점으로 ${formatScore(lift)}점 상승`
					: `${siteInfo.name} 최신 진단 점수 ${formatScore(normalizedScore.after.score)}점 · 최초 진단 이력 없음`
			}
		>
			<div
				className={`pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(6,182,212,0.14),transparent_68%)] transition-opacity duration-300 ${
					verified ? 'opacity-70 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
				}`}
				aria-hidden="true"
			/>
			<div
				className={`pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-2xl bg-gradient-to-b from-transparent via-cyan-400 to-transparent transition-opacity duration-300 ${
					verified ? 'opacity-90' : 'w-px opacity-60 group-hover:opacity-100'
				}`}
				aria-hidden="true"
			/>

			{verified ? (
				<span className="absolute -top-3.5 left-6 z-10 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/50 bg-[#0b1324] px-3.5 py-1 text-xs font-bold text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
					<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
					Verified Real Case
				</span>
			) : (
				<span className="absolute -top-3.5 left-6 z-10 inline-flex items-center gap-1.5 rounded-full border border-slate-500/50 bg-[#0b1324] px-3.5 py-1 text-xs font-bold text-slate-300 shadow-[0_0_15px_rgba(15,23,42,0.35)]">
					<FlaskConical className="h-3 w-3" strokeWidth={2} aria-hidden />
					업종별 시뮬레이션 모델
				</span>
			)}

			<div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.15fr)_minmax(0,1.25fr)] lg:items-stretch lg:gap-8">
				<IdentityColumn
					siteInfo={siteInfo}
					pills={pills}
					onViewResult={onViewResult ? () => onViewResult(data) : undefined}
				/>
				<HeroMetric
					before={normalizedScore.before.score}
					after={normalizedScore.after.score}
					maxScore={normalizedScore.after.maxScore}
					lift={lift}
					verified={verified}
					hasBaseline={data.hasBaseline !== false}
				/>
				<AxisMiniBreakdown axes={data.axes} hasBaseline={data.hasBaseline !== false} />
			</div>
		</article>
	);
}

function IdentityColumn({
	siteInfo,
	pills,
	onViewResult,
}: {
	siteInfo: CaseStudyData['siteInfo'];
	pills: string[];
	onViewResult?: () => void;
}) {
	return (
		<div className="flex h-full min-w-0 flex-col justify-center py-1 pl-2.5 lg:pr-2">
			<div>
				<div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
					{siteInfo.category}
				</div>
				<h3 className="mb-1 truncate text-2xl font-black leading-snug tracking-tight text-slate-900 dark:text-white md:text-[26px]">
					{siteInfo.name}
				</h3>
				<a
					href={siteInfo.domainUrl || `https://${siteInfo.domain}`}
					target="_blank"
					rel="noreferrer"
					className="group mb-3.5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-300"
				>
					<span>{siteInfo.domain}</span>
					<ExternalLink className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-cyan-500 dark:text-slate-500 dark:group-hover:text-cyan-300" aria-hidden />
				</a>

				<div className="flex flex-col gap-2">
					{siteInfo.techStack ? (
						<div>
							<span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 shadow-inner dark:border-slate-700/80 dark:bg-slate-800/90 dark:text-slate-200">
								{siteInfo.techStack}
							</span>
						</div>
					) : null}
					{pills.length > 0 ? (
						<div className="flex flex-wrap items-center gap-2">
							{pills.map((label) => (
								<span
									key={label}
									className={
										label.startsWith('Schema')
											? 'inline-flex items-center rounded-md border border-blue-500/40 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
											: 'inline-flex items-center rounded-md border border-cyan-500/40 bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300'
									}
								>
									{label}
								</span>
							))}
						</div>
					) : null}
				</div>
			</div>

			<div className="grid grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-out md:grid-rows-[0fr] md:group-hover:grid-rows-[1fr]">
				<div className="overflow-hidden">
					<div className="pt-4">
						<button
							type="button"
							aria-label={`${siteInfo.name} 진단 결과보기`}
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								onViewResult?.();
							}}
							className="group/btn inline-flex items-center gap-2 rounded-xl border border-blue-600 bg-blue-600 px-4 py-2 text-xs font-bold tracking-wide text-white opacity-100 shadow-md transition-all duration-200 ease-out hover:bg-blue-700 hover:shadow-md dark:border-slate-700/70 dark:bg-slate-900/90 dark:text-slate-300 dark:shadow-md dark:backdrop-blur-md dark:hover:border-cyan-400/60 dark:hover:bg-cyan-950/50 dark:hover:text-cyan-200 dark:hover:shadow-[0_0_18px_rgba(6,182,212,0.2)] md:text-sm md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100"
						>
							<span className="h-1.5 w-1.5 rounded-full bg-white shadow-none dark:bg-cyan-400 dark:shadow-[0_0_6px_#22d3ee]" aria-hidden />
							<span>진단 결과보기</span>
							<ArrowRight
								className="h-3.5 w-3.5 text-white transition-transform duration-200 group-hover/btn:translate-x-1 dark:text-cyan-400"
								strokeWidth={2.25}
								aria-hidden
							/>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

function HeroMetric({
	before,
	after,
	maxScore,
	lift,
	verified,
	hasBaseline,
}: {
	before: number;
	after: number;
	maxScore: number;
	lift: number;
	verified: boolean;
	hasBaseline: boolean;
}) {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-3 border-y border-slate-200 py-4 dark:border-slate-800/80 lg:border-x lg:border-y-0 lg:px-4 lg:py-0">
			<div className="flex items-end justify-center gap-3 sm:gap-5">
				<div className="flex flex-col items-center">
					<span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Before</span>
					<p className="mt-1.5 flex items-baseline gap-1 font-mono leading-none">
						<span className="text-2xl font-semibold tabular-nums text-slate-500 sm:text-[28px]">
							{hasBaseline ? formatScore(before) : '—'}
						</span>
						{hasBaseline ? (
							<span className="text-[11px] font-medium text-slate-600">/ {maxScore}</span>
						) : null}
					</p>
				</div>

				<div
					className="mb-1.5 flex items-center text-emerald-400/70 transition-transform duration-300 group-hover:translate-x-1"
					aria-hidden="true"
				>
					<span className="h-px w-4 bg-gradient-to-r from-slate-600 to-emerald-400 sm:w-6" />
					<ArrowRight className="h-5 w-5" strokeWidth={2.25} />
				</div>

				<div className="flex flex-col items-center">
					<span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400/80">After</span>
					<p className="mt-1.5 flex items-baseline gap-1.5 font-mono leading-none">
						<span
							className="relative bg-gradient-to-br from-emerald-200 via-emerald-400 to-teal-300 bg-clip-text text-4xl font-extrabold tabular-nums text-transparent [text-shadow:0_0_18px_rgba(52,211,153,0.45)] sm:text-5xl"
						>
							{formatScore(after)}
						</span>
						<span className="text-sm font-semibold text-emerald-500/70">/ {maxScore}</span>
					</p>
				</div>
			</div>

			{hasBaseline && lift > 0 ? (
				<span
					className={
						verified
							? 'verified-case-glow inline-flex items-center gap-1 rounded-md border border-cyan-400/70 bg-cyan-500/20 px-3.5 py-1.5 text-sm font-extrabold text-cyan-600 dark:text-cyan-200'
							: 'inline-flex items-center gap-1 rounded-md border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-500 dark:text-cyan-400'
					}
				>
					🚀 +{formatScore(lift)}pt 상승
				</span>
			) : !hasBaseline ? (
				<span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
					최초 진단 이력 없음 · After만 표시
				</span>
			) : null}
		</div>
	);
}

function AxisMiniBreakdown({ axes, hasBaseline }: { axes: CaseStudyAxis[]; hasBaseline: boolean }) {
	return (
		<div className="flex h-full flex-col justify-center gap-2.5">
			{axes.map((axis) => {
				const highlight = hasBaseline && isMassiveJump(axis);
				return (
					<div
						key={axis.key}
						className={`rounded-lg px-2.5 py-1.5 transition-colors ${
							highlight
								? 'border border-cyan-500/20 bg-cyan-500/10'
								: 'border border-slate-200 bg-slate-50 dark:border-slate-800/80 dark:bg-slate-900/60'
						}`}
					>
						<div className="flex items-center justify-between gap-3">
							<span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
								{AXIS_SHORT_LABELS[axis.key] ?? axis.label}
								{highlight ? (
									<span className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-cyan-400">
										MAX
									</span>
								) : null}
							</span>
							<span className="font-mono text-[11px] tabular-nums">
								<span className={highlight ? 'text-rose-400/80' : 'text-slate-500'}>
									{hasBaseline ? formatScore(axis.before.score) : '—'}
								</span>
								<span className="mx-1 text-slate-600">➔</span>
								<span className="font-bold text-emerald-600 dark:text-emerald-400">{formatScore(axis.after.score)}</span>
							</span>
						</div>
						<div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.06]">
							<div
								className="absolute inset-y-0 left-0 rounded-full bg-slate-500/45"
								style={{ width: `${Math.min(axis.before.score, 100)}%` }}
							/>
							<div
								className={`absolute inset-y-0 left-0 rounded-full ${
									highlight
										? 'bg-gradient-to-r from-emerald-500 to-teal-300'
										: 'bg-emerald-500'
								}`}
								style={{ width: `${Math.min(axis.after.score, 100)}%` }}
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
}
