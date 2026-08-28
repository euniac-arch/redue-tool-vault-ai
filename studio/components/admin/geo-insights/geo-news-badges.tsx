import type { GeoNewsCategory, GeoNewsRegion } from '@/lib/admin/geo-news-management';
import { CATEGORY_LABEL } from '@/lib/admin/geo-news-management';

const REGION_STYLE: Record<GeoNewsRegion, string> = {
	KR: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800',
	GLOBAL: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-800',
};

const CATEGORY_STYLE: Record<GeoNewsCategory, string> = {
	GEO: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800',
	'Schema Markup': 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-800',
	'Search Engine': 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800',
	'AI Model': 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-800',
};

export function GeoNewsRegionBadge({ region }: { region: GeoNewsRegion }) {
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${REGION_STYLE[region]}`}
		>
			{region === 'KR' ? '🇰🇷 국내' : '🌐 Global'}
		</span>
	);
}

export function GeoNewsCategoryBadge({ category }: { category: GeoNewsCategory }) {
	return (
		<span
			className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ${CATEGORY_STYLE[category]}`}
		>
			{CATEGORY_LABEL[category]}
		</span>
	);
}
