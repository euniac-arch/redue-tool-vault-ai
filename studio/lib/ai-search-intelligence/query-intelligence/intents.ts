/**
 * Universal Query Intent Engine.
 * Intents are structural — actual query text comes from Target Context only.
 */
import { classifyAsiSovQuery } from '@/lib/ai-search-intelligence/sov/classify';
import type { AsiQuestionIntent, AsiSovCategory } from '@/lib/ai-search-intelligence/types';

export const QUERY_INTENTS = [
	'discovery',
	'recommendation',
	'comparison',
	'local',
	'service',
	'problem',
	'expertise',
	'trust',
	'brand',
] as const;

export type QueryIntent = (typeof QUERY_INTENTS)[number];

export const QUERY_INTENT_TO_ASI: Record<QueryIntent, AsiQuestionIntent> = {
	discovery: 'discovery',
	recommendation: 'recommend',
	comparison: 'compare',
	local: 'local',
	service: 'recommend',
	problem: 'solve',
	expertise: 'recommend',
	trust: 'discovery',
	brand: 'natural',
};

export function queryIntentToAsi(intent: QueryIntent): AsiQuestionIntent {
	return QUERY_INTENT_TO_ASI[intent];
}

export function queryIntentToSovCategory(intent: QueryIntent, query: string): AsiSovCategory {
	if (intent === 'comparison') return 'compare';
	if (intent === 'local') return 'local';
	if (intent === 'problem') return 'solve';
	if (intent === 'recommendation' || intent === 'expertise') return 'recommend';
	if (intent === 'service') {
		const classified = classifyAsiSovQuery(query);
		return classified === 'purchase' ? 'purchase' : 'recommend';
	}
	return classifyAsiSovQuery(query);
}
