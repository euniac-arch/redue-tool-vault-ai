'use client';

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';
import { AsiChartFrame } from '@/components/ai-search-intelligence/primitives/AsiChartFrame';
import { SafeResponsiveContainer } from '@/components/charts/SafeResponsiveContainer';
import { useAsiMotion } from '@/lib/ui/asi-motion';

const BRAND = '#0891b2';
const COMPETITOR = '#f59e0b';
const OTHER = '#94a3b8';

type SovRow = { name: string; brand: number; competitor?: number; other?: number };

type AsiTooltipItem = {
	name?: string;
	value?: number | string;
	color?: string;
	dataKey?: string | number;
};

const TOOLTIP_WRAPPER = {
	zIndex: 50,
	outline: 'none',
	background: 'transparent',
	border: 'none',
	boxShadow: 'none',
} as const;

function formatTooltipValue(value: unknown, dataKey?: string | number): string {
	if (typeof value !== 'number' || Number.isNaN(value)) {
		return value == null || value === '' ? '—' : String(value);
	}
	const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
	const key = String(dataKey ?? '');
	if (key === 'brand' || key === 'competitor' || key === 'other' || key === 'value') {
		return `${rounded}%`;
	}
	return rounded;
}

function AsiChartTooltip({
	active,
	payload,
	label,
}: {
	active?: boolean;
	payload?: readonly AsiTooltipItem[];
	label?: string | number;
}) {
	if (!active || !payload?.length) return null;
	const items = payload.filter((item) => item.value != null && item.value !== '');
	if (!items.length) return null;
	const title = label != null && String(label).trim() !== '' ? String(label) : items[0]?.name;

	return (
		<div className="pointer-events-none z-50 min-w-[10rem] -translate-x-[calc(100%+10px)] -translate-y-[calc(100%+10px)] rounded-xl border border-white/10 bg-zinc-900/90 p-3 shadow-xl backdrop-blur-md">
			{title ? <p className="mb-2 text-[12px] font-semibold text-slate-100">{title}</p> : null}
			<ul className="flex flex-col gap-1.5">
				{items.map((item, index) => {
					const name = String(item.name ?? item.dataKey ?? '');
					const hideName = Boolean(title) && items.length === 1 && name === title;
					return (
						<li key={`${name}-${index}`} className="flex items-center justify-between gap-4 text-[12px]">
							<span className="inline-flex min-w-0 items-center gap-2 text-slate-200">
								<span
									aria-hidden
									className="h-2 w-2 shrink-0 rounded-full"
									style={{ backgroundColor: item.color || '#22d3ee' }}
								/>
								{hideName ? null : <span className="truncate">{name}</span>}
							</span>
							<span className="shrink-0 font-semibold tabular-nums text-cyan-300">
								{formatTooltipValue(item.value, item.dataKey)}
							</span>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

export function AsiSovPie({ brand, competitor, other, brandLabel, competitorLabel, otherLabel }: {
	brand: number;
	competitor: number;
	other: number;
	brandLabel: string;
	competitorLabel: string;
	otherLabel: string;
}) {
	const data = [
		{ name: brandLabel, value: brand, color: BRAND },
		{ name: competitorLabel, value: competitor, color: COMPETITOR },
		{ name: otherLabel, value: other, color: OTHER },
	];
	const { reduce, chartMs } = useAsiMotion();
	return (
		<AsiChartFrame>
		<SafeResponsiveContainer minHeight={220}>
			<PieChart>
				<Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} isAnimationActive={!reduce} animationDuration={chartMs}>
					{data.map((item) => (
						<Cell key={item.name} fill={item.color} />
					))}
				</Pie>
				<Tooltip
					content={<AsiChartTooltip />}
					wrapperStyle={TOOLTIP_WRAPPER}
					allowEscapeViewBox={{ x: true, y: true }}
				/>
			</PieChart>
		</SafeResponsiveContainer>
		</AsiChartFrame>
	);
}

export function AsiSovBar({ rows }: { rows: SovRow[] }) {
	const { reduce, chartMs } = useAsiMotion();
	return (
		<AsiChartFrame>
		<SafeResponsiveContainer minHeight={220}>
			<BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
				<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
				<XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={42} />
				<YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={28} />
				<Tooltip
					content={<AsiChartTooltip />}
					wrapperStyle={TOOLTIP_WRAPPER}
					allowEscapeViewBox={{ x: true, y: true }}
				/>
				<Bar dataKey="brand" fill={BRAND} radius={[4, 4, 0, 0]} isAnimationActive={!reduce} animationDuration={chartMs} />
				<Bar dataKey="competitor" fill={COMPETITOR} radius={[4, 4, 0, 0]} isAnimationActive={!reduce} animationDuration={chartMs} />
			</BarChart>
		</SafeResponsiveContainer>
		</AsiChartFrame>
	);
}

export function AsiMonitorChart({
	rows,
	keys,
	countKey = 'citationCount',
}: {
	rows: Array<Record<string, string | number>>;
	keys: Array<{ key: string; color: string }>;
	countKey?: string;
}) {
	const { reduce, chartMs } = useAsiMotion();
	return (
		<AsiChartFrame minHeight={240}>
		<SafeResponsiveContainer minHeight={240}>
			<LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
				<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
				<XAxis dataKey="name" tick={{ fontSize: 11 }} />
				<YAxis yAxisId="score" domain={[0, 100]} tick={{ fontSize: 11 }} width={28} />
				<YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
				<Tooltip
					content={<AsiChartTooltip />}
					wrapperStyle={TOOLTIP_WRAPPER}
					allowEscapeViewBox={{ x: true, y: true }}
				/>
				{keys.map((item) => (
					<Line
						key={item.key}
						yAxisId={item.key === countKey ? 'count' : 'score'}
						type="monotone"
						dataKey={item.key}
						stroke={item.color}
						strokeWidth={2}
						dot={{ r: 2 }}
						isAnimationActive={!reduce}
						animationDuration={chartMs}
					/>
				))}
			</LineChart>
		</SafeResponsiveContainer>
		</AsiChartFrame>
	);
}

export function AsiSovLine({ rows }: { rows: Array<{ name: string; brand: number; competitor: number }> }) {
	const { reduce, chartMs } = useAsiMotion();
	return (
		<AsiChartFrame>
		<SafeResponsiveContainer minHeight={220}>
			<LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
				<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
				<XAxis dataKey="name" tick={{ fontSize: 11 }} />
				<YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={28} />
				<Tooltip
					content={<AsiChartTooltip />}
					wrapperStyle={TOOLTIP_WRAPPER}
					allowEscapeViewBox={{ x: true, y: true }}
				/>
				<Line type="monotone" dataKey="brand" stroke={BRAND} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={!reduce} animationDuration={chartMs} />
				<Line type="monotone" dataKey="competitor" stroke={COMPETITOR} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={!reduce} animationDuration={chartMs} />
			</LineChart>
		</SafeResponsiveContainer>
		</AsiChartFrame>
	);
}
