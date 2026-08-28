import { Bookmark, ExternalLink } from 'lucide-react';
import type { GeoNewsItem } from '@/lib/admin/geo-news-management';
import { GeoNewsCategoryBadge, GeoNewsRegionBadge } from './geo-news-badges';

interface GeoNewsCardProps {
	item: GeoNewsItem;
	onToggleBookmark: (id: string) => void;
	pending?: boolean;
}

export function GeoNewsCard({ item, onToggleBookmark, pending }: GeoNewsCardProps) {
	return (
		<article
			className={`relative flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800 ${
				pending ? 'opacity-60' : ''
			}`}
		>
			<div className="flex flex-wrap items-center gap-1.5">
				<GeoNewsRegionBadge region={item.region} />
				<GeoNewsCategoryBadge category={item.category} />
			</div>

			<a
				href={item.sourceUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="mt-3 text-base font-bold leading-snug text-slate-900 hover:text-slate-700 hover:underline dark:text-slate-100 dark:hover:text-slate-200"
			>
				{item.title}
				<ExternalLink className="ml-1 inline h-3.5 w-3.5 align-[-2px] text-slate-400 dark:text-slate-500" aria-hidden />
			</a>

			<a
				href={item.sourceUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="mt-3 rounded-lg border border-sky-100 bg-sky-50/70 px-3 py-2.5 text-[13px] leading-relaxed text-slate-700 hover:border-sky-200 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-slate-200 dark:hover:border-sky-800"
			>
				{item.summary}
			</a>

			{item.tags.length > 0 && (
				<div className="mt-3 flex flex-wrap gap-1.5">
					{item.tags.map((tag) => (
						<span key={tag} className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">
							#{tag}
						</span>
					))}
				</div>
			)}

			<footer className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
				<div className="min-w-0">
					<p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{item.sourceName}</p>
					<p className="text-[11px] text-slate-400 dark:text-slate-500">{item.publishedAt}</p>
				</div>
				<button
					type="button"
					onClick={() => onToggleBookmark(item.id)}
					className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${
						item.isBookmarked
							? 'border-amber-200 bg-amber-50 text-amber-600'
							: 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200'
					}`}
					aria-pressed={item.isBookmarked}
					aria-label={item.isBookmarked ? '북마크 해제' : '북마크'}
					title={item.isBookmarked ? '북마크 해제' : '북마크'}
				>
					<Bookmark className="h-4 w-4" fill={item.isBookmarked ? 'currentColor' : 'none'} />
				</button>
			</footer>
		</article>
	);
}
