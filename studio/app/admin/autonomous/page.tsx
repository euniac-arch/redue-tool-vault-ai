import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { AutonomousMonitor } from '@/components/AutonomousMonitor';

export const dynamic = 'force-dynamic';

export default async function AdminAutonomousPage() {
	const admin = await requireAdmin();
	if (!admin) {
		redirect('/');
	}

	return (
		<main className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p className="text-xs font-semibold uppercase tracking-wide text-cyan-400/80">Admin · Step 10</p>
					<h1 className="mt-1 text-2xl font-extrabold text-white">AI Self-Healing 대시보드</h1>
					<p className="mt-1 text-sm text-slate-400">
						주간 Autonomous Webmaster Agent 파이프라인 모니터링 ({admin.email})
					</p>
				</div>
				<div className="flex gap-2">
					<Link
						href="/admin"
						className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5"
					>
						← Admin 홈
					</Link>
					<Link
						href="/builder/wp-plugin"
						className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-400/20"
					>
						WP 플러그인 빌더
					</Link>
				</div>
			</div>

			<AutonomousMonitor allowManualCron />
		</main>
	);
}
