import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export default function AdminSettingsLogsPage() {
	return (
		<AdminPlaceholder
			title="보안 및 접속 로그"
			description="보안 이벤트와 관리자 접속 로그를 조회합니다. (임시 메뉴)"
			path="/admin/settings/logs"
			badge="임시"
		/>
	);
}
