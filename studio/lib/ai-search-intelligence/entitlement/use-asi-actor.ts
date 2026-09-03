'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { actorFromTier, isAsiTier, type AsiActor } from '@/lib/ai-search-intelligence/entitlement/actor-model';
import {
	ASI_ACCOUNT_USAGE_EVENT,
	isPublicAsiAccountUsage,
	type PublicAsiAccountUsage,
} from '@/lib/ai-search-intelligence/entitlement/usage-public';

/**
 * Client mirror of server entitlement + monthly quota.
 * Reads only `{ tier, planRole }` and public accountUsage from GET /api/intelligence.
 */
export function useAsiActor(): { actor: AsiActor; usage: PublicAsiAccountUsage | null; ready: boolean } {
	const { status } = useSession();
	const [actor, setActor] = useState<AsiActor>(() => actorFromTier('guest'));
	const [usage, setUsage] = useState<PublicAsiAccountUsage | null>(null);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		if (status === 'loading') {
			setReady(false);
			return;
		}
		let cancelled = false;
		fetch('/api/intelligence')
			.then((res) => (res.ok ? res.json() : null))
			.then((body: { data?: { entitlement?: { tier?: string }; accountUsage?: unknown } } | null) => {
				if (cancelled) return;
				const tier = body?.data?.entitlement?.tier;
				setActor(actorFromTier(isAsiTier(tier) ? tier : 'guest'));
				setUsage(isPublicAsiAccountUsage(body?.data?.accountUsage) ? body.data.accountUsage : null);
				setReady(true);
			})
			.catch(() => {
				if (cancelled) return;
				setActor(actorFromTier('guest'));
				setUsage(null);
				setReady(true);
			});
		return () => {
			cancelled = true;
		};
	}, [status]);

	useEffect(() => {
		function onUsage(event: Event) {
			const detail = (event as CustomEvent<unknown>).detail;
			if (isPublicAsiAccountUsage(detail)) setUsage(detail);
		}
		window.addEventListener(ASI_ACCOUNT_USAGE_EVENT, onUsage);
		return () => window.removeEventListener(ASI_ACCOUNT_USAGE_EVENT, onUsage);
	}, []);

	return { actor, usage, ready };
}
