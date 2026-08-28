import { NoticeManagementDashboard } from '@/components/admin/notices/NoticeManagementDashboard';

export const dynamic = 'force-dynamic';

export default function AdminNoticesPage() {
	return (
		<main className="flex flex-col gap-4">
			<div>
				<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Notice Center</p>
				<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">공지사항 및 시스템 알림 관리</h1>
				<p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
					일반 안내, 시스템 점검, 이벤트 알림을 등록하고 노출 대상·게시 상태를 관리합니다.
				</p>
			</div>
			<NoticeManagementDashboard />
		</main>
	);
}
