import { TrendingUp } from 'lucide-react';
import { TRENDING_TOPICS } from '@/lib/admin/geo-news-management';

interface TrendingTopicsWidgetProps {
	onSelect: (topic: string) => void;
}

export function TrendingTopicsWidget({ onSelect }: TrendingTopicsWidgetProps) {
	return (
		<aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Live Topics</p>
					<h2 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">실시간 급상승 토픽</h2>
				</div>
				<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
					<TrendingUp className="h-4 w-4" strokeWidth={1.75} aria-hidden />
				</span>
			</div>
			<p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
				현재 GEO·스키마 뉴스에서 가장 자주 등장하는 키워드입니다. 칩을 누르면 피드가 필터됩니다.
			</p>
			<div className="mt-4 flex flex-wrap gap-2">
				{TRENDING_TOPICS.map((topic) => (
					<button
						key={topic}
						type="button"
						onClick={() => onSelect(topic)}
						className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-slate-300 hover:bg-white dark:bg-slate-700/60 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:border-slate-500"
					>
						#{topic}
					</button>
				))}
			</div>
		</aside>
	);
}
