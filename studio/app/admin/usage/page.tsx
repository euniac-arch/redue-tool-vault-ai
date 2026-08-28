import { ApiUsageDashboard } from '@/components/admin/usage/ApiUsageDashboard';

export const dynamic = 'force-dynamic';

export default function AdminUsagePage() {
	return (
		<main className="flex flex-col gap-4">
			<ApiUsageDashboard />
		</main>
	);
}
