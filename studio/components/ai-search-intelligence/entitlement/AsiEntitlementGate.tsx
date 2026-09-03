'use client';

import type { ReactNode } from 'react';
import { AsiLockPanel } from '@/components/ai-search-intelligence/entitlement/AsiLockPanel';
import { canAccessFeature, type AsiFeatureId } from '@/lib/ai-search-intelligence/entitlement';
import { useAsiActor } from '@/lib/ai-search-intelligence/entitlement/use-asi-actor';

export function AsiEntitlementGate({ feature, children }: { feature: AsiFeatureId; children: ReactNode }) {
	const { actor, ready } = useAsiActor();
	if (!ready) {
		return <div className="min-h-[12rem] animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" aria-hidden />;
	}
	if (canAccessFeature(actor, feature)) return <>{children}</>;
	return <AsiLockPanel feature={feature} tier={actor.tier} />;
}
