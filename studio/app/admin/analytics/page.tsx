import { AnalyticsDashboard } from '@/components/admin/analytics/AnalyticsDashboard';

export const dynamic = 'force-dynamic';

export default function AdminAnalyticsPage() {
	return (
		<main className="flex flex-col gap-4">
			<div>
				<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Site Analytics</p>
				<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">웹 분석 대시보드</h1>
				<p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
					일별 방문자, 유입 경로(Referrer/UTM), 디바이스·브라우저 통계를 확인합니다. 검색엔진·AI 크롤러 등 봇 트래픽은 자동으로 집계에서 제외됩니다.
				</p>
			</div>
			<AnalyticsDashboard />
		</main>
	);
}
