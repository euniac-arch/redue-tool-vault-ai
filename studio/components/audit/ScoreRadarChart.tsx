'use client';

import { useTranslations } from 'next-intl';
import type { DiagnosticCategoryId } from '@/lib/audit/onpage-diagnostic';
import type { RadarScores } from '@/lib/audit/scoreCalculator';

const AXES: ReadonlyArray<{ key: keyof RadarScores; categoryId: DiagnosticCategoryId; angle: number }> = [
	{ key: 'security', categoryId: 'security', angle: -90 },
	{ key: 'performance', categoryId: 'performance', angle: -18 },
	{ key: 'seo', categoryId: 'seo', angle: 54 },
	{ key: 'schema', categoryId: 'schema', angle: 126 },
	{ key: 'geoSignal', categoryId: 'geo', angle: 198 },
];

const SIZE = 220;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RADIUS = 78;

function polar(angleDeg: number, radius: number): { x: number; y: number } {
	const rad = (angleDeg * Math.PI) / 180;
	return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function ringPoints(scale: number): string {
	return AXES.map(({ angle }) => {
		const p = polar(angle, RADIUS * scale);
		return `${p.x},${p.y}`;
	}).join(' ');
}

function valuePoints(scores: RadarScores): string {
	return AXES.map(({ key, angle }) => {
		const n = Math.min(100, Math.max(0, scores[key]));
		const p = polar(angle, (n / 100) * RADIUS);
		return `${p.x},${p.y}`;
	}).join(' ');
}

interface ScoreRadarChartProps {
	scores: RadarScores;
	/** When true, omit the inner title — the parent section already provides one. */
	hideHeader?: boolean;
	activeCategoryId?: DiagnosticCategoryId | null;
	/** Sticky hover: activate immediately; do not reset on mouseleave. */
	onHoverCategory?: (id: DiagnosticCategoryId) => void;
	onSelectCategory?: (id: DiagnosticCategoryId) => void;
}

export function ScoreRadarChart({
	scores,
	hideHeader = false,
	activeCategoryId = null,
	onHoverCategory,
	onSelectCategory,
}: ScoreRadarChartProps) {
	const t = useTranslations('audit.scoreDistribution.radar');
	const securityDown = scores.security < 40;
	const interactive = Boolean(onHoverCategory || onSelectCategory);
	const activateCategory = (categoryId: DiagnosticCategoryId) => {
		onHoverCategory?.(categoryId);
		onSelectCategory?.(categoryId);
	};

	return (
		<div className={hideHeader ? '' : 'rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/[0.08] dark:bg-black/25'}>
			{hideHeader ? null : (
				<div className="flex flex-wrap items-start justify-between gap-2">
					<div>
						<p className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
							{t('title')}
						</p>
						<p className="mt-1 text-[11px] leading-relaxed text-slate-500">{t('subtitle')}</p>
					</div>
					{securityDown ? (
						<span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
							{t('securityDown')}
						</span>
					) : null}
				</div>
			)}
			<div className={`${hideHeader ? '' : 'mt-2'} flex justify-center`}>
				<svg
					viewBox={`0 0 ${SIZE} ${SIZE}`}
					className="h-[13rem] w-[13rem] shrink-0"
					role="img"
					aria-label={t('ariaLabel')}
				>
					{[0.25, 0.5, 0.75, 1].map((scale) => (
						<polygon
							key={scale}
							points={ringPoints(scale)}
							className="pointer-events-none fill-none stroke-slate-200 dark:stroke-white/10"
							strokeWidth="1"
						/>
					))}
					{AXES.map(({ categoryId, angle }) => {
						const end = polar(angle, RADIUS);
						const isActive = activeCategoryId === categoryId;
						return (
							<line
								key={angle}
								x1={CX}
								y1={CY}
								x2={end.x}
								y2={end.y}
								className={
									isActive
										? 'pointer-events-none stroke-indigo-400 dark:stroke-indigo-400'
										: 'pointer-events-none stroke-slate-200 dark:stroke-white/10'
								}
								strokeWidth={isActive ? 1.75 : 1}
							/>
						);
					})}
					<polygon
						points={valuePoints(scores)}
						className={
							securityDown
								? 'pointer-events-none fill-rose-500/20 stroke-rose-500'
								: 'pointer-events-none fill-cyan-500/20 stroke-cyan-500'
						}
						strokeWidth="2"
					/>
					{AXES.map(({ key, categoryId, angle }) => {
						const n = Math.min(100, Math.max(0, scores[key]));
						const point = polar(angle, (n / 100) * RADIUS);
						const label = polar(angle, RADIUS + 22);
						const isActive = activeCategoryId === categoryId;
						const isDimmed = activeCategoryId !== null && !isActive;

						return (
							<g
								key={key}
								className={interactive ? 'cursor-pointer outline-none' : undefined}
								role={interactive ? 'button' : undefined}
								tabIndex={interactive ? 0 : undefined}
								aria-pressed={interactive ? isActive : undefined}
								onMouseEnter={
									interactive
										? () => {
												activateCategory(categoryId);
											}
										: undefined
								}
								onMouseDown={
									interactive
										? (event) => {
												event.preventDefault();
											}
										: undefined
								}
								onClick={
									interactive
										? (event) => {
												event.stopPropagation();
												activateCategory(categoryId);
											}
										: undefined
								}
								onKeyDown={
									interactive
										? (event) => {
												if (event.key === 'Enter' || event.key === ' ') {
													event.preventDefault();
													event.stopPropagation();
													activateCategory(categoryId);
												}
											}
										: undefined
								}
							>
								<line
									x1={CX}
									y1={CY}
									x2={label.x}
									y2={label.y}
									stroke="transparent"
									strokeWidth={24}
								/>
								<circle
									cx={point.x}
									cy={point.y}
									r={isActive ? 5.5 : 3.5}
									className={
										isActive
											? 'fill-indigo-500 stroke-white dark:stroke-slate-950'
											: securityDown
												? 'fill-rose-500 stroke-white dark:stroke-slate-950'
												: 'fill-cyan-500 stroke-white dark:stroke-slate-950'
									}
									strokeWidth={isActive ? 1.5 : 1}
									style={
										isActive
											? { filter: 'drop-shadow(0 0 6px rgb(99 102 241 / 0.7))' }
											: undefined
									}
								/>
								<circle cx={label.x} cy={label.y} r={16} className="fill-transparent" />
								<text
									x={label.x}
									y={label.y}
									textAnchor="middle"
									dominantBaseline="middle"
									className={
										isActive
											? 'fill-indigo-600 text-[10px] font-extrabold dark:fill-indigo-300'
											: isDimmed
												? 'fill-slate-400 text-[10px] font-bold dark:fill-slate-600'
												: 'fill-slate-600 text-[10px] font-bold dark:fill-slate-300'
									}
								>
									{t(key)}
								</text>
							</g>
						);
					})}
				</svg>
			</div>
		</div>
	);
}
