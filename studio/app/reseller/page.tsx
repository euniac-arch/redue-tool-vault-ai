import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { ResellerDashboard } from '@/components/ResellerDashboard';

export default async function ResellerPage() {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		redirect('/login?callbackUrl=/reseller');
	}

	return (
		<main className="flex flex-col gap-8">
			<section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#121416] via-[#0C0D0E] to-[#081018] p-7">
				<div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
				<div className="relative flex flex-col gap-3">
					<div className="flex flex-wrap items-center gap-2">
						<span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
							White-Label
						</span>
						<span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
							Reseller Partner
						</span>
					</div>
					<h1 className="text-2xl font-extrabold text-white sm:text-3xl">리셀러 파트너 대시보드</h1>
					<p className="max-w-xl text-sm text-slate-400">
						대행사·에이전시가 자사 브랜드로 REDUE AI SEO &amp; GEO를 재판매할 수 있는 백오피스입니다. 도메인
						연동, 로고·컬러 브랜딩, 하위 고객사 크레딧을 한곳에서 관리하세요.
					</p>
				</div>
			</section>

			<ResellerDashboard />
		</main>
	);
}
