import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export default function AdminSettingsNoticesPage() {
	return (
		<AdminPlaceholder
			title="공지사항 및 시스템 알림"
			description="운영 공지와 시스템 알림을 관리합니다. (임시 메뉴)"
			path="/admin/settings/notices"
			badge="임시"
		/>
	);
}
