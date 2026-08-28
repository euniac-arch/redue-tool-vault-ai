import { ClipboardList, Clock3, Sparkles } from 'lucide-react';
import type { SystemLogKpi } from '@/lib/admin/system-log-management';

interface SystemLogKpiCardsProps {
	kpi: SystemLogKpi;
}

const CARD = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-800 dark:border-slate-700';

export function SystemLogKpiCards({ kpi }: SystemLogKpiCardsProps) {
	return (
		<section className="grid gap-4 sm:grid-cols-3" aria-label="시스템 작업 KPI 요약">
			<article className={CARD}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">총 작업 건수</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300">
						<ClipboardList className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				<p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
					{kpi.totalJobs.toLocaleString('ko-KR')}
					<span className="ml-1 text-sm font-semibold text-slate-500 dark:text-slate-400">건</span>
				</p>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">누적 운영 작업 기록</p>
			</article>

			<article className={CARD}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">금일 변경 사항</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
						<Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				<p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
					{kpi.todayChanges.toLocaleString('ko-KR')}
					<span className="ml-1 text-sm font-semibold text-slate-500 dark:text-slate-400">건</span>
				</p>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">오늘 발생한 작업·이벤트</p>
			</article>

			<article className={CARD}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">대기 중인 작업</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
						<Clock3 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				<p className="mt-3 text-2xl font-bold tracking-tight text-amber-700">
					{kpi.pendingJobs.toLocaleString('ko-KR')}
					<span className="ml-1 text-sm font-semibold text-amber-500">건</span>
				</p>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">승인 또는 후속 처리 필요</p>
			</article>
		</section>
	);
}
