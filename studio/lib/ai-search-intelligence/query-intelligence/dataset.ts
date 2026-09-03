/**
 * Common Query Dataset access.
 * Target Site → Universal Target Context → Universal Query Generator → this store
 * → Opportunity / Simulator / Evidence / Competitors / Gap / SOV / NBA / Visibility
 */
export {
	buildAsiQueryPool,
	clearAsiQueryPool,
	queryPoolFromSite,
	readAsiQueryDataset,
	readAsiQueryPool,
	syncAsiQueryPool,
} from '@/lib/ai-search-intelligence/target/query-pool';
export type { AsiQueryDataset, AsiQueryPoolItem, AsiQueryPoolOptions } from '@/lib/ai-search-intelligence/target/query-pool';
