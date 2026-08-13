import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export default function AdminSettingsApiPage() {
	return (
		<AdminPlaceholder
			title="API Key & Firebase 설정"
			description="외부 API 키와 Firebase 연결 설정을 관리합니다. (임시 메뉴)"
			path="/admin/settings/api"
			badge="임시"
		/>
	);
}
