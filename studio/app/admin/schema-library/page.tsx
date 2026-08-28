import { SchemaLibraryWorkbench } from '@/components/admin/schema-library/SchemaLibraryWorkbench';

export const dynamic = 'force-dynamic';

export default function AdminSchemaLibraryPage() {
	return (
		<main className="flex flex-col gap-4">
			<SchemaLibraryWorkbench />
		</main>
	);
}
