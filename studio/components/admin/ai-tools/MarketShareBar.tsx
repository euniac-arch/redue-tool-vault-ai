'use client';

import { useMemo } from 'react';
import { AI_RANKING_SOURCE_CAPTION, resolveOfficialGlobalTop } from '@/lib/ai-hub/ai-ranking';
import { formatRankingAsOfLabel, getCalendarDateKey } from '@/lib/ai-hub/getDailyAiRanking';
import { useLocalCalendarDate } from '@/lib/ai-hub/use-local-calendar-date';
import type { AiTool } from '@/lib/admin/ai-tools-management';
import { GrowthBadge } from './ai-tools-badges';

interface MarketShareBarProps {
	tools: AiTool[];
	/** How many leading tools get their own segment. Official snapshot is TOP 8. */
	topCount?: number;
	/** Local calendar day used for the daily seed (defaults to the live local date). */
	asOf?: Date;
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
 * Stacked preview of the same daily-seeded global TOP list the "오늘자 순위 분석"
 * modal uses (`resolveOfficialGlobalTop`). Percentages and growth come from
 * `getDailyAiRanking` — stable for the local calendar day, rolling at midnight.
 */
export function MarketShareBar({ tools, topCount = 8, asOf }: MarketShareBarProps) {
	const liveDate = useLocalCalendarDate();
	const day = asOf ?? liveDate;
	const dateKey = getCalendarDateKey(day);
	const top = useMemo(() => {
		const [year, month, dayOfMonth] = dateKey.split('-').map(Number);
		return resolveOfficialGlobalTop(tools, topCount, new Date(year, month - 1, dayOfMonth));
	}, [tools, topCount, dateKey]);
	const total = top.reduce((sum, tool) => sum + tool.globalSharePct, 0);
	if (top.length === 0 || total <= 0) return null;

	return (
		<div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
					글로벌 점유율 프리뷰 · TOP {top.length}
				</p>
				<p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{formatRankingAsOfLabel(day)}</p>
			</div>
			<div className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
				{top.map((tool, index) => (
					<div
						key={tool.id}
						title={`${tool.name} · ${tool.globalSharePct.toFixed(1)}% · ${tool.growth}`}
						className={`${SEGMENT_COLORS[index % SEGMENT_COLORS.length]} h-full first:rounded-l-full last:rounded-r-full`}
						style={{ width: `${(tool.globalSharePct / total) * 100}%` }}
					/>
				))}
			</div>
			<div className="flex flex-wrap gap-x-4 gap-y-1.5">
				{top.map((tool, index) => (
					<div key={tool.id} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
						<span className={`h-2 w-2 shrink-0 rounded-full ${SEGMENT_COLORS[index % SEGMENT_COLORS.length]}`} aria-hidden />
						<span className="truncate">{tool.name}</span>
						<span className="font-bold tabular-nums text-slate-400 dark:text-slate-500">{tool.globalSharePct.toFixed(1)}%</span>
						<GrowthBadge growth={tool.growth} />
					</div>
				))}
			</div>
			<p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">{AI_RANKING_SOURCE_CAPTION}</p>
		</div>
	);
}
