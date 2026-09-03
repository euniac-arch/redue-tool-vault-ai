import type { AsiRunInput } from '@/lib/ai-search-intelligence/adapters/port';
import { loadMatchingAuditPayload } from '@/lib/ai-search-intelligence/target/client';
import type { AsiTargetContext } from '@/lib/ai-search-intelligence/target/client';

/**
 * Build a tool run payload from the shared top-bar site only.
 * Callers must not pass a raw URL from a sub-tool form.
 */
export function inputFromCurrentSite(site: AsiTargetContext): AsiRunInput {
	return {
		url: site.siteUrl,
		audit: loadMatchingAuditPayload(site.siteUrl),
		questions: {
			industry: site.industry || site.category || '',
			location: site.location || '',
			service: site.services[0] || '',
			target: site.targetAudience || '',
		},
	};
}
