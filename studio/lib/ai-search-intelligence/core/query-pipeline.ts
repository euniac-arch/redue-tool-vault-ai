/**
 * Common query pipeline. A generated query is reused as-is:
 * Query → Test → Response → Analysis → Recommendation → Competitor → SOV → Citation → Monitor → War Room
 *
 * The 5 new features use `Query` (`core/models.ts`) and convert back to
 * `AIQuery` here so they never call a provider adapter directly.
 */
import { toAIQuery, toIntelligenceQuery } from '@/lib/ai-search-intelligence/core/from-asi';
import type { Query } from '@/lib/ai-search-intelligence/core/models';
import type { AsiProviderQuery } from '@/lib/ai-search-intelligence/providers/types';
import type { AsiSovQuery } from '@/lib/ai-search-intelligence/sov/query-set';
import { classifyAsiSovQuery } from '@/lib/ai-search-intelligence/sov/classify';
import type { AIQuery, AsiGeneratedQuestion, AsiQuestionIntent, AsiWarRoomSite } from '@/lib/ai-search-intelligence/types';

export function toAsiProviderQuery(query: AIQuery, site: AsiWarRoomSite): AsiProviderQuery {
	return {
		query: query.query,
		url: query.url || site.url,
		brand: query.brand || site.brandName,
		location: query.location || site.location,
		category: query.category || site.category,
	};
}

export function toAsiSovQuery(query: AIQuery): AsiSovQuery {
	const intent = query.intent;
	const category =
		intent && intent !== 'natural' ? (intent as AsiSovQuery['category']) : classifyAsiSovQuery(query.query);
	return { query: query.query, category };
}

export function generatedQuestionsToQueries(
	questions: readonly AsiGeneratedQuestion[],
	site: AsiWarRoomSite,
): AIQuery[] {
	return questions.map((item) => ({
		id: item.id,
		query: item.query,
		intent: item.intent,
		url: site.url,
		brand: site.brandName,
		location: site.location,
		category: site.category,
	}));
}

export function extraStringsToQueries(queries: readonly string[], site: AsiWarRoomSite): AIQuery[] {
	return queries
		.map((query) => query.trim())
		.filter(Boolean)
		.map((query) => ({
			query,
			intent: classifyAsiSovQuery(query) as AsiQuestionIntent,
			url: site.url,
			brand: site.brandName,
			location: site.location,
			category: site.category,
		}));
}

/** Core `Query` → existing `AIQuery`. Provider adapters still only accept `AIQuery`. */
export function intelligenceQueryToAIQuery(query: Query, site: AsiWarRoomSite): AIQuery {
	return {
		...toAIQuery(query, { url: site.url, brand: site.brandName }),
		url: site.url,
		brand: site.brandName,
		location: query.location || site.location,
		category: query.service || site.category,
	};
}

/** Core `Query` → provider port. The only allowed path from new features to engines. */
export function toAsiProviderQueryFromIntelligence(query: Query, site: AsiWarRoomSite): AsiProviderQuery {
	return toAsiProviderQuery(intelligenceQueryToAIQuery(query, site), site);
}

export function aiQueriesToIntelligenceQueries(
	queries: readonly AIQuery[],
	site: AsiWarRoomSite,
): Query[] {
	return queries.map((item) =>
		toIntelligenceQuery(item, { location: item.location || site.location, service: item.category || site.category }),
	);
}
