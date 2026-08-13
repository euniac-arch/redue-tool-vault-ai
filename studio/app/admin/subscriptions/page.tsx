import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export default function AdminSubscriptionsPage() {
	return (
		<AdminPlaceholder
			title="결제 및 구독 플랜 관리"
			description="구독 플랜과 결제 상태를 관리합니다. (임시 메뉴)"
			path="/admin/subscriptions"
			badge="임시"
		/>
	);
}
