'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { CaseStudyAxis, CaseStudyData } from '@/lib/case-study-types';

interface CaseStudyCardProps {
	data: CaseStudyData;
	/** Override auto-derived outcome pills (e.g. "SEO 최적화 완료"). */
	outcomeLabels?: string[];
	/** Diagnostic report URL. Defaults to `/portfolio/case-study/{id}`. */
	resultHref?: string;
}

const AXIS_SHORT_LABELS: Record<string, string> = {
	seo: 'SEO',
	performance: 'Performance',
	schema: 'Schema',
	geo: 'GEO & E-E-A-T',
};

const PREMIUM_EASE = [0.22, 1, 0.36, 1] as const;

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

/** Fine-pointer hover devices start with the CTA collapsed (matches the clean snapshot). */
function useFinePointerHover(): boolean {
	const [matches, setMatches] = useState(true);

	useEffect(() => {
		const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
		const sync = () => setMatches(mq.matches);
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	}, []);

	return matches;
}

/**
 * Horizontal list-item case study card — identity, hero Before→After score,
 * a compact 4-axis breakdown, and a hover-revealed diagnostic-result CTA.
 */
export function CaseStudyCard({ data, outcomeLabels, resultHref }: CaseStudyCardProps) {
	const { siteInfo, normalizedScore } = data;
	const lift = Number((normalizedScore.after.score - normalizedScore.before.score).toFixed(1));
	const pills = outcomeLabels ?? deriveOutcomeLabels(data);
	const href = resultHref ?? `/portfolio/case-study/${data.id}`;

	const [hovered, setHovered] = useState(false);
	const canHover = useFinePointerHover();
	const reduceMotion = useReducedMotion();
	const revealed = Boolean(reduceMotion) || !canHover || hovered;
	const instant = Boolean(reduceMotion);

	return (
		<article
			className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800/80 bg-[#0B1120]/80 p-5 backdrop-blur-sm transition-all duration-200 hover:border-cyan-500/40 hover:bg-[#0E162B] hover:shadow-[0_8px_30px_rgba(6,182,212,0.08)] sm:p-6"
			aria-label={`${siteInfo.name} 진단 점수 ${formatScore(normalizedScore.before.score)}점에서 ${formatScore(normalizedScore.after.score)}점으로 ${formatScore(lift)}점 상승`}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			onFocusCapture={() => setHovered(true)}
			onBlurCapture={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
					setHovered(false);
				}
			}}
		>
			<div
				className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(6,182,212,0.08),transparent_68%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
				aria-hidden="true"
			/>
			<div
				className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-cyan-400/50 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-100"
				aria-hidden="true"
			/>

			<div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.15fr)_minmax(0,1.25fr)] lg:items-center lg:gap-8">
				<IdentityColumn
					siteInfo={siteInfo}
					pills={pills}
					resultHref={href}
					revealed={revealed}
					instant={instant}
				/>
				<HeroMetric
					before={normalizedScore.before.score}
					after={normalizedScore.after.score}
					maxScore={normalizedScore.after.maxScore}
					lift={lift}
				/>
				<AxisMiniBreakdown axes={data.axes} />
			</div>
		</article>
	);
}

function IdentityColumn({
	siteInfo,
	pills,
	resultHref,
	revealed,
	instant,
}: {
	siteInfo: CaseStudyData['siteInfo'];
	pills: string[];
	resultHref: string;
	revealed: boolean;
	instant: boolean;
}) {
	const expandTransition = instant ? { duration: 0 } : { duration: 0.48, ease: PREMIUM_EASE };
	const fadeTransition = instant
		? { duration: 0 }
		: { duration: 0.4, delay: revealed ? 0.08 : 0, ease: PREMIUM_EASE };

	return (
		<motion.div
			className="flex min-w-0 flex-col justify-center lg:pr-2"
			initial={false}
			animate={{
				paddingBottom: revealed ? 6 : 0,
				gap: revealed ? 14 : 12,
			}}
			transition={expandTransition}
		>
			<span className="w-fit rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-bold tracking-wide text-cyan-400">
				{siteInfo.category}
			</span>
			<div className="min-w-0">
				<h3 className="truncate text-xl font-extrabold tracking-tight text-white sm:text-2xl">
					{siteInfo.name}
				</h3>
				<p className="mt-1 font-mono text-xs text-slate-500">{siteInfo.domain}</p>
			</div>
			<div className="flex flex-wrap gap-1.5">
				{siteInfo.techStack ? (
					<span className="rounded-md border border-slate-800 bg-slate-900/90 px-2.5 py-1 text-xs text-slate-300">
						{siteInfo.techStack}
					</span>
				) : null}
				{pills.map((label) => (
					<span
						key={label}
						className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-400"
					>
						{label}
					</span>
				))}
			</div>

			<motion.div
				initial={false}
				animate={{ height: revealed ? 'auto' : 0 }}
				transition={expandTransition}
				className="overflow-hidden"
			>
				<motion.div
					initial={false}
					animate={{ opacity: revealed ? 1 : 0, y: revealed ? 0 : 10 }}
					transition={fadeTransition}
					className="pt-1"
					style={{ pointerEvents: revealed ? 'auto' : 'none' }}
				>
					<Link
						href={resultHref}
						aria-label={`${siteInfo.name} 진단 결과보기`}
						className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-500 hover:bg-cyan-500 hover:text-slate-950 sm:text-sm"
					>
						진단 결과보기
						<ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
					</Link>
				</motion.div>
			</motion.div>
		</motion.div>
	);
}

function HeroMetric({
	before,
	after,
	maxScore,
	lift,
}: {
	before: number;
	after: number;
	maxScore: number;
	lift: number;
}) {
	return (
		<div className="flex flex-col items-center justify-center gap-3 border-y border-slate-800/80 py-4 lg:border-x lg:border-y-0 lg:px-4 lg:py-0">
			<div className="flex items-end justify-center gap-3 sm:gap-5">
				<div className="flex flex-col items-center">
					<span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Before</span>
					<p className="mt-1.5 flex items-baseline gap-1 font-mono leading-none">
						<span className="text-2xl font-semibold tabular-nums text-slate-500 sm:text-[28px]">
							{formatScore(before)}
						</span>
						<span className="text-[11px] font-medium text-slate-600">/ {maxScore}</span>
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
						<span className="relative inline-block">
							<span
								className="absolute inset-0 bg-gradient-to-br from-emerald-300 to-teal-300 bg-clip-text text-4xl font-extrabold tabular-nums text-transparent blur-[10px] opacity-80 sm:text-5xl"
								aria-hidden="true"
							>
								{formatScore(after)}
							</span>
							<span className="relative bg-gradient-to-br from-emerald-200 via-emerald-400 to-teal-300 bg-clip-text text-4xl font-extrabold tabular-nums text-transparent sm:text-5xl">
								{formatScore(after)}
							</span>
						</span>
						<span className="text-sm font-semibold text-emerald-500/70">/ {maxScore}</span>
					</p>
				</div>
			</div>

			<span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-400">
				🚀 +{formatScore(lift)}pt 상승
			</span>
		</div>
	);
}

function AxisMiniBreakdown({ axes }: { axes: CaseStudyAxis[] }) {
	return (
		<div className="flex flex-col gap-2.5">
			{axes.map((axis) => {
				const highlight = isMassiveJump(axis);
				return (
					<div
						key={axis.key}
						className={`rounded-lg px-2.5 py-1.5 transition-colors ${
							highlight
								? 'border border-cyan-500/20 bg-cyan-500/10'
								: 'border border-slate-800/80 bg-slate-900/60'
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
									{formatScore(axis.before.score)}
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
