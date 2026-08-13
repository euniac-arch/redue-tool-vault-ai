import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export default function AdminUsersPage() {
	return (
		<AdminPlaceholder
			title="회원 목록 및 권한 관리"
			description="회원 계정과 관리자 권한을 관리합니다. (임시 메뉴)"
			path="/admin/users"
			badge="임시"
		/>
	);
}
