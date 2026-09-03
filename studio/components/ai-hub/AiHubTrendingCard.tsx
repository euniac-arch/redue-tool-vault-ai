'use client';

import { ExternalLink } from 'lucide-react';
import type { CuratedTrendingBadge, CuratedTrendingTool } from '@/data/curatedTrendingTools';

const BADGE_STYLE: Record<CuratedTrendingBadge, string> = {
	'🔥 HOT': 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/50 dark:bg-orange-950/50 dark:text-orange-300',
	'✨ NEW': 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/50 dark:bg-sky-950/50 dark:text-sky-300',
	'⚡ RISING': 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/50 dark:bg-fuchsia-950/50 dark:text-fuchsia-300',
};

export function AiHubTrendingCard({ tool }: { tool: CuratedTrendingTool }) {
	return (
		<article className="relative flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg dark:border-slate-700/80 dark:bg-slate-900/60 dark:hover:border-orange-500/40">
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<span
						className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold tracking-wide ${BADGE_STYLE[tool.badge]}`}
					>
						{tool.badge}
					</span>
					<h3 className="mt-2 truncate text-sm font-bold text-slate-900 dark:text-slate-100">{tool.name}</h3>
					<p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{tool.developer}</p>
				</div>
				<a
					href={tool.websiteUrl}
					target="_blank"
					rel="noopener noreferrer"
					title={`${tool.name} 공식 사이트 방문`}
					aria-label={`${tool.name} 공식 사이트 방문`}
					className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
				>
					<ExternalLink className="h-3.5 w-3.5" aria-hidden />
				</a>
			</div>

			<p className="rounded-lg bg-orange-50 px-2.5 py-2 text-[11px] font-bold leading-relaxed text-orange-800 dark:bg-orange-950/30 dark:text-orange-200">
				{tool.highlight}
			</p>

			<p className="line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{tool.description}</p>

			<div className="flex flex-wrap items-center gap-1.5">
				<span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
					{tool.pricingType}
				</span>
			</div>

			<div className="mt-auto flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
				{tool.tags.slice(0, 4).map((tag) => (
					<span
						key={tag}
						className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
					>
						{tag.startsWith('#') ? tag : `#${tag}`}
					</span>
				))}
			</div>

			<a
				href={tool.websiteUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-orange-300/70 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-800 transition hover:border-orange-400 hover:bg-orange-100 dark:border-orange-500/40 dark:bg-orange-950/30 dark:text-orange-200 dark:hover:bg-orange-950/50"
			>
				공식 사이트 방문
				<ExternalLink className="h-3.5 w-3.5" aria-hidden />
			</a>
		</article>
	);
}
