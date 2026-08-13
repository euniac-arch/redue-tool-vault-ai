import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export default function AdminHistoryPage() {
	return (
		<AdminPlaceholder
			title="진단 이력 및 리포트 조회"
			description="과거 진단 이력과 리포트를 검색·조회합니다."
			path="/admin/history"
		/>
	);
}
