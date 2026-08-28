import { commerceBlueprintProfile } from '@/lib/strategy/profiles/commerce';
import { genericBlueprintProfile } from '@/lib/strategy/profiles/generic';
import { legalBlueprintProfile } from '@/lib/strategy/profiles/legal';
import { medicalBlueprintProfile } from '@/lib/strategy/profiles/medical';
import type { BlueprintProfile, BlueprintVariant } from '@/lib/strategy/profiles/types';
import { veterinaryBlueprintProfile } from '@/lib/strategy/profiles/veterinary';

export type { BlueprintProfile, BlueprintVariant, CitationEntity } from '@/lib/strategy/profiles/types';
export { pickLocale } from '@/lib/strategy/profiles/types';

export const INDUSTRY_BLUEPRINT_PROFILES: Record<string, BlueprintProfile> = {
	medical: medicalBlueprintProfile,
	veterinary: veterinaryBlueprintProfile,
	legal: legalBlueprintProfile,
	commerce: commerceBlueprintProfile,
	default: genericBlueprintProfile,
};

/** Registry vertical → blueprint profile key. Lookup only — no industry if-branches in engines. */
const BLUEPRINT_PROFILE_ALIASES: Record<string, string> = {
	medical: 'medical',
	veterinary: 'veterinary',
	legal: 'legal',
	commerce: 'commerce',
	accounting: 'default',
	beauty: 'commerce',
	restaurant: 'commerce',
	realestate: 'commerce',
	interior: 'commerce',
	fitness: 'default',
	education: 'default',
	professional: 'default',
	general: 'default',
};

export function resolveBlueprintProfile(registryType: string | null | undefined): BlueprintProfile {
	const key = (registryType || '').trim().toLowerCase();
	const mapped = BLUEPRINT_PROFILE_ALIASES[key] || key;
	return INDUSTRY_BLUEPRINT_PROFILES[mapped] ?? INDUSTRY_BLUEPRINT_PROFILES.default;
}

export function matchBlueprintVariant(profile: BlueprintProfile, hay: string): BlueprintVariant {
	const corpus = hay || '';
	for (const item of profile.variants) {
		if (item.patterns.some((pattern) => pattern.test(corpus))) return item;
	}
	return profile.fallback;
}

export function citationHay(parts: readonly (string | null | undefined)[]): string {
	return parts.filter((part): part is string => Boolean(part && String(part).trim())).join(' ');
}
