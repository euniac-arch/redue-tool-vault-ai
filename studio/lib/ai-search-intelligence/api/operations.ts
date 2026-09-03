import type { AsiServiceAction } from '@/lib/ai-search-intelligence/adapters/port';
import type { AsiFeatureSlug } from '@/lib/ai-search-intelligence/routes';

/** Public POST operations — one per Intelligence tool. */
export const ASI_OPERATIONS = [
	'war-room',
	'brand-perception',
	'reputation-radar',
	'brand-snapshot',
	'recommendation-test',
	'recommendation-simulator',
	'share-of-voice',
	'competitor-analysis',
	'citation-explorer',
	'query-generator',
	'visibility-monitor',
	'agent-readiness',
	'opportunity-finder',
	'evidence-explorer',
	'competitor-gap',
	'next-best-action',
] as const;

export type AsiOperation = (typeof ASI_OPERATIONS)[number];

/** Pillar-level aliases kept so existing clients still resolve. */
const OPERATION_ALIASES: Record<string, AsiOperation> = {
	perception: 'brand-perception',
	recommendation: 'recommendation-test',
	evidence: 'citation-explorer',
	future: 'agent-readiness',
};

const OPERATION_TO_ACTION: Record<AsiOperation, AsiServiceAction> = {
	'war-room': 'war-room',
	'brand-perception': 'perception',
	'reputation-radar': 'perception',
	'brand-snapshot': 'perception',
	'recommendation-test': 'recommendation',
	'recommendation-simulator': 'recommendation',
	'share-of-voice': 'recommendation',
	'competitor-analysis': 'recommendation',
	'citation-explorer': 'evidence',
	'query-generator': 'evidence',
	'visibility-monitor': 'visibility',
	'agent-readiness': 'agent-readiness',
	'opportunity-finder': 'opportunity',
	'evidence-explorer': 'explorer',
	'competitor-gap': 'gap',
	'next-best-action': 'action',
};

export function isAsiOperation(value: string | undefined): value is AsiOperation {
	return Boolean(value && (ASI_OPERATIONS as readonly string[]).includes(value));
}

export function resolveAsiOperation(raw: string | undefined): AsiOperation | null {
	const value = (raw || '').trim();
	if (!value) return null;
	if (isAsiOperation(value)) return value;
	return OPERATION_ALIASES[value] ?? null;
}

export function asiOperationToAction(operation: AsiOperation): AsiServiceAction {
	return OPERATION_TO_ACTION[operation];
}

export function asiOperationFromFeature(slug: AsiFeatureSlug): AsiOperation {
	return slug;
}
