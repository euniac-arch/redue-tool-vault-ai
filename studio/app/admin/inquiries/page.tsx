import { InquiryManagementDashboard } from '@/components/admin/inquiries/InquiryManagementDashboard';

export const dynamic = 'force-dynamic';

export default function AdminInquiriesPage() {
	return (
		<main className="flex flex-col gap-4">
			<div>
				<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Work Inquiries</p>
				<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">작업 문의 관리</h1>
				<p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
					홈페이지와 진단 CTA에서 접수된 작업 문의를 조회하고, 처리 상태를 변경하거나 스팸 건을 삭제합니다.
				</p>
			</div>
			<InquiryManagementDashboard />
		</main>
	);
}
