import { CaseStudyViewerClient } from '@/components/portfolio/CaseStudyViewerClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CaseStudyPage({
	params,
}: {
	params: { id?: string } | Promise<{ id?: string }>;
}) {
	const resolved = await Promise.resolve(params);
	const id = typeof resolved?.id === 'string' ? resolved.id.trim() : '';

	return (
		<main className="flex flex-col gap-6">
			<CaseStudyViewerClient id={id} />
		</main>
	);
}
