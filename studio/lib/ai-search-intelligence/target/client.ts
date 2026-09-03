/**
 * Browser-safe Target Context. Never import guard/context (async_hooks).
 * UI shares live site fields through React IntelligenceContext, not ALS.
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
