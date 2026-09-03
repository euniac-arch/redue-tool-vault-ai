import type { AsiOperation } from '@/lib/ai-search-intelligence/api/operations';
import type { AsiTier } from '@/lib/ai-search-intelligence/entitlement/tiers';

export const ASI_ENTITLEMENT_FEATURES = [
	'intro',
	'diagnose',
	'query',
	'visibility.basic',
	'opportunity.partial',
	'evidence.partial',
	'save',
	'competitor.basic',
	'opportunity.basic',
	'evidence.basic',
	'history.limited',
	'query.bulk',
	'providers.full',
	'competitor.gap',
	'evidence.explorer',
	'next-best-action',
	'visibility.monitor',
	'visibility.alert',
	'visibility.schedule',
	'history',
	'sov',
	'war-room',
] as const;

export type AsiFeatureId = (typeof ASI_ENTITLEMENT_FEATURES)[number];

/** Minimum *paid/login* tier. Never `admin` — ADMIN is a role, not a plan gate. */
export const ASI_FEATURE_MIN_TIER: Record<AsiFeatureId, AsiTier> = {
	intro: 'guest',
	diagnose: 'guest',
	query: 'guest',
	'visibility.basic': 'guest',
	'opportunity.partial': 'guest',
	'evidence.partial': 'guest',
	save: 'member',
	'history.limited': 'member',
	'competitor.basic': 'pro',
	'opportunity.basic': 'pro',
	'evidence.basic': 'pro',
	'query.bulk': 'pro',
	'providers.full': 'pro',
	'competitor.gap': 'pro',
	'evidence.explorer': 'pro',
	'next-best-action': 'pro',
	'visibility.monitor': 'pro',
	'visibility.alert': 'pro',
	'visibility.schedule': 'pro',
	history: 'pro',
	sov: 'pro',
	'war-room': 'pro',
};

export type AsiTierLimits = {
	queries: number;
	providers: number;
	opportunityRows: number;
	evidenceAnswers: number;
	history: number;
	diagnoses: number;
	monthlyQueries: number;
	monthlyProviderCalls: number;
};

/** Product monthly Query quotas. Provider-call caps are a 4× cost backstop. */
export const ASI_MONTHLY_QUERY_QUOTA: Record<AsiTier, number> = {
	guest: 10,
	member: 30,
	pro: 500,
	business: 2_000,
	admin: Number.POSITIVE_INFINITY,
};

export const ASI_TIER_LIMITS: Record<AsiTier, AsiTierLimits> = {
	guest: {
		queries: 2,
		providers: 1,
		opportunityRows: 1,
		evidenceAnswers: 1,
		history: 0,
		diagnoses: 1,
		monthlyQueries: ASI_MONTHLY_QUERY_QUOTA.guest,
		monthlyProviderCalls: ASI_MONTHLY_QUERY_QUOTA.guest * 4,
	},
	member: {
		queries: 6,
		providers: 2,
		opportunityRows: 3,
		evidenceAnswers: 3,
		history: 3,
		diagnoses: Number.POSITIVE_INFINITY,
		monthlyQueries: ASI_MONTHLY_QUERY_QUOTA.member,
		monthlyProviderCalls: ASI_MONTHLY_QUERY_QUOTA.member * 4,
	},
	pro: {
		queries: 10,
		providers: 4,
		opportunityRows: 10,
		evidenceAnswers: 20,
		history: Number.POSITIVE_INFINITY,
		diagnoses: Number.POSITIVE_INFINITY,
		monthlyQueries: ASI_MONTHLY_QUERY_QUOTA.pro,
		monthlyProviderCalls: ASI_MONTHLY_QUERY_QUOTA.pro * 4,
	},
	business: {
		queries: 10,
		providers: 4,
		opportunityRows: 10,
		evidenceAnswers: 20,
		history: Number.POSITIVE_INFINITY,
		diagnoses: Number.POSITIVE_INFINITY,
		monthlyQueries: ASI_MONTHLY_QUERY_QUOTA.business,
		monthlyProviderCalls: ASI_MONTHLY_QUERY_QUOTA.business * 4,
	},
	admin: {
		queries: 10,
		providers: 4,
		opportunityRows: Number.POSITIVE_INFINITY,
		evidenceAnswers: Number.POSITIVE_INFINITY,
		history: Number.POSITIVE_INFINITY,
		diagnoses: Number.POSITIVE_INFINITY,
		monthlyQueries: ASI_MONTHLY_QUERY_QUOTA.admin,
		monthlyProviderCalls: Number.POSITIVE_INFINITY,
	},
};

/**
 * PRO product map — actual in-app names (not marketing aliases).
 * Teasers stay on `*.partial` / `visibility.basic` (FREE). Full results are PRO.
 */
export const ASI_PRO_PRODUCTS = [
	{ name: 'AI Opportunity Finder', feature: 'opportunity.basic', slug: 'opportunity-finder' },
	{ name: 'AI Evidence Explorer', feature: 'evidence.explorer', slug: 'evidence-explorer' },
	{ name: 'Competitor Gap Engine', feature: 'competitor.gap', slug: 'competitor-gap' },
	{ name: 'Next Best Action', feature: 'next-best-action', slug: 'next-best-action' },
	{ name: 'Visibility Monitor', feature: 'visibility.monitor', slug: 'visibility-monitor' },
	{ name: 'AI Alert', feature: 'visibility.alert', slug: 'visibility-monitor' },
	{ name: 'AI Share of Voice', feature: 'sov', slug: 'share-of-voice' },
	{ name: 'Citation Intelligence', feature: 'evidence.basic', slug: 'citation-explorer' },
	{ name: 'Competitor Intelligence', feature: 'competitor.basic', slug: 'competitor-analysis' },
	{ name: 'History', feature: 'history', slug: 'war-room' },
	{ name: 'AI Query Intelligence', feature: 'query.bulk', slug: 'query-generator' },
] as const;

/** Operation → feature that must be granted to *run*. Teasers stay on partial/basic. */
export const ASI_OPERATION_FEATURE: Record<AsiOperation, AsiFeatureId> = {
	'war-room': 'war-room',
	'brand-perception': 'diagnose',
	'reputation-radar': 'diagnose',
	'brand-snapshot': 'diagnose',
	'recommendation-test': 'diagnose',
	'recommendation-simulator': 'diagnose',
	'share-of-voice': 'sov',
	'competitor-analysis': 'competitor.basic',
	'citation-explorer': 'evidence.partial',
	'query-generator': 'query',
	'visibility-monitor': 'visibility.basic',
	'agent-readiness': 'diagnose',
	'opportunity-finder': 'opportunity.partial',
	'evidence-explorer': 'evidence.partial',
	'competitor-gap': 'competitor.gap',
	'next-best-action': 'next-best-action',
};
