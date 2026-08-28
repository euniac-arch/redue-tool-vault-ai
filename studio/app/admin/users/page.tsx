import { UserManagementDashboard } from '@/components/admin/users/UserManagementDashboard';

export const dynamic = 'force-dynamic';

export default function AdminUsersPage() {
	return (
		<main className="flex flex-col gap-4">
			<div>
				<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">User Management</p>
				<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">회원 관리</h1>
				<p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
					가입 계정, 멤버십, 크레딧, 진단 이력을 조회하고 운영 메모와 계정 상태를 관리합니다.
				</p>
			</div>
			<UserManagementDashboard />
		</main>
	);
}
