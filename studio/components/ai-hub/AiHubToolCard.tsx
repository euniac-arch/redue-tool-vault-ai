'use client';

import { useState } from 'react';
import { ExternalLink, Star } from 'lucide-react';
import { CATEGORY_SOLID_ACCENT, PricingTypeBadge, RankBadge, RankChangeBadge, RisingStatusBadge } from '@/components/admin/ai-tools/ai-tools-badges';
import type { AiTool } from '@/lib/ai-hub';
import type { AiToolRisingStatus } from '@/lib/ai-hub/rising-ai-tools';

interface AiHubToolCardProps {
	tool: AiTool;
	/** Fixed rank from the tool record (`categoryRank` or `currentRank`), never the list index. */
	rank: number;
	rankDelta?: number;
	isNew?: boolean;
	isHot?: boolean;
	isRising?: boolean;
	status?: AiToolRisingStatus;
	/** GEO(Generative Engine Optimization) fitness score, 0~100. Defensively clamped by the caller via `calculateGeoRankings`. */
	geoScore?: number;
	/** Share of AI-answer citations attributed to this engine, 0~100. */
	citationRate?: number;
	/**
	 * Fixed global rank (`currentRank`). Shown beside the badge when the badge is the
	 * category rank and the two numbers differ.
	 */
	globalRank?: number;
	/** Category label used in the rank-badge tooltip, e.g. "이미지 카테고리 내 1위". */
	categoryLabel?: string;
	/** Shown beside the badge when list order is not the rank itself (GEO 점수순). */
	rankCaption?: string;
	onOpenDetail: (tool: AiTool) => void;
}

/** Clamp + NaN-guard so a bad upstream number never renders as `NaN%` or a broken gauge width. */
function safePct(value: number | undefined): number {
	return typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
}

export function AiHubToolCard({
	tool,
	rank,
	rankDelta = 0,
	isNew = false,
	isHot = false,
	isRising = false,
	status,
	geoScore,
	citationRate,
	globalRank,
	categoryLabel,
	rankCaption,
	onOpenDetail,
}: AiHubToolCardProps) {
	const [logoFailed, setLogoFailed] = useState(false);
	const showGlobalRankNote = typeof globalRank === 'number' && globalRank !== rank;
	const rankBadgeTitle = categoryLabel
		? `${rankCaption ? `${rankCaption} · ` : ''}${categoryLabel} 내 ${rank}위${showGlobalRankNote ? ` · 전체 #${globalRank}위` : ''}`
		: rankCaption;

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={() => onOpenDetail(tool)}
			onKeyDown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					onOpenDetail(tool);
				}
			}}
			className="relative flex cursor-pointer flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-lg dark:border-slate-700/80 dark:bg-slate-900/60 dark:hover:border-cyan-500/40"
		>
			<div className="absolute -left-2 -top-2 z-10 flex items-center gap-1">
				<span title={rankBadgeTitle} className="inline-flex items-center gap-1">
					<RankBadge rank={rank} />
					{rankCaption ? (
						<span className="whitespace-nowrap rounded-full border border-cyan-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-cyan-700 shadow-sm dark:border-cyan-800 dark:bg-slate-900 dark:text-cyan-300">
							{rankCaption}
						</span>
					) : null}
				</span>
				<RankChangeBadge isNew={isNew} delta={rankDelta} />
				<RisingStatusBadge status={status} isRising={isRising || isHot} />
			</div>

			<div className="flex items-start justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2.5">
					<ToolLogo tool={tool} failed={logoFailed} onError={() => setLogoFailed(true)} />
					<div className="min-w-0">
						<h3 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{tool.name}</h3>
						<p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{tool.provider}</p>
					</div>
				</div>
				<a
					href={tool.url}
					target="_blank"
					rel="noreferrer"
					title={`${tool.name} 새 창에서 열기`}
					aria-label={`${tool.name} 새 창에서 열기`}
					onClick={(event) => event.stopPropagation()}
					className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
				>
					<ExternalLink className="h-3.5 w-3.5" aria-hidden />
				</a>
			</div>

			<div className="flex flex-wrap items-center gap-2.5 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] font-bold text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
				<span className="flex items-center gap-1 text-amber-500 dark:text-amber-400">
					<Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
					{tool.rating.toFixed(1)}
				</span>
				<span title="글로벌 점유율">📊 점유율 {safePct(tool.market_share).toFixed(1)}%</span>
				{showGlobalRankNote ? (
					<span
						className="font-medium text-slate-400 dark:text-slate-500"
						title="전체(모든 카테고리 통합) 순위"
					>
						전체 #{globalRank}위
					</span>
				) : null}
				<span className="ml-auto text-slate-500 dark:text-slate-400">추천점수 {tool.recommend_score}점</span>
			</div>

			{(geoScore !== undefined || citationRate !== undefined) && (
				<div className="flex flex-col gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-900/40">
					<MetricGauge label="GEO 적합도" value={safePct(geoScore)} barClassName="bg-cyan-500" />
					<MetricGauge label="인용률" value={safePct(citationRate)} barClassName="bg-violet-500" />
				</div>
			)}

			<p className="line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{tool.desc}</p>

			<div className="flex flex-wrap items-center gap-1.5">
				<PricingTypeBadge type={tool.pricing.type} />
				<span className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-500">
					{tool.pricing.summary}
				</span>
			</div>

			<div className="mt-auto flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
				{tool.tags.slice(0, 4).map((tag) => (
					<span
						key={tag}
						className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
					>
						#{tag}
					</span>
				))}
			</div>
		</div>
	);
}

function MetricGauge({
	label,
	value,
	barClassName,
}: {
	label: string;
	value: number;
	barClassName: string;
}) {
	return (
		<div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
			<span className="w-14 shrink-0 truncate">{label}</span>
			<div
				className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700/60"
				role="meter"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={value}
				aria-label={label}
			>
				<div className={`h-full rounded-full ${barClassName}`} style={{ width: `${value}%` }} />
			</div>
			<span className="w-9 shrink-0 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">
				{value.toFixed(0)}%
			</span>
		</div>
	);
}

function ToolLogo({ tool, failed, onError }: { tool: AiTool; failed: boolean; onError: () => void }) {
	if (failed || !tool.logo_url) {
		return (
			<span
				className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${CATEGORY_SOLID_ACCENT[tool.category]}`}
				aria-hidden
			>
				{tool.name.charAt(0).toUpperCase()}
			</span>
		);
	}
	return (
		// eslint-disable-next-line @next/next/no-img-element -- external favicon URLs, no next/image domain config needed
		<img
			src={tool.logo_url}
			alt=""
			aria-hidden
			loading="lazy"
			onError={onError}
			className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-1 dark:border-slate-700"
		/>
	);
}
