import { AdminAiTools } from '@/components/admin/ai-tools/AdminAiTools';

export const dynamic = 'force-dynamic';

export default function AdminAiToolsPage() {
	return (
		<main className="flex flex-col gap-4">
			<AdminAiTools />
		</main>
	);
}
