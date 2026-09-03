'use client';

import { AsiFeatureView } from '@/components/ai-search-intelligence/AsiFeatureView';
import type { AsiResolvedRoute } from '@/lib/ai-search-intelligence/routes';

/** @deprecated Pages render AsiFeatureView directly. */
export function AiIntelligencePageClient({ route }: { route: AsiResolvedRoute }) {
	return <AsiFeatureView route={route} />;
}
