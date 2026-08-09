'use client';

export interface UsageDay {
	date: string;
	success: number;
	failed: number;
}

/** Lightweight stacked-bar SVG chart — no charting dependency needed for a 14-point series. */
export function UsageChart({ days }: { days: UsageDay[] }) {
	const max = Math.max(1, ...days.map((d) => d.success + d.failed));
	const width = 560;
	const height = 140;
	const barGap = 4;
	const barWidth = days.length ? (width - barGap * (days.length - 1)) / days.length : 0;

	return (
		<div className="overflow-x-auto">
			<svg viewBox={`0 0 ${width} ${height + 24}`} className="h-40 w-full min-w-[420px]">
				{days.map((day, index) => {
					const total = day.success + day.failed;
					const successHeight = (day.success / max) * height;
					const failedHeight = (day.failed / max) * height;
					const x = index * (barWidth + barGap);
					return (
						<g key={day.date}>
							<rect
								x={x}
								y={height - successHeight - failedHeight}
								width={barWidth}
								height={failedHeight}
								fill="#fb7185"
								rx={2}
							/>
							<rect x={x} y={height - successHeight} width={barWidth} height={successHeight} fill="#22d3ee" rx={2} />
							{total === 0 && <rect x={x} y={height - 2} width={barWidth} height={2} fill="rgba(255,255,255,0.08)" />}
							<text x={x + barWidth / 2} y={height + 16} textAnchor="middle" fontSize="8" fill="#64748b">
								{day.date.slice(5)}
							</text>
						</g>
					);
				})}
			</svg>
			<div className="mt-1 flex items-center gap-4 text-[11px] text-slate-500">
				<span className="flex items-center gap-1.5">
					<span className="h-2 w-2 rounded-sm bg-cyan-400" /> Success
				</span>
				<span className="flex items-center gap-1.5">
					<span className="h-2 w-2 rounded-sm bg-rose-400" /> Failed
				</span>
			</div>
		</div>
	);
}
