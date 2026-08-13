import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | null {
	if (typeof value === 'string' && value.trim()) return value.trim();
	if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) return value[0].trim();
	return null;
}

/** Legacy path — menu now lives at `/admin/self-healing`. */
export default function AdminAutonomousRedirectPage({
	searchParams,
}: {
	searchParams: SearchParams;
}) {
	const id = firstParam(searchParams.id) || firstParam(searchParams.auditId);
	redirect(id ? `/admin/self-healing?id=${encodeURIComponent(id)}` : '/admin/self-healing');
}
