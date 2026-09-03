/**
 * Keyword-scoped Share of Voice tables for the unified market leaderboard.
 * Percents are computed by the universal intent engine from brand tokens,
 * live rank, and citation mix — never a hardcoded 27/16/5/52 sample pie.
 */

import {
	buildTargetBrandTokens,
	classifyQuerySovIntent,
	computeIntentAwareSovShares,
	type QuerySovIntent,
	type QuerySovShareTable,
} from '@/lib/audit/universal-sov-engine';

export type { QuerySovIntent as SovQueryIntent };

export interface SovLeaderboardItem {
	keyword: string;
	currentSov: number;
	targetSov: number;
	potentialGain: number;
	rank1: { name: string; share: number; badgeText?: string };
	rank2: { name: string; share: number; badgeText?: string };
	mySite: { name: string; share: number; rankText: string };
	thirdPartyShare: number;
	intent?: QuerySovIntent;
	clientRank?: number;
}

export interface SovShareTable {
	rank1: number;
	rank2: number;
	own: number;
	thirdParty: number;
	targetSov: number;
	potentialGain: number;
	intent?: QuerySovIntent;
	clientRank?: number;
}

export interface ResolveKeywordSovOptions {
	brandTokens?: readonly string[];
	brandName?: string;
	domain?: string;
	productTokens?: readonly string[];
	clientRank?: number;
	cited?: boolean;
	clientName?: string;
	rank1Name?: string;
	rank2Name?: string;
	lang?: 'ko' | 'en';
	placeMonopoly?: boolean;
	nicheLeadership?: boolean;
}

export function normalizeSovKeyword(keyword: string | null | undefined): string {
	return (keyword || '')
		.replace(/^#+\s*/, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export function resolveBrandTokensForSov(options?: ResolveKeywordSovOptions): string[] {
	return buildTargetBrandTokens(options?.brandTokens ?? [], options?.brandName, options?.domain);
}

export function classifySovQueryIntent(
	keyword: string | null | undefined,
	brandTokens: readonly string[] = [],
	productTokens: readonly string[] = [],
): QuerySovIntent {
	return classifyQuerySovIntent(normalizeSovKeyword(keyword), brandTokens, productTokens);
}

export function querySovToShareTable(table: QuerySovShareTable): SovShareTable {
	return {
		rank1: table.rank1,
		rank2: table.rank2,
		own: table.own,
		thirdParty: table.thirdParty,
		targetSov: table.targetSov,
		potentialGain: table.potentialGain,
		intent: table.intent,
		clientRank: table.clientRank,
	};
}

/** Generic unranked midpoint — used only as a type-level default, never as a brand-query fallback. */
export const DEFAULT_SOV_SHARE_TABLE: SovShareTable = querySovToShareTable(
	computeIntentAwareSovShares({ query: '지역 업종 추천', clientRank: 4 }),
);

/** @deprecated Mock sample pies were removed. Kept as an empty map so stale imports do not crash. */
export const SOV_SAMPLE_DATA: Record<string, SovLeaderboardItem> = {};

export function sovItemToShareTable(item: SovLeaderboardItem): SovShareTable {
	return {
		rank1: item.rank1.share,
		rank2: item.rank2.share,
		own: item.currentSov,
		thirdParty: item.thirdPartyShare,
		targetSov: item.targetSov,
		potentialGain: item.potentialGain,
		intent: item.intent,
		clientRank: item.clientRank,
	};
}

export function lookupSovSampleItem(_keyword: string | null | undefined): SovLeaderboardItem | undefined {
	return undefined;
}

export function resolveKeywordSovShares(
	keyword: string | null | undefined,
	options?: ResolveKeywordSovOptions,
): SovShareTable {
	const query = normalizeSovKeyword(keyword);
	const brandTokens = resolveBrandTokensForSov(options);
	return querySovToShareTable(
		computeIntentAwareSovShares({
			query,
			brandTokens,
			productTokens: options?.productTokens,
			clientRank: options?.clientRank,
			cited: options?.cited,
			placeMonopoly: options?.placeMonopoly,
			nicheLeadership: options?.nicheLeadership,
		}),
	);
}

function rankTextFor(clientRank: number, lang: 'ko' | 'en' = 'ko'): string {
	if (clientRank === 1 || clientRank === 2 || clientRank === 3) {
		return lang === 'en' ? `#${clientRank}` : `${clientRank}위`;
	}
	return lang === 'en' ? 'outside top 3' : '3위 밖';
}

export function resolveKeywordSovItem(
	keyword: string,
	options?: ResolveKeywordSovOptions,
): SovLeaderboardItem {
	const query = normalizeSovKeyword(keyword);
	const table = resolveKeywordSovShares(query, options);
	const clientRank = table.clientRank ?? 4;
	const displayKeyword = query ? `#${query}` : keyword;
	return {
		keyword: displayKeyword,
		currentSov: table.own,
		targetSov: table.targetSov,
		potentialGain: table.potentialGain,
		rank1: {
			name: options?.rank1Name || '',
			share: table.rank1,
			badgeText: '실시간',
		},
		rank2: {
			name: options?.rank2Name || '',
			share: table.rank2,
			badgeText: '실시간',
		},
		mySite: {
			name: options?.clientName || options?.brandName || '',
			share: table.own,
			rankText: rankTextFor(clientRank, options?.lang),
		},
		thirdPartyShare: table.thirdParty,
		intent: table.intent,
		clientRank,
	};
}
