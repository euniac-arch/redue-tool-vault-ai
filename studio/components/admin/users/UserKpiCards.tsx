import { Activity, Crown, UserPlus, Users } from 'lucide-react';
import type { UserKpiSummary } from '@/lib/admin/user-management';

interface UserKpiCardsProps {
	kpi: UserKpiSummary;
}

const CARD =
	'rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-800 dark:border-slate-700';

export function UserKpiCards({ kpi }: UserKpiCardsProps) {
	return (
		<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="회원 KPI 요약">
			<article className={CARD}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">전체 회원 수</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300">
						<Users className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				<p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
					{kpi.totalMembers.toLocaleString('ko-KR')}
					<span className="ml-1 text-sm font-semibold text-slate-500 dark:text-slate-400">명</span>
				</p>
				<p className="mt-1 text-xs font-semibold text-emerald-600">+{kpi.totalMembersDeltaPct}% vs 지난달</p>
			</article>

			<article className={CARD}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">오늘 신규 가입</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
						<UserPlus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				<p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
					{kpi.todaySignups}
					<span className="ml-1 text-sm font-semibold text-slate-500 dark:text-slate-400">명</span>
				</p>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
					이메일 {kpi.todaySignupsByProvider.email} / 카카오 {kpi.todaySignupsByProvider.kakao} / 구글{' '}
					{kpi.todaySignupsByProvider.google}
				</p>
			</article>

			<article className={CARD}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">오늘 실행된 정밀진단</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
						<Activity className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				<p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
					{kpi.todayAudits.toLocaleString('ko-KR')}
					<span className="ml-1 text-sm font-semibold text-slate-500 dark:text-slate-400">건</span>
				</p>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Track 1 + Track 2 합산 실행 수</p>
			</article>

			<article className={CARD}>
				<div className="flex items-start justify-between gap-3">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">유료 플랜 활성 유저</p>
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
						<Crown className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
				</div>
				<p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
					{kpi.paidActiveUsers.toLocaleString('ko-KR')}
					<span className="ml-1 text-sm font-semibold text-slate-500 dark:text-slate-400">명</span>
				</p>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Pro &amp; Enterprise</p>
			</article>
		</section>
	);
}
