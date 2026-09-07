import { SubscriptionManagementDashboard } from '@/components/admin/subscriptions/SubscriptionManagementDashboard';

export const dynamic = 'force-dynamic';

export default function AdminSubscriptionsPage() {
	return (
		<main className="flex flex-col gap-4">
			<div>
				<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Billing</p>
				<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">결제 및 구독 플랜 관리</h1>
				<p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
					회원별 현재 플랜과 결제 내역을 조회하고, 필요 시 플랜을 수동 조정합니다.
				</p>
			</div>
			<SubscriptionManagementDashboard />
		</main>
	);
}
