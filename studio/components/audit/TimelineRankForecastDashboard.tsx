'use client';

import { useId, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

type TimelineKey = 'day0' | 'week1' | 'week2' | 'week4' | 'week8';
type MarkerKey = 'schema' | 'recrawl' | 'citation' | 'trust' | 'priority';
type StepTone = 'blue' | 'cyan' | 'purple' | 'emerald' | 'amber';

interface TimelineStep {
	id: TimelineKey;
	tone: StepTone;
}

interface ChartPoint {
	key: TimelineKey;
	week: number;
	geo: number;
	seo: number;
	marker: MarkerKey;
}

const STEPS: readonly TimelineStep[] = [
	{ id: 'day0', tone: 'blue' },
	{ id: 'week1', tone: 'cyan' },
	{ id: 'week2', tone: 'purple' },
	{ id: 'week4', tone: 'emerald' },
	{ id: 'week8', tone: 'amber' },
];

/** GEO: slow start, steep lift from week 2. SEO: steady climb. */
const CHART_POINTS: readonly ChartPoint[] = [
	{ key: 'day0', week: 0, geo: 10, seo: 24, marker: 'schema' },
	{ key: 'week1', week: 1, geo: 20, seo: 38, marker: 'recrawl' },
	{ key: 'week2', week: 2, geo: 54, seo: 52, marker: 'citation' },
	{ key: 'week4', week: 4, geo: 78, seo: 70, marker: 'trust' },
	{ key: 'week8', week: 8, geo: 93, seo: 86, marker: 'priority' },
];

const STEP_TONE: Record<
	StepTone,
	{ dot: string; ring: string; badge: string; card: string; title: string }
> = {
	blue: {
		dot: 'bg-blue-500 dark:bg-blue-400',
		ring: 'ring-blue-400/35',
		badge:
			'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-300',
		card: 'border-blue-200 bg-blue-50/80 hover:border-blue-300 dark:border-blue-500/20 dark:bg-blue-500/[0.06] dark:hover:border-blue-400/40',
		title: 'text-blue-800 dark:text-blue-200',
	},
	cyan: {
		dot: 'bg-cyan-500 dark:bg-cyan-400',
		ring: 'ring-cyan-400/35',
		badge:
			'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/30 dark:bg-cyan-500/10 dark:text-cyan-300',
		card: 'border-cyan-200 bg-cyan-50/80 hover:border-cyan-300 dark:border-cyan-500/20 dark:bg-cyan-500/[0.06] dark:hover:border-cyan-400/40',
		title: 'text-cyan-800 dark:text-cyan-200',
	},
	purple: {
		dot: 'bg-violet-500 dark:bg-violet-400',
		ring: 'ring-violet-400/35',
		badge:
			'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-300',
		card: 'border-violet-200 bg-violet-50/80 hover:border-violet-300 dark:border-violet-500/20 dark:bg-violet-500/[0.06] dark:hover:border-violet-400/40',
		title: 'text-violet-800 dark:text-violet-200',
	},
	emerald: {
		dot: 'bg-emerald-500 dark:bg-emerald-400',
		ring: 'ring-emerald-400/35',
		badge:
			'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-300',
		card: 'border-emerald-200 bg-emerald-50/80 hover:border-emerald-300 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06] dark:hover:border-emerald-400/40',
		title: 'text-emerald-800 dark:text-emerald-200',
	},
	amber: {
		dot: 'bg-amber-500 dark:bg-amber-400',
		ring: 'ring-amber-400/35',
		badge:
			'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300',
		card: 'border-amber-200 bg-amber-50/80 hover:border-amber-300 dark:border-amber-500/20 dark:bg-amber-500/[0.06] dark:hover:border-amber-400/40',
		title: 'text-amber-800 dark:text-amber-200',
	},
};

const VIEW_W = 720;
const VIEW_H = 280;
const PAD = { top: 28, right: 20, bottom: 40, left: 48 };
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;
const MAX_WEEK = 8;

function xOf(week: number): number {
	return PAD.left + (week / MAX_WEEK) * PLOT_W;
}

function yOf(value: number): number {
	return PAD.top + (1 - value / 100) * PLOT_H;
}

function toSmoothPath(points: { x: number; y: number }[]): string {
	if (points.length < 2) return '';
	let d = `M ${points[0].x} ${points[0].y}`;
	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[i === 0 ? 0 : i - 1];
		const p1 = points[i];
		const p2 = points[i + 1];
		const p3 = points[i + 2] ?? p2;
		const cp1x = p1.x + (p2.x - p0.x) / 6;
		const cp1y = p1.y + (p2.y - p0.y) / 6;
		const cp2x = p2.x - (p3.x - p1.x) / 6;
		const cp2y = p2.y - (p3.y - p1.y) / 6;
		d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
	}
	return d;
}

function areaPath(points: { x: number; y: number }[]): string {
	const line = toSmoothPath(points);
	const last = points[points.length - 1];
	const first = points[0];
	const base = PAD.top + PLOT_H;
	return `${line} L ${last.x} ${base} L ${first.x} ${base} Z`;
}

export function TimelineRankForecastDashboard({ embedded = false }: { embedded?: boolean }) {
	const t = useTranslations('audit.timelineForecast');
	const uid = useId().replace(/:/g, '');
	const geoGrad = `${uid}-geo`;
	const seoGrad = `${uid}-seo`;
	const geoFill = `${uid}-geo-fill`;
	const seoFill = `${uid}-seo-fill`;

	const [pinnedKey, setPinnedKey] = useState<TimelineKey | null>(null);
	const [hoveredKey, setHoveredKey] = useState<TimelineKey | null>(null);

	const activeChartKey = hoveredKey ?? pinnedKey;

	const plotted = useMemo(
		() =>
			CHART_POINTS.map((p) => ({
				...p,
				x: xOf(p.week),
				geoY: yOf(p.geo),
				seoY: yOf(p.seo),
			})),
		[],
	);

	const geoPath = useMemo(
		() => toSmoothPath(plotted.map((p) => ({ x: p.x, y: p.geoY }))),
		[plotted],
	);
	const seoPath = useMemo(
		() => toSmoothPath(plotted.map((p) => ({ x: p.x, y: p.seoY }))),
		[plotted],
	);
	const geoArea = useMemo(
		() => areaPath(plotted.map((p) => ({ x: p.x, y: p.geoY }))),
		[plotted],
	);
	const seoArea = useMemo(
		() => areaPath(plotted.map((p) => ({ x: p.x, y: p.seoY }))),
		[plotted],
	);

	const activePoint = plotted.find((p) => p.key === activeChartKey) ?? null;
	const yTicks = [0, 25, 50, 75, 100];

	const body = (
		<>
			<header>
				<h2
					id="ai-timeline-forecast-title"
					className="text-xl font-bold text-slate-900 dark:text-white"
				>
					{t('title')}
				</h2>
				<p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
			</header>

			{/* Interactive timeline — vertical on mobile, scroll on tablet, 5-col on lg+ */}
			<div className="mt-6 md:max-lg:-mx-1 md:max-lg:overflow-x-auto md:max-lg:px-1 md:max-lg:snap-x md:max-lg:snap-mandatory">
				<ol className="relative flex flex-col gap-0 md:w-max md:min-w-full md:flex-row md:items-stretch md:gap-0 lg:grid lg:w-auto lg:min-w-0 lg:grid-cols-5 lg:gap-2">
					<div
						className="pointer-events-none absolute bottom-0 left-[15px] top-0 w-px bg-gradient-to-b from-blue-400/50 via-violet-400/40 to-amber-400/50 md:hidden"
						aria-hidden
					/>
					<div
						className="pointer-events-none absolute left-[10%] right-[10%] top-[18px] hidden h-px bg-gradient-to-r from-blue-400/50 via-violet-400/40 to-amber-400/50 md:block"
						aria-hidden
					/>

					{STEPS.map((step) => {
						const tone = STEP_TONE[step.tone];
						const isActive = activeChartKey === step.id;
						return (
								<li
								key={step.id}
								className="relative flex gap-3 md:w-[200px] md:shrink-0 md:flex-col md:items-center md:gap-0 md:px-1 md:snap-start lg:w-auto lg:min-w-0 lg:px-0"
								onMouseEnter={() => setHoveredKey(step.id)}
								onMouseLeave={() => setHoveredKey(null)}
								onFocus={() => setHoveredKey(step.id)}
								onBlur={() => setHoveredKey(null)}
							>
								<div className="relative z-10 flex shrink-0 flex-col items-center pt-0.5 md:pt-0">
									<span
										className={`h-3.5 w-3.5 rounded-full ${tone.dot} shadow-[0_0_12px_rgba(148,163,184,0.35)] transition-transform dark:shadow-[0_0_12px_currentColor] ${
											isActive ? `scale-125 ring-4 ${tone.ring}` : 'ring-2 ring-white dark:ring-slate-900/80'
										}`}
										aria-hidden
									/>
								</div>

								<button
									type="button"
									className={`mb-4 w-full rounded-xl border p-3 text-left transition md:mb-0 md:mt-4 lg:p-2.5 ${tone.card} ${
										isActive ? 'ring-1 ring-white/10' : ''
									}`}
									onClick={() => setPinnedKey(step.id)}
								>
									<span
										className={`inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${tone.badge}`}
									>
										{t(`steps.${step.id}.when`)}
										{t(`steps.${step.id}.phase`) ? (
											<span className="font-semibold normal-case tracking-normal opacity-80">
												· {t(`steps.${step.id}.phase`)}
											</span>
										) : null}
									</span>
									<p className={`mt-1.5 break-keep text-xs font-bold leading-snug lg:text-xs xl:text-sm ${tone.title}`}>
										{t(`steps.${step.id}.title`)}
									</p>
									<p className="mt-1 break-keep text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
										{t(`steps.${step.id}.desc`)}
									</p>
								</button>
							</li>
						);
					})}
				</ol>
			</div>

			{/* Exposure forecast chart */}
			<div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/40 sm:p-4">
				<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
					<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
						{t('chart.yAxis')}
					</p>
					<ul className="flex flex-wrap items-center gap-3 text-[11px] font-semibold">
						<li className="inline-flex items-center gap-1.5 text-violet-700 dark:text-violet-300">
							<span className="h-0.5 w-4 rounded-full bg-gradient-to-r from-violet-500 to-indigo-400" aria-hidden />
							{t('chart.geo')}
						</li>
						<li className="inline-flex items-center gap-1.5 text-sky-700 dark:text-cyan-300">
							<span className="h-0.5 w-4 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400" aria-hidden />
							{t('chart.seo')}
						</li>
					</ul>
				</div>

				<div className="relative min-w-[560px] pt-2">
					<svg
						viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
						className="h-auto w-full"
						role="img"
						aria-label={t('chart.ariaLabel')}
					>
						<defs>
							<linearGradient id={geoGrad} x1="0" y1="0" x2="1" y2="0">
								<stop offset="0%" stopColor="#8b5cf6" />
								<stop offset="100%" stopColor="#6366f1" />
							</linearGradient>
							<linearGradient id={seoGrad} x1="0" y1="0" x2="1" y2="0">
								<stop offset="0%" stopColor="#0ea5e9" />
								<stop offset="100%" stopColor="#22d3ee" />
							</linearGradient>
							<linearGradient id={geoFill} x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.28" />
								<stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
							</linearGradient>
							<linearGradient id={seoFill} x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="#22d3ee" stopOpacity="0.18" />
								<stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
							</linearGradient>
						</defs>

						{yTicks.map((tick) => (
							<g key={tick}>
								<line
									x1={PAD.left}
									x2={VIEW_W - PAD.right}
									y1={yOf(tick)}
									y2={yOf(tick)}
									stroke="currentColor"
									className="text-slate-200 dark:text-slate-700/80"
									strokeDasharray={tick === 0 ? undefined : '3 4'}
									strokeWidth="1"
								/>
								<text
									x={PAD.left - 8}
									y={yOf(tick) + 3}
									textAnchor="end"
									className="fill-slate-400 dark:fill-slate-500"
									fontSize="10"
								>
									{tick}%
								</text>
							</g>
						))}

						<path d={seoArea} fill={`url(#${seoFill})`} />
						<path d={geoArea} fill={`url(#${geoFill})`} />
						<path
							d={seoPath}
							fill="none"
							stroke={`url(#${seoGrad})`}
							strokeWidth="2.4"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						<path
							d={geoPath}
							fill="none"
							stroke={`url(#${geoGrad})`}
							strokeWidth="2.6"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>

						{plotted.map((p) => {
							const isHot = activeChartKey === p.key;
							return (
								<g
									key={p.key}
									className="cursor-pointer"
									onMouseEnter={() => setHoveredKey(p.key)}
									onMouseLeave={() => setHoveredKey(null)}
									onFocus={() => setHoveredKey(p.key)}
									onBlur={() => setHoveredKey(null)}
								>
									<line
										x1={p.x}
										x2={p.x}
										y1={PAD.top}
										y2={PAD.top + PLOT_H}
										stroke="currentColor"
										className={isHot ? 'text-slate-400/50 dark:text-white/15' : 'text-transparent'}
										strokeDasharray="2 4"
									/>
									<circle
										cx={p.x}
										cy={p.seoY}
										r={isHot ? 5.5 : 4}
										fill="#0f172a"
										stroke="#22d3ee"
										strokeWidth="2"
									/>
									<circle
										cx={p.x}
										cy={p.geoY}
										r={isHot ? 5.5 : 4}
										fill="#0f172a"
										stroke="#8b5cf6"
										strokeWidth="2"
									/>
									<rect
										x={p.x - 18}
										y={PAD.top}
										width="36"
										height={PLOT_H}
										fill="transparent"
									/>
									<text
										x={p.x}
										y={VIEW_H - 12}
										textAnchor="middle"
										className={`text-[10px] ${isHot ? 'fill-slate-200' : 'fill-slate-400 dark:fill-slate-500'}`}
										fontSize="10"
										fontWeight={isHot ? 700 : 500}
									>
										{t(`chart.x.${p.key}`)}
									</text>
								</g>
							);
						})}
					</svg>

					{activePoint ? (
						<div
							className={`pointer-events-none absolute z-10 w-[220px] -translate-x-1/2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-950/95 dark:shadow-black/40 ${
								Math.min(activePoint.geoY, activePoint.seoY) < PAD.top + 64
									? 'translate-y-2'
									: '-translate-y-full'
							}`}
							style={{
								left: `${Math.min(86, Math.max(16, (activePoint.x / VIEW_W) * 100))}%`,
								top: `${(Math.min(activePoint.geoY, activePoint.seoY) / VIEW_H) * 100}%`,
								marginTop: Math.min(activePoint.geoY, activePoint.seoY) < PAD.top + 64 ? '8px' : '-10px',
							}}
							role="tooltip"
						>
							<p className="text-[11px] font-bold text-slate-800 dark:text-slate-100">
								{t(`chart.markers.${activePoint.marker}`)}
							</p>
							<p className="mt-1.5 text-[11px] text-violet-700 dark:text-violet-300">
								{t('chart.geo')} · {activePoint.geo}%
							</p>
							<p className="text-[11px] text-sky-700 dark:text-cyan-300">
								{t('chart.seo')} · {activePoint.seo}%
							</p>
						</div>
					) : null}
				</div>
			</div>

			<p className="mt-4 break-keep text-[11px] leading-relaxed text-slate-500 dark:text-slate-500">
				{t('footnote')}
			</p>
		</>
	);

	if (embedded) {
		return <div className="flex flex-col">{body}</div>;
	}

	return (
		<section
			id="ai-timeline-forecast"
			className="print:hidden pdf-screen-only scroll-mt-24 rounded-xl border border-slate-200 bg-slate-50/80 p-6 dark:border-slate-800 dark:bg-slate-900/40"
			aria-labelledby="ai-timeline-forecast-title"
		>
			{body}
		</section>
	);
}
