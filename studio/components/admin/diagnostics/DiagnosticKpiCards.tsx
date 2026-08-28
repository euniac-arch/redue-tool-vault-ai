import { Activity, ClipboardList, FileCheck2, Gauge } from 'lucide-react';
import type { DiagnosticKpi } from '@/lib/admin/diagnostic-management';
import { DiagnosticScoreBar } from './diagnostic-badges';

interface DiagnosticKpiCardsProps {
	kpi: DiagnosticKpi;
	loading?: boolean;
}

const CARD =
	'rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800';

export function DiagnosticKpiCards({ kpi, loading = false }: DiagnosticKpiCardsProps) {
	if (loading) {
		return (
			<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="진단 이력 KPI 로딩">
				{Array.from({ length: 4 }).map((_, index) => (
					<article key={index} className={CARD}>
						<div className="h-3 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-700" />
						<div className="mt-4 h-8 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-700" />
						<div className="mt-3 h-2 w-full animate-pulse rounded-full bg-slate-100 dark:bg-slate-700" />
					</article>
				))}
			</section>
		);
	}

	return (
		<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="진단 이력 KPI 요약">
			<article className={CARD}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">누적 진단 건수</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300">
						<ClipboardList className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				<p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
					{kpi.totalCount.toLocaleString('ko-KR')}
					<span className="ml-1 text-sm font-semibold text-slate-500 dark:text-slate-400">건</span>
				</p>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">전체 사이트 진단 이력</p>
			</article>

			<article className={CARD}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">오늘 실행된 진단</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
						<Activity className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				<p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
					{kpi.todayCount.toLocaleString('ko-KR')}
					<span className="ml-1 text-sm font-semibold text-slate-500 dark:text-slate-400">건</span>
				</p>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">금일 00:00 이후 실행분</p>
			</article>

			<article className={CARD}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">평균 GEO 점수</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300">
						<Gauge className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				<p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
					{kpi.averageGeoScore}
					<span className="ml-1 text-sm font-semibold text-slate-500 dark:text-slate-400">점</span>
				</p>
				<div className="mt-3">
					<DiagnosticScoreBar score={kpi.averageGeoScore} />
				</div>
			</article>

			<article className={CARD}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">처방 리포트 발급 수</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
						<FileCheck2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				<p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
					{kpi.prescriptionCount.toLocaleString('ko-KR')}
					<span className="ml-1 text-sm font-semibold text-slate-500 dark:text-slate-400">건</span>
				</p>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">공유 가능한 처방 리포트</p>
			</article>
		</section>
	);
}
