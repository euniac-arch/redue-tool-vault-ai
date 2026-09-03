/**
 * Brand Perception runner. Provider I/O only through runAsiQueryPlan.
 */
import type { AsiRunInput } from '@/lib/ai-search-intelligence/adapters/port';
import {
	aliasesForBrand,
	buildPerceptionSnapshotFromResponses,
	resolvePerceptionSite,
} from '@/lib/ai-search-intelligence/perception/analyze';
import { flattenAsiQueryPlan, runAsiQueryPlan } from '@/lib/ai-search-intelligence/providers/query-plan';
import { defaultRecommendQuery, servicesFromAudit } from '@/lib/ai-search-intelligence/target';
import type { AsiPerceptionSnapshot } from '@/lib/ai-search-intelligence/types';

export async function runAsiPerception(input: AsiRunInput): Promise<AsiPerceptionSnapshot | null> {
	const resolved = resolvePerceptionSite(input);
	if (!resolved) return null;
	const { site, boundFromAudit } = resolved;
	const aliases = aliasesForBrand(site.brandName, site.domain);
	const query =
		input.query?.trim() ||
		defaultRecommendQuery({
			brandName: site.brandName,
			location: site.location,
			category: site.category,
			services: servicesFromAudit(input, site.category),
		});

	const planned = await runAsiQueryPlan({
		queries: [query],
		url: site.url,
		brand: site.brandName,
		domain: site.domain,
		location: site.location,
		category: site.category,
		limit: 1,
	});

	return buildPerceptionSnapshotFromResponses({
		site,
		responses: flattenAsiQueryPlan(planned),
		boundFromAudit,
		audit: input.audit,
		aliases,
	});
}
