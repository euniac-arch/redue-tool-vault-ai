'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useIntelligenceOptional } from '@/components/ai-search-intelligence/shell/IntelligenceContext';
import { composeAsiIaContext, type AsiToolContext } from '@/lib/ai-search-intelligence/ia/context';
import type { AsiIaEntryId } from '@/lib/ai-search-intelligence/routes';

export function useAsiIaContext() {
	const pathname = usePathname();
	const intel = useIntelligenceOptional();
	const [fallback, setFallback] = useState<Record<AsiIaEntryId, AsiToolContext> | null>(null);

	useEffect(() => {
		if (intel?.toolResults) return;
		setFallback(composeAsiIaContext(intel?.targetUrl || null));
	}, [pathname, intel?.analysisEpoch, intel?.targetUrl, intel?.toolResults]);

	return intel?.toolResults ?? fallback;
}
