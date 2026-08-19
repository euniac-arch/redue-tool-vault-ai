'use client';

import { useId, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	LabelList,
	PolarAngleAxis,
	PolarGrid,
	PolarRadiusAxis,
	Radar,
	RadarChart,
	ReferenceLine,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { SafeResponsiveContainer } from '@/components/charts/SafeResponsiveContainer';
import { gradeQualifierKey, type ScoreGrade } from '@/lib/audit/score-grade';

export interface CoreScoreBarChartProps {
	overallScore: number;
	aiTrustScore: number;
	techSeoScore: number;
}

type ChartRow = {
	key: 'overall' | 'aiTrust' | 'techSeo';
	name: string;
	fullName: string;
	score: number;
	desc: string;
	grade: ScoreGrade;
	gradientId: string;
	chip: string;
};

type ChartView = 'bar' | 'radar';

type TooltipContentProps = {
	active?: boolean;
	payload?: Array<{ payload?: ChartRow }>;
};

export const CORE_SCORE_COLORS = {
	overall: { chip: '#F59E0B', from: '#FB923C', to: '#F59E0B' },
	aiTrust: { chip: '#6366F1', from: '#8B5CF6', to: '#6366F1' },
	techSeo: { chip: '#10B981', from: '#06B6D4', to: '#10B981' },
} as const;

const BAR_META = CORE_SCORE_COLORS;

const GRADE_TONE: Record<ScoreGrade, string> = {
	S: 'text-emerald-400',
	A: 'text-indigo-400',
	B: 'text-amber-400',
	'C/D': 'text-rose-400',
};

/** Visual 0–100 grade bands for the chart rail (S/A/B/C/D). */
const GRADE_ZONES: ReadonlyArray<{
	grade: ScoreGrade;
	min: number;
	max: number;
	heightPct: number;
	color: string;
}> = [
	{ grade: 'S', min: 90, max: 100, heightPct: 10, color: 'text-emerald-600 dark:text-emerald-400' },
	{ grade: 'A', min: 80, max: 89, heightPct: 10, color: 'text-indigo-600 dark:text-indigo-400' },
	{ grade: 'B', min: 65, max: 79, heightPct: 15, color: 'text-amber-600 dark:text-amber-400' },
	{ grade: 'C/D', min: 0, max: 64, heightPct: 65, color: 'text-rose-600 dark:text-rose-400' },
];

const GRADE_GUIDE_LINES = [
	{ y: 90, stroke: '#10B981' },
	{ y: 80, stroke: '#6366F1' },
	{ y: 65, stroke: '#F59E0B' },
] as const;

const GRADE_TICKS = [0, 65, 80, 90, 100] as const;
const CHART_HEIGHT = 240;
const PLOT_TOP = 26;
const PLOT_BOTTOM = 36;
/** Half of the removed legend block (mt-3 + divider + label). */
const LEGEND_HALF_SHIFT = 18;

/** Chart rail bands: S 90+ · A 80+ · B 65+ · C/D below 65. */
function chartGradeForScore(score: number): ScoreGrade {
	if (score >= 90) return 'S';
	if (score >= 80) return 'A';
	if (score >= 65) return 'B';
	return 'C/D';
}

function clampScore(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(100, Math.max(0, Math.round(n)));
}

function CoreScoreTooltip({
	active,
	payload,
	scoreLabel,
	statusLabel,
	gradeText,
}: TooltipContentProps & {
	scoreLabel: (score: number) => string;
	statusLabel: string;
	gradeText: (grade: ScoreGrade) => string;
}) {
	if (!active || !payload?.length) return null;
	const data = payload[0]?.payload;
	if (!data) return null;

	return (
		<div className="min-w-[11.5rem] rounded-lg border border-zinc-700 bg-zinc-900/95 p-3 text-xs shadow-xl">
			<div className="mb-1 font-bold text-white">{data.fullName}</div>
			<div className="text-zinc-300">{scoreLabel(data.score)}</div>
			<div className={`mt-1 text-[11px] font-semibold ${GRADE_TONE[data.grade]}`}>
				{statusLabel}: {gradeText(data.grade)}
			</div>
			<div className="mt-1 text-[11px] leading-relaxed text-zinc-400">{data.desc}</div>
		</div>
	);
}

function GradeScaleRail({
	title,
	rangeLabel,
	gradeLabel,
}: {
	title: string;
	rangeLabel: (min: number, max: number) => string;
	gradeLabel: (grade: ScoreGrade) => string;
}) {
	return (
		<div
			className="flex h-60 w-[7.25rem] shrink-0 flex-col sm:w-36"
			aria-label={title}
		>
			<div style={{ height: PLOT_TOP }} />
			<div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden border-y border-l border-zinc-200/70 pl-3 dark:border-zinc-800/60">
				{GRADE_ZONES.map((zone) => (
					<div
						key={zone.grade}
						style={{ height: `${zone.heightPct}%` }}
						className="flex w-full items-center justify-between border-b border-zinc-200/70 px-1.5 last:border-b-0 dark:border-zinc-800/60"
					>
						<span className={`text-[11px] font-black tracking-tight ${zone.color}`}>
							{gradeLabel(zone.grade)}
						</span>
						<span className="font-mono text-[9px] text-zinc-500 dark:text-zinc-400">
							{rangeLabel(zone.min, zone.max)}
						</span>
					</div>
				))}
			</div>
			<div style={{ height: PLOT_BOTTOM }} />
		</div>
	);
}

function ChartViewTabs({
	view,
	onChange,
	barLabel,
	radarLabel,
	ariaLabel,
}: {
	view: ChartView;
	onChange: (next: ChartView) => void;
	barLabel: string;
	radarLabel: string;
	ariaLabel: string;
}) {
	return (
		<div
			className="mb-1.5 inline-flex items-center gap-1 self-start rounded-lg border border-zinc-200/80 bg-zinc-100/70 p-1 text-xs dark:border-zinc-800/80 dark:bg-zinc-950/60"
			role="tablist"
			aria-label={ariaLabel}
		>
			{(
				[
					{ id: 'radar', label: radarLabel },
					{ id: 'bar', label: barLabel },
				] as const
			).map((tab) => {
				const active = view === tab.id;
				return (
					<button
						key={tab.id}
						type="button"
						role="tab"
						aria-selected={active}
						className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-all duration-200 ease-in-out ${
							active
								? 'border border-indigo-500/40 bg-indigo-600/25 font-semibold text-indigo-700 shadow-sm shadow-indigo-950/20 dark:bg-indigo-600/30 dark:text-indigo-200 dark:shadow-indigo-950/50'
								: 'border border-transparent bg-transparent font-medium text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200'
						}`}
						onClick={() => onChange(tab.id)}
					>
						{tab.label}
					</button>
				);
			})}
		</div>
	);
}

function CoreRadarDot(props: { cx?: number; cy?: number; payload?: ChartRow }) {
	const { cx, cy, payload } = props;
	if (cx == null || cy == null || !payload) return null;
	return (
		<circle
			cx={cx}
			cy={cy}
			r={4.5}
			fill={payload.chip}
			stroke="#fff"
			strokeWidth={1.5}
		/>
	);
}

function CoreColoredTick({
	x,
	y,
	payload,
	textAnchor = 'middle',
	index = 0,
	colors,
	dy = 0,
	baseline = 'central',
}: {
	x?: number;
	y?: number;
	payload?: { value?: string };
	textAnchor?: 'inherit' | 'end' | 'start' | 'middle';
	index?: number;
	colors: readonly string[];
	dy?: number;
	baseline?: 'central' | 'hanging';
}) {
	if (x == null || y == null) return null;
	return (
		<text
			x={x}
			y={y}
			dy={dy}
			textAnchor={textAnchor}
			dominantBaseline={baseline}
			fill={colors[index] ?? '#64748B'}
			fontSize={11}
			fontWeight={700}
		>
			{payload?.value}
		</text>
	);
}

export function CoreScoreBarChart({
	overallScore,
	aiTrustScore,
	techSeoScore,
}: CoreScoreBarChartProps) {
	const t = useTranslations('audit.scoreDistribution');
	const tGrade = useTranslations('audit.scoreGrade');
	const reduceMotion = useReducedMotion();
	const uid = useId().replace(/:/g, '');
	const [view, setView] = useState<ChartView>('radar');

	const tooltip = (
		<CoreScoreTooltip
			scoreLabel={(score) => t('chartTooltipScore', { score })}
			statusLabel={t('chartStatusLabel')}
			gradeText={(grade) =>
				`${tGrade('gradeLabel', { grade })} · ${tGrade(`qualifier.${gradeQualifierKey(grade)}`)}`
			}
		/>
	);

	const chartData = useMemo<ChartRow[]>(() => {
		const rows: Array<{
			key: ChartRow['key'];
			score: number;
		}> = [
			{ key: 'overall', score: clampScore(overallScore) },
			{ key: 'aiTrust', score: clampScore(aiTrustScore) },
			{ key: 'techSeo', score: clampScore(techSeoScore) },
		];
		return rows.map((row) => ({
			key: row.key,
			name: t(`chart.${row.key}.short`),
			fullName: t(`chart.${row.key}.full`),
			score: row.score,
			desc: t(`chart.${row.key}.desc`),
			grade: chartGradeForScore(row.score),
			gradientId: `core-score-${row.key}-${uid}`,
			chip: BAR_META[row.key].chip,
		}));
	}, [aiTrustScore, overallScore, t, techSeoScore, uid]);

	const axisColors = useMemo(() => chartData.map((row) => row.chip), [chartData]);
	const radarFillId = `core-radar-fill-${uid}`;
	const radarStrokeId = `core-radar-stroke-${uid}`;

	return (
		<div
			className="flex h-full min-h-[220px] w-full flex-col sm:min-h-[260px]"
			style={{ paddingTop: LEGEND_HALF_SHIFT }}
			aria-label={t('chartAriaLabel')}
		>
			<div className="flex w-full items-end gap-3 sm:gap-4">
				<div className="flex min-w-0 flex-[7] flex-col">
					<ChartViewTabs
						view={view}
						onChange={setView}
						barLabel={t('chartViewBar')}
						radarLabel={t('chartViewRadar')}
						ariaLabel={t('chartViewAria')}
					/>
					<div className="h-60 overflow-visible">
						<SafeResponsiveContainer minHeight={CHART_HEIGHT} className="text-zinc-400 dark:text-zinc-500">
							{view === 'bar' ? (
								<BarChart
									data={chartData}
									margin={{ top: PLOT_TOP, right: 4, left: 2, bottom: PLOT_BOTTOM }}
									barCategoryGap="32%"
								>
									<defs>
										{(Object.keys(BAR_META) as Array<keyof typeof BAR_META>).map((key) => (
											<linearGradient
												key={key}
												id={`core-score-${key}-${uid}`}
												x1="0"
												y1="0"
												x2="0"
												y2="1"
											>
												<stop offset="0%" stopColor={BAR_META[key].from} />
												<stop offset="100%" stopColor={BAR_META[key].to} />
											</linearGradient>
										))}
									</defs>
									<CartesianGrid
										stroke="currentColor"
										strokeDasharray="3 3"
										strokeOpacity={0.6}
										className="text-zinc-200 dark:text-zinc-800"
										vertical={false}
									/>
									{GRADE_GUIDE_LINES.map((line) => (
										<ReferenceLine
											key={line.y}
											y={line.y}
											stroke={line.stroke}
											strokeDasharray="2 2"
											strokeOpacity={0.4}
											ifOverflow="hidden"
										/>
									))}
									<XAxis
										dataKey="name"
										tick={<CoreColoredTick colors={axisColors} dy={4} baseline="hanging" />}
										tickLine={false}
										axisLine={false}
										interval={0}
										height={PLOT_BOTTOM}
										tickMargin={4}
									/>
									<YAxis
										domain={[0, 100]}
										ticks={[...GRADE_TICKS]}
										tick={{ fill: 'currentColor', fontSize: 10 }}
										tickFormatter={(value) => String(value)}
										tickLine={false}
										axisLine={false}
										width={40}
									/>
									<Tooltip
										cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
										wrapperStyle={{ outline: 'none' }}
										content={tooltip}
									/>
									<Bar
										dataKey="score"
										radius={[4, 4, 0, 0]}
										maxBarSize={28}
										isAnimationActive={!reduceMotion}
										animationDuration={700}
									>
										{chartData.map((entry) => (
											<Cell key={entry.key} fill={`url(#${entry.gradientId})`} />
										))}
										<LabelList
											dataKey="score"
											position="top"
											content={(props) => {
												const { x, y, width, value } = props;
												if (x == null || y == null || width == null || value == null) return null;
												return (
													<text
														x={Number(x) + Number(width) / 2}
														y={Number(y) - 6}
														textAnchor="middle"
														className="fill-slate-800 dark:fill-white"
														fontSize={11}
														fontWeight={800}
													>
														{t('chartScoreLabel', { score: Number(value) })}
													</text>
												);
											}}
										/>
									</Bar>
								</BarChart>
							) : (
								<RadarChart
									data={chartData}
									cx="50%"
									cy="50%"
									outerRadius="68%"
									margin={{ top: 12, right: 28, bottom: 12, left: 28 }}
								>
									<defs>
										<linearGradient id={radarFillId} x1="0" y1="0" x2="1" y2="1">
											<stop offset="0%" stopColor={BAR_META.overall.chip} stopOpacity={0.38} />
											<stop offset="50%" stopColor={BAR_META.aiTrust.chip} stopOpacity={0.28} />
											<stop offset="100%" stopColor={BAR_META.techSeo.chip} stopOpacity={0.32} />
										</linearGradient>
										<linearGradient id={radarStrokeId} x1="0" y1="0" x2="1" y2="1">
											<stop offset="0%" stopColor={BAR_META.overall.chip} />
											<stop offset="50%" stopColor={BAR_META.aiTrust.chip} />
											<stop offset="100%" stopColor={BAR_META.techSeo.chip} />
										</linearGradient>
									</defs>
									<PolarGrid
										stroke="currentColor"
										strokeOpacity={0.55}
										className="text-zinc-200 dark:text-zinc-700"
									/>
									<PolarAngleAxis
										dataKey="name"
										tick={<CoreColoredTick colors={axisColors} />}
									/>
									<PolarRadiusAxis
										domain={[0, 100]}
										tick={false}
										axisLine={false}
										tickCount={4}
									/>
									<Radar
										dataKey="score"
										stroke={`url(#${radarStrokeId})`}
										fill={`url(#${radarFillId})`}
										fillOpacity={1}
										strokeWidth={2}
										isAnimationActive={!reduceMotion}
										dot={<CoreRadarDot />}
									/>
									<Tooltip
										cursor={false}
										wrapperStyle={{ outline: 'none' }}
										content={tooltip}
									/>
								</RadarChart>
							)}
						</SafeResponsiveContainer>
					</div>
				</div>
				<GradeScaleRail
					title={t('chartGradeRailTitle')}
					rangeLabel={(min, max) => t('chartGradeRange', { min, max })}
					gradeLabel={(grade) => tGrade('gradeLabel', { grade })}
				/>
			</div>
		</div>
	);
}
