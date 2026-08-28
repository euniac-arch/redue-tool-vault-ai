import { resolveArticleCategory, type InsightsNewsItem } from '@/lib/insights/insights-news-types';
import { InsightsNewsCategoryBadge, InsightsNewsRegionBadge } from './insights-news-badges';

interface InsightsNewsCardProps {
	item: InsightsNewsItem;
}

export function InsightsNewsCard({ item }: InsightsNewsCardProps) {
	const category = resolveArticleCategory(item);

	return (
		<article className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-lg dark:border-slate-700/80 dark:bg-slate-900/60 dark:hover:border-cyan-500/40">
			<div>
				<div className="flex items-start justify-between gap-3">
					<div className="flex flex-wrap items-center gap-1.5">
						<InsightsNewsRegionBadge region={item.region === 'KR' ? 'KR' : 'GLOBAL'} />
						<InsightsNewsCategoryBadge category={category} />
					</div>
					<time className="shrink-0 text-xs text-slate-500 dark:text-slate-400" dateTime={item.publishedAtIso}>
						{item.publishedAt}
					</time>
				</div>

				<a
					href={item.sourceUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="mt-3 line-clamp-2 break-keep text-base font-bold text-slate-900 transition-colors hover:text-cyan-600 dark:text-slate-100 dark:hover:text-cyan-400"
				>
					{item.title}
				</a>

				<p className="mt-2 line-clamp-2 break-keep text-xs leading-relaxed text-slate-600 dark:text-slate-400">
					{item.summary}
				</p>
			</div>

			<footer className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
				{item.tags.length > 0 && (
					<div className="flex flex-wrap gap-1.5">
						{item.tags.map((tag) => (
							<span
								key={tag}
								className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
							>
								#{tag.replace(/^#/, '')}
							</span>
						))}
					</div>
				)}
				<p className="text-xs font-medium text-slate-500 dark:text-slate-500">{item.sourceName}</p>
			</footer>
		</article>
	);
}
