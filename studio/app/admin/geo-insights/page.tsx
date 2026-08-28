import { GeoInsightsDashboard } from '@/components/admin/geo-insights/GeoInsightsDashboard';

export const dynamic = 'force-dynamic';

export default function AdminGeoInsightsPage() {
	return (
		<main className="flex flex-col gap-4">
			<div>
				<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Insights &amp; Research</p>
				<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">AI GEO &amp; Schema 글로벌 뉴스</h1>
				<p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
					국내·글로벌 AI 검색 최적화, GEO, 스키마 마크업 관련 최신 피드를 모니터링합니다.
				</p>
			</div>
			<GeoInsightsDashboard />
		</main>
	);
}
