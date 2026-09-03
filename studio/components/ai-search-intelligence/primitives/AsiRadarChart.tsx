'use client';

import type { ReactNode } from 'react';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from 'recharts';
import { AsiChartFrame } from '@/components/ai-search-intelligence/primitives/AsiChartFrame';
import { SafeResponsiveContainer } from '@/components/charts/SafeResponsiveContainer';
import { useAsiMotion } from '@/lib/ui/asi-motion';

export type AsiRadarAxis = {
	key: string;
	label: string;
	value: number;
};

export function AsiRadarChart({
	axes,
	center,
	minHeight = 280,
}: {
	axes: readonly AsiRadarAxis[];
	center?: ReactNode;
	minHeight?: number;
}) {
	const { reduce, chartMs } = useAsiMotion();
	const data = axes.map((axis) => ({
		name: axis.label,
		score: Math.max(0, Math.min(100, axis.value)),
	}));

	return (
		<div className="relative min-w-0" style={{ minHeight }}>
			<AsiChartFrame minHeight={minHeight}>
			<SafeResponsiveContainer minHeight={minHeight}>
				<RadarChart data={data} cx="50%" cy="50%" outerRadius="62%" margin={{ top: 12, right: 8, bottom: 12, left: 8 }}>
					<PolarGrid stroke="currentColor" strokeOpacity={0.45} className="text-slate-200 dark:text-slate-700" />
					<PolarAngleAxis
						dataKey="name"
						tick={{ fill: 'currentColor', fontSize: 11, fontWeight: 700 }}
						className="text-slate-500 dark:text-slate-400"
					/>
					<PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickCount={4} />
					<Radar
						dataKey="score"
						stroke="#0891b2"
						fill="#06b6d4"
						fillOpacity={0.28}
						strokeWidth={2}
						isAnimationActive={!reduce}
						animationDuration={chartMs}
					/>
				</RadarChart>
			</SafeResponsiveContainer>
			</AsiChartFrame>
			{center ? (
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
					<div className="pointer-events-auto rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center dark:border-slate-700 dark:bg-slate-900">
						{center}
					</div>
				</div>
			) : null}
		</div>
	);
}
