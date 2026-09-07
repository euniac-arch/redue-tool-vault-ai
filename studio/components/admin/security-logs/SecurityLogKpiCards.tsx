import { LogIn, ShieldAlert, Users } from 'lucide-react';
import type { SecurityLogKpi } from '@/lib/admin/security-log-management';

interface SecurityLogKpiCardsProps {
	kpi: SecurityLogKpi;
	loading?: boolean;
}

const CARD = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md';

function SkeletonValue() {
	return <div className="mt-3 h-8 w-20 animate-pulse rounded-md bg-slate-100" />;
}

export function SecurityLogKpiCards({ kpi, loading }: SecurityLogKpiCardsProps) {
	return (
		<section className="grid gap-4 sm:grid-cols-3" aria-label="보안 로그 KPI 요약">
			<article className={CARD}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">오늘 총 접속 수</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
						<LogIn className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				{loading ? (
					<SkeletonValue />
				) : (
					<p className="mt-3 text-2xl font-bold tracking-tight text-slate-800">
						{kpi.todayAccessCount.toLocaleString('ko-KR')}
						<span className="ml-1 text-sm font-semibold text-slate-500">건</span>
					</p>
				)}
				<p className="mt-1 text-xs text-slate-500">로그인 성공 + 관리자 페이지 접근</p>
			</article>

			<article className={`${CARD} border-rose-200`}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">로그인 실패 / 의심 접속</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
						<ShieldAlert className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				{loading ? (
					<SkeletonValue />
				) : (
					<p className="mt-3 text-2xl font-bold tracking-tight text-rose-600">
						{kpi.failedOrSuspiciousCount.toLocaleString('ko-KR')}
						<span className="ml-1 text-sm font-semibold text-rose-400">건</span>
					</p>
				)}
				<p className="mt-1 text-xs text-rose-500">실패 · 의심 · 접근 거부 · 쿼터 초과</p>
			</article>

			<article className={CARD}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">활성 관리자 수</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
						<Users className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				{loading ? (
					<SkeletonValue />
				) : (
					<p className="mt-3 text-2xl font-bold tracking-tight text-slate-800">
						{kpi.activeAdminCount.toLocaleString('ko-KR')}
						<span className="ml-1 text-sm font-semibold text-slate-500">명</span>
					</p>
				)}
				<p className="mt-1 text-xs text-slate-500">활성 상태의 관리자 계정</p>
			</article>
		</section>
	);
}
