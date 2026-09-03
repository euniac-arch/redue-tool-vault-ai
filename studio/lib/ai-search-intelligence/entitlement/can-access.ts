import type { AsiActor } from '@/lib/ai-search-intelligence/entitlement/actor-model';
import {
	ASI_FEATURE_MIN_TIER,
	ASI_TIER_LIMITS,
	type AsiFeatureId,
	type AsiTierLimits,
} from '@/lib/ai-search-intelligence/entitlement/catalog';
import { asiTierAtLeast, resolveAsiTier, type AsiActorInput, type AsiTier } from '@/lib/ai-search-intelligence/entitlement/tiers';

export type AsiAccessSubject = AsiActor | AsiActorInput | { tier: AsiTier };

export function asiTierFromSubject(subject: AsiAccessSubject): AsiTier {
	if ('tier' in subject && subject.tier) return subject.tier;
	if ('isLoggedIn' in subject) return resolveAsiTier(subject);
	return 'guest';
}

/**
 * Feature gate. ADMIN is not rewritten to PRO.
 * ADMIN → every feature. BUSINESS/PRO → features whose minimum is PRO or below.
 */
export function canAccess(feature: AsiFeatureId, tier: AsiTier): boolean {
	if (tier === 'admin') return true;
	return asiTierAtLeast(tier, ASI_FEATURE_MIN_TIER[feature]);
}

/** Single page/API entry. Do not write `if (admin)` / `if (pro)` at call sites. */
export function canAccessFeature(user: AsiAccessSubject, feature: AsiFeatureId): boolean {
	return canAccess(feature, asiTierFromSubject(user));
}

export function asiLimitsFor(tier: AsiTier): AsiTierLimits {
	return ASI_TIER_LIMITS[tier];
}

export function asiRequiredTier(feature: AsiFeatureId): AsiTier {
	return ASI_FEATURE_MIN_TIER[feature];
}
