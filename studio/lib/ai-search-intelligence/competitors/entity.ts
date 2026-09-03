/**
 * Canonical competitor entity. Reuses BrandEntitySet keying
 * (`collectBrandEntities` / `foldEntityKey`) — no second entity system.
 */
import { competitorKey } from '@/lib/ai-search-intelligence/competitors/normalize';
import { asiDatasetScopeKey, type AsiDatasetScope } from '@/lib/ai-search-intelligence/competitors/scope';
import { normalizeAsiName } from '@/lib/ai-search-intelligence/sov/match';
import { collectBrandEntities } from '@/lib/geo/brand-entities';

export type AsiCompetitorEntity = {
	competitorId: string;
	competitorName: string;
	domain?: string;
	location?: string;
	category?: string;
	normalizedName: string;
	entityKey: string;
	aliases: string[];
};

export function toCompetitorEntity(
	name: string,
	extras?: {
		scope?: string | AsiDatasetScope;
		domain?: string;
		location?: string;
		category?: string;
	},
): AsiCompetitorEntity | null {
	const competitorName = name.trim();
	if (!competitorName) return null;
	const entities = collectBrandEntities({
		brandName: competitorName,
		domain: extras?.domain,
	});
	const entityKey = competitorKey(competitorName) || entities.keys[0] || '';
	if (!entityKey) return null;
	const scope = extras?.scope ? asiDatasetScopeKey(extras.scope) : '';
	return {
		competitorId: scope ? `${scope}::${entityKey}` : entityKey,
		competitorName: entities.canonical || competitorName,
		domain: extras?.domain?.trim() || undefined,
		location: extras?.location?.trim() || undefined,
		category: extras?.category?.trim() || undefined,
		normalizedName: normalizeAsiName(competitorName),
		entityKey,
		aliases: entities.aliases,
	};
}
