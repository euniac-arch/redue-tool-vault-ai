import { Ban, LogIn, ShieldAlert } from 'lucide-react';
import type { SecurityLogKpi } from '@/lib/admin/security-log-management';

interface SecurityLogKpiCardsProps {
	kpi: SecurityLogKpi;
}

const CARD = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-800 dark:border-slate-700';

export function SecurityLogKpiCards({ kpi }: SecurityLogKpiCardsProps) {
	return (
		<section className="grid gap-4 sm:grid-cols-3" aria-label="보안 로그 KPI 요약">
			<article className={CARD}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">오늘 로그인 시도 총합</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300">
						<LogIn className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				<p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
					{kpi.todayLoginAttempts.toLocaleString('ko-KR')}
					<span className="ml-1 text-sm font-semibold text-slate-500 dark:text-slate-400">건</span>
				</p>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">성공 + 실패 시도 합계</p>
			</article>

			<article className={`${CARD} border-rose-200`}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">비정상 접근 시도 건수</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
						<ShieldAlert className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				<p className="mt-3 text-2xl font-bold tracking-tight text-rose-600">
					{kpi.abnormalAttempts.toLocaleString('ko-KR')}
					<span className="ml-1 text-sm font-semibold text-rose-400">건</span>
				</p>
				<p className="mt-1 text-xs text-rose-500">로그인 실패 · 관리자 접근 거부 포함</p>
			</article>

			<article className={CARD}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">최근 차단된 의심 IP 수</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
						<Ban className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				<p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
					{kpi.blockedSuspiciousIps.toLocaleString('ko-KR')}
					<span className="ml-1 text-sm font-semibold text-slate-500 dark:text-slate-400">개</span>
				</p>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">최근 24시간 기준 자동 차단</p>
			</article>
		</section>
	);
}
