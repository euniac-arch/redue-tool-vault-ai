'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { getAiToolCategoryLabel, type AiTool } from '@/lib/admin/ai-tools-management';
import { AiToolCategoryBadge, CATEGORY_SOLID_ACCENT, GrowthBadge, PricingTypeBadge, RankBadge, RankChangeBadge } from './ai-tools-badges';

interface AiToolCardProps {
	tool: AiTool;
	rank: number;
	rankDelta?: number;
	isNew?: boolean;
	pending: boolean;
	onOpenDetail: (tool: AiTool) => void;
	onToggleVisibility: (tool: AiTool) => void;
}

export function AiToolCard({ tool, rank, rankDelta = 0, isNew = false, pending, onOpenDetail, onToggleVisibility }: AiToolCardProps) {
	const [logoFailed, setLogoFailed] = useState(false);

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
			className="relative flex cursor-pointer flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
		>
			<div className="absolute -left-2 -top-2 z-10 flex items-center gap-1">
				<RankBadge rank={rank} />
				<RankChangeBadge isNew={isNew} delta={rankDelta} />
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
					className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
				>
					<ExternalLink className="h-3.5 w-3.5" aria-hidden />
				</a>
			</div>

			<div className="flex flex-wrap items-center gap-1.5">
				<AiToolCategoryBadge category={tool.category} label={getAiToolCategoryLabel(tool.category)} />
				<PricingTypeBadge type={tool.pricing.type} />
			</div>

			<div className="flex flex-wrap items-center gap-2.5 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] font-bold text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
				<span title="글로벌 점유율">📊 {tool.market_share.toFixed(1)}%</span>
				<span title="사용자 평점">⭐ {tool.rating.toFixed(1)}</span>
				<span title="월간 방문자">👁 {tool.monthly_visits}</span>
				<GrowthBadge growth={tool.growth} className="ml-auto" />
			</div>

			<p className="line-clamp-3 flex-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{tool.desc}</p>

			<p className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
				💳 {tool.pricing.summary}
			</p>

			<div className="flex flex-wrap gap-1.5">
				{tool.tags.map((tag) => (
					<span
						key={tag}
						className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700/60 dark:text-slate-300"
					>
						#{tag}
					</span>
				))}
			</div>

			<div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
				<span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">프론트 노출</span>
				<button
					type="button"
					role="switch"
					aria-checked={tool.is_public}
					aria-label={`${tool.name} 프론트 노출 토글`}
					disabled={pending}
					onClick={(event) => {
						event.stopPropagation();
						onToggleVisibility(tool);
					}}
					className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full border-0 p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
						tool.is_public ? 'bg-slate-900 dark:bg-slate-100' : 'bg-slate-200 dark:bg-slate-700'
					}`}
				>
					<span
						className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
							tool.is_public ? 'translate-x-5' : 'translate-x-0'
						}`}
					/>
				</button>
			</div>
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
