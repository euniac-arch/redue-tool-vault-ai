import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export default function AdminUsagePage() {
	return (
		<AdminPlaceholder
			title="API 사용량 및 쿼터 관리"
			description="API 사용량과 쿼터를 모니터링합니다. (임시 메뉴)"
			path="/admin/usage"
			badge="임시"
		/>
	);
}
