import type { AsiOperation } from '@/lib/ai-search-intelligence/api/operations';
import { canAccessFeature } from '@/lib/ai-search-intelligence/entitlement/can-access';
import {
	ASI_FEATURE_MIN_TIER,
	ASI_OPERATION_FEATURE,
	ASI_TIER_LIMITS,
	type AsiFeatureId,
} from '@/lib/ai-search-intelligence/entitlement/catalog';
import type { AsiActor } from '@/lib/ai-search-intelligence/entitlement/actor-model';

export type AsiRequestPrivileges = {
	operation: AsiOperation;
	queries?: readonly string[];
	expandSov?: boolean;
	expandCitations?: boolean;
	cadence?: string | null;
};

/** Operations whose *run* itself is PRO. Teasers stay off this list. */
export const ASI_HARD_PRO_OPERATIONS = (Object.keys(ASI_OPERATION_FEATURE) as AsiOperation[]).filter(
	(operation) => ASI_FEATURE_MIN_TIER[ASI_OPERATION_FEATURE[operation]] === 'pro',
);

function isScheduleCadence(value: string | null | undefined): boolean {
	return value === 'daily' || value === 'weekly' || value === 'monthly';
}

/** Features this POST must hold. Extra body flags cannot widen access. */
export function asiRequiredFeaturesForRequest(input: AsiRequestPrivileges): AsiFeatureId[] {
	const features: AsiFeatureId[] = [ASI_OPERATION_FEATURE[input.operation]];
	if (input.expandSov && input.operation !== 'share-of-voice') {
		features.push('sov');
	}
	if (input.expandCitations && input.operation !== 'citation-explorer') {
		features.push('evidence.basic');
	}
	if (isScheduleCadence(input.cadence)) {
		features.push('visibility.schedule');
	}
	if ((input.queries?.length ?? 0) > ASI_TIER_LIMITS.member.queries) {
		features.push('query.bulk');
	}
	return [...new Set(features)];
}

/** First denied feature, or null when the request may run. */
export function authorizeAsiRequest(actor: AsiActor, input: AsiRequestPrivileges): AsiFeatureId | null {
	for (const feature of asiRequiredFeaturesForRequest(input)) {
		if (!canAccessFeature(actor, feature)) return feature;
	}
	return null;
}
