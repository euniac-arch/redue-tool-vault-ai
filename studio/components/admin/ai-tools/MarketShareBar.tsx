'use client';

import { getTopAiToolsByMarketShare, type AiTool } from '@/lib/admin/ai-tools-management';

interface MarketShareBarProps {
	tools: AiTool[];
	/** How many leading tools get their own segment before the rest are folded into "기타". */
	topCount?: number;
}

const SEGMENT_COLORS = [
	'bg-cyan-500',
	'bg-violet-500',
	'bg-rose-500',
	'bg-amber-500',
	'bg-emerald-500',
	'bg-indigo-500',
	'bg-sky-500',
	'bg-fuchsia-500',
];

/**
 * Multi-color stacked progress bar previewing the relative global market share of the
 * leading AI tools. Segment widths are normalized against the sum of the shown shares
 * so the bar always fills 0~100%, since raw `market_share` values are per-category
 * percentages and don't sum to 100 across the whole dataset.
 */
export function MarketShareBar({ tools, topCount = 8 }: MarketShareBarProps) {
	const top = getTopAiToolsByMarketShare(tools, topCount);
	const total = top.reduce((sum, tool) => sum + tool.market_share, 0);
	if (top.length === 0 || total <= 0) return null;

	return (
		<div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
			<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
				글로벌 점유율 프리뷰 · TOP {top.length}
			</p>
			<div className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
				{top.map((tool, index) => (
					<div
						key={tool.id}
						title={`${tool.name} · ${tool.market_share.toFixed(1)}%`}
						className={`${SEGMENT_COLORS[index % SEGMENT_COLORS.length]} h-full first:rounded-l-full last:rounded-r-full`}
						style={{ width: `${(tool.market_share / total) * 100}%` }}
					/>
				))}
			</div>
			<div className="flex flex-wrap gap-x-4 gap-y-1.5">
				{top.map((tool, index) => (
					<div key={tool.id} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
						<span className={`h-2 w-2 shrink-0 rounded-full ${SEGMENT_COLORS[index % SEGMENT_COLORS.length]}`} aria-hidden />
						<span className="truncate">{tool.name}</span>
						<span className="font-bold text-slate-400 dark:text-slate-500">{tool.market_share.toFixed(1)}%</span>
					</div>
				))}
			</div>
		</div>
	);
}
