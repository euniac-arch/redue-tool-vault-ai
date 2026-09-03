import { asiLimitsFor } from '@/lib/ai-search-intelligence/entitlement/can-access';
import type { AsiTierLimits } from '@/lib/ai-search-intelligence/entitlement/catalog';
import { ASI_TIERS, asiPlanRole, type AsiPlanRole, type AsiTier } from '@/lib/ai-search-intelligence/entitlement/tiers';

export type AsiActor = {
	tier: AsiTier;
	isLoggedIn: boolean;
	limits: AsiTierLimits;
	usageKey?: string;
};

export function actorFromTier(tier: AsiTier, usageKey?: string): AsiActor {
	return {
		tier,
		isLoggedIn: tier !== 'guest',
		limits: asiLimitsFor(tier),
		usageKey,
	};
}

export function asiUsageKeyFor(actor: AsiActor, clientKey: string): string {
	if (actor.usageKey) return actor.usageKey;
	return `guest:${clientKey || 'local'}`;
}

/** Client-safe entitlement. No keys, secrets, emails, planIds, or usage keys. */
export type PublicAsiEntitlement = {
	tier: AsiTier;
	planRole: AsiPlanRole;
};

export const PUBLIC_ASI_ENTITLEMENT_KEYS = ['tier', 'planRole'] as const;

export function publicAsiEntitlement(actor: AsiActor): PublicAsiEntitlement {
	return {
		tier: actor.tier,
		planRole: asiPlanRole(actor.tier),
	};
}

export function isAsiTier(value: unknown): value is AsiTier {
	return typeof value === 'string' && (ASI_TIERS as readonly string[]).includes(value);
}
