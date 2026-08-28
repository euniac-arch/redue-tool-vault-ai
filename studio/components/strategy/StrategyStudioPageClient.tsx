'use client';

import { useSearchParams } from 'next/navigation';
import { StrategyStudioWorkbench } from '@/components/strategy/StrategyStudioWorkbench';
import { readStrategyStudioParams } from '@/lib/strategy/strategy-url';

export function StrategyStudioPageClient() {
	const searchParams = useSearchParams();
	const { auditId, url, keyword } = readStrategyStudioParams(searchParams);

	return (
		<main className="pb-8">
			<StrategyStudioWorkbench auditId={auditId} siteUrl={url} initialKeyword={keyword} />
		</main>
	);
}
