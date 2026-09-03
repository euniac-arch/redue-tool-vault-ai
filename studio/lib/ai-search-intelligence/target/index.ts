/**
 * Target Context public API.
 * Client UI must import from `./client` — this barrel stays free of
 * Node `async_hooks` / request ALS. Query-pool helpers are pure functions.
 */
export {
	auditCompetitorNames,
	getSiteIntelligenceContext,
	resolveAsiTargetContext,
	servicesFromAudit,
	targetContextFromSite,
	toAsiWarRoomSite,
} from '@/lib/ai-search-intelligence/target/context';
export type { AsiTargetContext, AsiTargetInput } from '@/lib/ai-search-intelligence/target/context';
export {
	loadMatchingAuditPayload,
	matchingAuditForUrl,
	matchingSiteMeta,
} from '@/lib/ai-search-intelligence/target/matching-audit';
export {
	buildAsiQueryPool,
	clearAsiQueryPool,
	defaultRecommendQuery,
	exampleSearchQuery,
	queryPoolFromSite,
	readAsiQueryDataset,
	readAsiQueryPool,
	syncAsiQueryPool,
} from '@/lib/ai-search-intelligence/target/query-pool';
export type { AsiQueryDataset, AsiQueryPoolItem, AsiQueryPoolOptions } from '@/lib/ai-search-intelligence/target/query-pool';
