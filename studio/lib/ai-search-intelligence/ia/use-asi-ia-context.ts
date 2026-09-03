'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { composeAsiIaContext, type AsiToolContext } from '@/lib/ai-search-intelligence/ia/context';
import type { AsiIaEntryId } from '@/lib/ai-search-intelligence/routes';

export function useAsiIaContext() {
	const pathname = usePathname();
	const [context, setContext] = useState<Record<AsiIaEntryId, AsiToolContext> | null>(null);

	useEffect(() => {
		setContext(composeAsiIaContext());
	}, [pathname]);

	return context;
}
