import { GuideAdminWorkspace } from '@/components/guide/GuideAdminWorkspace';

export const dynamic = 'force-dynamic';

export default function AdminGuidesPage() {
	return (
		<main className="flex flex-col gap-4">
			<GuideAdminWorkspace />
		</main>
	);
}
