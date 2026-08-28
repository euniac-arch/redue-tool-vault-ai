import { SecurityLogDashboard } from '@/components/admin/security-logs/SecurityLogDashboard';

export const dynamic = 'force-dynamic';

export default function AdminSettingsLogsPage() {
	return (
		<main className="flex flex-col gap-4">
			<div>
				<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Security Center</p>
				<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">보안 및 접속 로그 관리</h1>
				<p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
					로그인/비밀번호 재설정/관리자 접근 이벤트를 모니터링하고 이상 접속을 추적합니다.
				</p>
			</div>
			<SecurityLogDashboard />
		</main>
	);
}
