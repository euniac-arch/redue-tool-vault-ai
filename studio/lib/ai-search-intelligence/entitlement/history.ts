import { canAccessFeature } from '@/lib/ai-search-intelligence/entitlement/can-access';
import type { AsiActor } from '@/lib/ai-search-intelligence/entitlement/actor-model';

/** Full History is PRO. Members keep a short list. FREE has none. */
export function asiHistoryCap(actor: AsiActor): number {
	if (canAccessFeature(actor, 'history')) return Number.POSITIVE_INFINITY;
	if (canAccessFeature(actor, 'history.limited')) return actor.limits.history;
	return 0;
}

export function asiCanSaveHistory(actor: AsiActor): boolean {
	return asiHistoryCap(actor) > 0;
}
