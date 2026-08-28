import type { InsightArticleCategory, InsightsNewsRegion } from '@/lib/insights/insights-news-types';
import { INSIGHT_CATEGORY_LABEL } from '@/lib/insights/insights-news-types';

/** Matches the AI Hub tool-category ring-badge palette (bg-*-50 / text-*-700 / ring-*-200, dark:*-950/50 etc.). */
const REGION_STYLE: Record<InsightsNewsRegion, string> = {
	KR: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800',
	GLOBAL: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-800',
};

const CATEGORY_STYLE: Record<InsightArticleCategory, string> = {
	aeo_geo_search: 'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:ring-cyan-800',
	gen_ai_llm:
		'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-800',
	schema_entity:
		'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-800',
	portal_seo:
		'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800',
};

export function InsightsNewsRegionBadge({ region }: { region: InsightsNewsRegion }) {
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${REGION_STYLE[region]}`}
		>
			{region === 'KR' ? '🇰🇷 국내' : '🌐 Global'}
		</span>
	);
}

export function InsightsNewsCategoryBadge({ category }: { category: InsightArticleCategory }) {
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${CATEGORY_STYLE[category]}`}
		>
			{INSIGHT_CATEGORY_LABEL[category]}
		</span>
	);
}
