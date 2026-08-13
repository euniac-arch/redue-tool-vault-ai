import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export default function AdminScanPage() {
	return (
		<AdminPlaceholder
			title="실시간 URL 진단 실행"
			description="URL을 즉시 진단하고 결과를 해결 워크스페이스로 연결합니다."
			path="/admin/scan"
		/>
	);
}
