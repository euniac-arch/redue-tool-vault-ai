'use client';

import { useMemo } from 'react';
import { AI_RANKING_SOURCE_CAPTION } from '@/lib/ai-hub/ai-ranking';
import { formatKstRankingAsOfLabel, getKstDateKey, normalizeSharePct, type RankedLiveAiTool } from '@/lib/ai-hub/live-ai-rankings';
import type { AiTool } from '@/lib/admin/ai-tools-management';
import { parseMonthlyVisits } from '@/lib/admin/ai-tools-management';
import { GrowthBadge } from './ai-tools-badges';

interface MarketShareBarProps {
	tools: Array<AiTool | RankedLiveAiTool>;
	/** How many leading tools get their own segment. */
	topCount?: number;
	/** Restrict the denominator to one catalog category. */
	category?: string | 'all';
	/** `trend` uses buzz score so rising tools with thin traffic still appear. */
	shareMetric?: 'traffic' | 'trend';
	title?: string;
	asOf?: Date;
	dateKey?: string;
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

function asRanked(tool: AiTool | RankedLiveAiTool): RankedLiveAiTool | null {
	const ranked = tool as RankedLiveAiTool;
	return typeof ranked.trafficIndex === 'number' && typeof ranked.currentRank === 'number' ? ranked : null;
}

function trafficIndexOf(tool: AiTool | RankedLiveAiTool): number {
	const ranked = asRanked(tool);
	if (ranked) return ranked.trafficIndex;
	return parseMonthlyVisits(tool.monthly_visits);
}

function shareIndexOf(tool: AiTool | RankedLiveAiTool, metric: 'traffic' | 'trend'): number {
	if (metric === 'trend') {
		const ranked = asRanked(tool);
		if (ranked && typeof ranked.trendScore === 'number') return Math.max(0, ranked.trendScore);
		const raw = (tool as AiTool).trend_score;
		return typeof raw === 'number' ? Math.max(0, raw) : 0;
	}
	return trafficIndexOf(tool);
}

/**
 * Stacked preview of the selected category (or global catalog). Share % is
 * always `toolIndex / sum(category indexes) * 100` — never a hardcoded table.
 */
export function MarketShareBar({
	tools,
	topCount = 8,
	category = 'all',
	shareMetric = 'traffic',
	title,
	asOf,
	dateKey,
}: MarketShareBarProps) {
	const scoped = useMemo(
		() => (category && category !== 'all' && category !== 'rising' ? tools.filter((tool) => tool.category === category) : tools),
		[tools, category],
	);
	const totalIndex = useMemo(
		() => scoped.reduce((sum, tool) => sum + Math.max(0, shareIndexOf(tool, shareMetric)), 0),
		[scoped, shareMetric],
	);
	const top = useMemo(() => {
		return [...scoped]
			.sort((a, b) => {
				if (shareMetric === 'trend') return shareIndexOf(b, 'trend') - shareIndexOf(a, 'trend');
				const ra = asRanked(a);
				const rb = asRanked(b);
				if (ra && rb) return ra.currentRank - rb.currentRank;
				return trafficIndexOf(b) - trafficIndexOf(a);
			})
			.slice(0, topCount)
			.map((tool) => ({
				tool,
				share: normalizeSharePct(shareIndexOf(tool, shareMetric), totalIndex),
			}))
			.filter((row) => row.share > 0);
	}, [scoped, topCount, totalIndex, shareMetric]);

	const shownShare = top.reduce((sum, row) => sum + row.share, 0);
	const othersShare = Math.max(0, Math.round((100 - shownShare) * 10) / 10);
	const dayLabel = dateKey ?? (asOf ? getKstDateKey(asOf) : getKstDateKey());

	if (top.length === 0 || totalIndex <= 0) return null;

	return (
		<div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
					{title ?? `글로벌 점유율 프리뷰 · TOP ${top.length}`}
				</p>
				<p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{formatKstRankingAsOfLabel(dayLabel)}</p>
			</div>
			<div className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
				{top.map((row, index) => (
					<div
						key={row.tool.id}
						title={`${row.tool.name} · ${row.share.toFixed(1)}%`}
						className={`${SEGMENT_COLORS[index % SEGMENT_COLORS.length]} h-full first:rounded-l-full last:rounded-r-full`}
						style={{ width: `${row.share}%` }}
					/>
				))}
				{othersShare > 0 && (
					<div
						title={`기타 · ${othersShare.toFixed(1)}%`}
						className="h-full bg-slate-300 last:rounded-r-full dark:bg-slate-600"
						style={{ width: `${othersShare}%` }}
					/>
				)}
			</div>
			<div className="flex flex-wrap gap-x-4 gap-y-1.5">
				{top.map((row, index) => {
					const ranked = asRanked(row.tool);
					return (
						<div key={row.tool.id} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
							<span className={`h-2 w-2 shrink-0 rounded-full ${SEGMENT_COLORS[index % SEGMENT_COLORS.length]}`} aria-hidden />
							<span className="truncate">{row.tool.name}</span>
							<span className="font-bold tabular-nums text-slate-400 dark:text-slate-500">{row.share.toFixed(1)}%</span>
							{ranked ? <GrowthBadge growth={ranked.growth} /> : null}
						</div>
					);
				})}
				{othersShare > 0 && (
					<div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
						<span className="h-2 w-2 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" aria-hidden />
						<span>기타</span>
						<span className="font-bold tabular-nums">{othersShare.toFixed(1)}%</span>
					</div>
				)}
			</div>
			<p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">{AI_RANKING_SOURCE_CAPTION}</p>
		</div>
	);
}
