import { canAccessFeature } from '@/lib/ai-search-intelligence/entitlement/can-access';
import { ASI_PRO_PRODUCTS, type AsiFeatureId } from '@/lib/ai-search-intelligence/entitlement/catalog';
import type { AsiActor } from '@/lib/ai-search-intelligence/entitlement/actor-model';
import { ASI_BASE } from '@/lib/ai-search-intelligence/routes';

export type AsiLockIntent = 'login' | 'upgrade' | 'enter';

/** Guest → login. Member → upgrade. PRO/ADMIN (canAccess) → enter the tool. */
export function resolveAsiLockIntent(actor: AsiActor, feature: AsiFeatureId): AsiLockIntent {
	if (canAccessFeature(actor, feature)) return 'enter';
	if (!actor.isLoggedIn || actor.tier === 'guest') return 'login';
	return 'upgrade';
}

function hrefForSlug(slug: string, feature: AsiFeatureId): string {
	if (feature === 'visibility.alert') return `${ASI_BASE}/visibility-monitor#asi-alerts`;
	if (slug === 'war-room') return ASI_BASE;
	return `${ASI_BASE}/${slug}`;
}

const PRODUCT_HREF = Object.fromEntries(
	ASI_PRO_PRODUCTS.map((row) => [row.feature, hrefForSlug(row.slug, row.feature)]),
) as Partial<Record<AsiFeatureId, string>>;

const FEATURE_HREF: Record<AsiFeatureId, string> = {
	intro: ASI_BASE,
	diagnose: ASI_BASE,
	query: `${ASI_BASE}/query-generator`,
	'visibility.basic': `${ASI_BASE}/visibility-monitor`,
	'opportunity.partial': `${ASI_BASE}/opportunity-finder`,
	'evidence.partial': `${ASI_BASE}/evidence-explorer`,
	save: ASI_BASE,
	'history.limited': ASI_BASE,
	'providers.full': ASI_BASE,
	'visibility.schedule': `${ASI_BASE}/visibility-monitor`,
	'war-room': ASI_BASE,
	'competitor.basic': `${ASI_BASE}/competitor-analysis`,
	'opportunity.basic': `${ASI_BASE}/opportunity-finder`,
	'evidence.basic': `${ASI_BASE}/citation-explorer`,
	'query.bulk': `${ASI_BASE}/query-generator`,
	'competitor.gap': `${ASI_BASE}/competitor-gap`,
	'evidence.explorer': `${ASI_BASE}/evidence-explorer`,
	'next-best-action': `${ASI_BASE}/next-best-action`,
	'visibility.monitor': `${ASI_BASE}/visibility-monitor`,
	'visibility.alert': `${ASI_BASE}/visibility-monitor#asi-alerts`,
	history: ASI_BASE,
	sov: `${ASI_BASE}/share-of-voice`,
	...PRODUCT_HREF,
};

export function asiHrefForFeature(feature: AsiFeatureId): string {
	return FEATURE_HREF[feature] ?? ASI_BASE;
}
