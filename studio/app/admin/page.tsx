import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import { getAdminOverview } from '@/lib/admin-data';
import { AdminAuditLeadsTable } from '@/components/AdminAuditLeadsTable';
import { AdminInjectionLog } from '@/components/AdminInjectionLog';
import { AdminUsersTable } from '@/components/AdminUsersTable';

export const dynamic = 'force-dynamic';

function formatKrw(amount: number): string {
	return `₩${Math.round(amount).toLocaleString('ko-KR')}`;
}

export default async function AdminPage() {
	const admin = await requireAdmin();
	if (!admin) {
		redirect('/');
	}

	const overview = await getAdminOverview();
	const marginTone = overview.netMarginPercent >= 0 ? 'text-emerald-600' : 'text-rose-600';

	return (
		<main className="flex flex-col gap-8">
			<section>
				<h1 className="text-2xl font-bold text-slate-900">Admin 백오피스</h1>
				<p className="mt-1 text-sm text-slate-600">
					회원 · 매출 · API 비용 · 검색엔진 색인 파이프라인을 한눈에 확인하고 운영합니다. ({admin.email})
				</p>
				<div className="mt-4 flex flex-wrap gap-2">
					<a
						href="/admin/solve"
						className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
					>
						해결 워크스페이스
					</a>
					<a
						href="/admin/projects"
						className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
					>
						프로젝트 관리
					</a>
					<a
						href="/admin/self-healing"
						className="rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-800 hover:bg-cyan-100"
					>
						◈ AI Self-Healing 관리
					</a>
					<a
						href="/builder/wp-plugin"
						className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
					>
						WP 플러그인 빌더
					</a>
				</div>
			</section>

			<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
					<p className="text-xs uppercase tracking-wide text-slate-500">총 회원수</p>
					<p className="mt-2 text-2xl font-bold text-slate-900">{overview.totalMembers.toLocaleString('ko-KR')}명</p>
				</div>
				<div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
					<p className="text-xs uppercase tracking-wide text-slate-500">이번 달 총 매출액</p>
					<p className="mt-2 text-2xl font-bold text-indigo-600">{formatKrw(overview.monthlyRevenueKrw)}</p>
				</div>
				<div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
					<p className="text-xs uppercase tracking-wide text-slate-500">이번 달 총 API 지출 비용</p>
					<p className="mt-2 text-2xl font-bold text-cyan-700">${overview.monthlyApiCostUsd.toFixed(4)}</p>
					<p className="mt-1 text-[11px] text-slate-500">≈ {formatKrw(overview.monthlyApiCostKrw)} (환율 ₩{overview.usdToKrw}/$)</p>
				</div>
				<div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
					<p className="text-xs uppercase tracking-wide text-slate-500">순수익률</p>
					<p className={`mt-2 text-2xl font-bold ${marginTone}`}>{overview.netMarginPercent.toFixed(1)}%</p>
				</div>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-sm font-bold text-slate-800">회원 관리</h2>
				<AdminUsersTable />
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-sm font-bold text-slate-800">무료 진단 리드 (Step 7 Lead Magnet)</h2>
				<AdminAuditLeadsTable />
			</section>

			<section className="flex flex-col gap-3">
				<div className="flex items-center gap-2">
					<h2 className="text-sm font-bold text-slate-800">실시간 주입 로그</h2>
					<span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
						<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> LIVE
					</span>
				</div>
				<AdminInjectionLog />
			</section>
		</main>
	);
}
