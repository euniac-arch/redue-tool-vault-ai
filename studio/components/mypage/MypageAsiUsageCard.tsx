'use client';

import { AsiUsageMeter } from '@/components/ai-search-intelligence/entitlement/AsiUsageMeter';
import { useAsiActor } from '@/lib/ai-search-intelligence/entitlement/use-asi-actor';

export function MypageAsiUsageCard() {
	const { usage } = useAsiActor();
	return <AsiUsageMeter usage={usage} />;
}
