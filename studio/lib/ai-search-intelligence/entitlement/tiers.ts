import { isInsightsProMember } from '@/lib/insights/insights-ai-research';

/** Internal tier keys. Public plan/role names are FREE / MEMBER / PRO / BUSINESS / ADMIN. */
export const ASI_TIERS = ['guest', 'member', 'pro', 'business', 'admin'] as const;

export type AsiTier = (typeof ASI_TIERS)[number];

export const ASI_PLAN_ROLES = ['FREE', 'MEMBER', 'PRO', 'BUSINESS', 'ADMIN'] as const;

export type AsiPlanRole = (typeof ASI_PLAN_ROLES)[number];

export const ASI_TIER_RANK: Record<AsiTier, number> = {
	guest: 0,
	member: 1,
	pro: 2,
	business: 3,
	admin: 4,
};

export const ASI_PLAN_ROLE_BY_TIER: Record<AsiTier, AsiPlanRole> = {
	guest: 'FREE',
	member: 'MEMBER',
	pro: 'PRO',
	business: 'BUSINESS',
	admin: 'ADMIN',
};

export function asiPlanRole(tier: AsiTier): AsiPlanRole {
	return ASI_PLAN_ROLE_BY_TIER[tier];
}

export type AsiActorInput = {
	isLoggedIn: boolean;
	planId?: string | null;
	role?: string | null;
	isAdmin?: boolean;
	email?: string | null;
	userId?: string | null;
};

function roleLooksAdmin(role?: string | null): boolean {
	const value = (role || '').trim().toLowerCase();
	return value === 'admin';
}

/**
 * Maps the existing NextAuth + Prisma identity onto ASI tiers.
 * Does not invent a second login. Admin is a real tier, not a PRO alias.
 * Client-safe: no master-admin / prisma imports.
 */
function planLooksBusiness(planId?: string | null): boolean {
	const plan = (planId || '').trim().toLowerCase();
	return plan === 'agency' || plan === 'business';
}

export function resolveAsiTier(input: AsiActorInput): AsiTier {
	if (!input.isLoggedIn) return 'guest';
	if (input.isAdmin === true || roleLooksAdmin(input.role)) return 'admin';
	if (planLooksBusiness(input.planId)) return 'business';
	if (isInsightsProMember(input.planId, null)) return 'pro';
	return 'member';
}

export function asiTierAtLeast(tier: AsiTier, minimum: AsiTier): boolean {
	return ASI_TIER_RANK[tier] >= ASI_TIER_RANK[minimum];
}
