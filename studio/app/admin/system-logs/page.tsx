import { SystemLogDashboard } from '@/components/admin/system-logs/SystemLogDashboard';

export const dynamic = 'force-dynamic';

export default function AdminSystemLogsPage() {
	return (
		<main className="flex flex-col gap-4">
			<div>
				<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Operations History</p>
				<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">시스템 운영 및 작업 내역</h1>
				<p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
					운영진의 관리 작업과 시스템 이벤트 히스토리를 조회하고 CSV로 내보냅니다.
				</p>
			</div>
			<SystemLogDashboard />
		</main>
	);
}
