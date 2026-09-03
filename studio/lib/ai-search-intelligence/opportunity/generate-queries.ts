/**
 * Opportunity query set. Reads the shared Query Pool built from Target Context.
 * Does not call providers. Does not invent industry-specific queries.
 */
import { toIntelligenceQuery } from '@/lib/ai-search-intelligence/core/from-asi';
import type { Query } from '@/lib/ai-search-intelligence/core/models';
import { targetContextFromSite } from '@/lib/ai-search-intelligence/target/context';
import { syncAsiQueryPool } from '@/lib/ai-search-intelligence/target/query-pool';
import type { AsiQuestionInput, AsiWarRoomSite } from '@/lib/ai-search-intelligence/types';

export const ASI_OPPORTUNITY_QUERY_LIMIT = 10;

export type OpportunityQuerySeed = {
	site: AsiWarRoomSite;
	questions?: Partial<AsiQuestionInput>;
	services?: readonly string[];
	competitors?: readonly string[];
	extra?: readonly string[];
	limit?: number;
};

export function generateOpportunityQueries(input: OpportunityQuerySeed): Query[] {
	const context = targetContextFromSite(input.site, {
		services: input.services,
		questions: input.questions,
	});
	const limit = input.limit ?? ASI_OPPORTUNITY_QUERY_LIMIT;
	const pool = syncAsiQueryPool(context, {
		extra: input.extra,
		competitors: input.competitors,
		limit,
		hasQuestionOverrides: Boolean(
			input.questions?.industry ||
				input.questions?.location ||
				input.questions?.service ||
				input.questions?.target,
		),
	});
	const extras = {
		location: context.location,
		service: context.services[0] || context.category,
	};
	return pool.map((item, index) =>
		toIntelligenceQuery(
			{ id: `pool-${item.category}-${index}`, query: item.query, category: item.category },
			extras,
		),
	);
}
