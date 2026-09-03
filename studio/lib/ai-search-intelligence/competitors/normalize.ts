import { nameMatchesBrand, normalizeAsiName } from '@/lib/ai-search-intelligence/sov/match';

/**
 * Business-entity suffixes across industries (medical, hospitality, legal,
 * food, retail, general corporate) — never a single vertical. Target sites
 * from any category must fold consistently here.
 */
const LEGAL_SUFFIX =
	/(의원|병원|클리닉|치과|한의원|호텔|리조트|법률사무소|법무법인|로펌|식당|레스토랑|쇼핑몰|백화점|마트|주식회사|clinic|hospital|hotel|resort|law firm|restaurant|mall|inc\.?|corp\.?|ltd\.?|llc)$/i;

export function brandAliases(brand: string, domain: string): string[] {
	const host = domain.split('.')[0] || '';
	return [brand, host].filter(Boolean);
}

/** Fold legal suffixes so a name and "name + entity suffix" share one key. */
export function competitorKey(name: string): string {
	const folded = normalizeAsiName(name);
	if (!folded) return '';
	const stripped = folded.replace(LEGAL_SUFFIX, '');
	return stripped.length >= 2 ? stripped : folded;
}

export function pickCompetitorDisplayName(current: string, incoming: string): string {
	const next = incoming.trim();
	if (!next) return current;
	if (!current.trim()) return next;
	if (next.length > current.length) return next;
	return current;
}

export function isOwnBrandName(name: string, brand: string, aliases: readonly string[] = []): boolean {
	return nameMatchesBrand(name, brand, aliases);
}
