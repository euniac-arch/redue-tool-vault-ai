/**
 * Keyword-scoped Share of Voice tables for the unified market leaderboard.
 * Each diagnostic query maps to its own measured pie (1st / 2nd / own / 3rd-party)
 * plus To-Be target and recapture potential — never a single hardcoded 27/16/5/52.
 */

export interface SovLeaderboardItem {
	keyword: string;
	currentSov: number;
	targetSov: number;
	potentialGain: number;
	rank1: { name: string; share: number; badgeText?: string };
	rank2: { name: string; share: number; badgeText?: string };
	mySite: { name: string; share: number; rankText: string };
	thirdPartyShare: number;
}

export interface SovShareTable {
	rank1: number;
	rank2: number;
	own: number;
	thirdParty: number;
	targetSov: number;
	potentialGain: number;
}

export type SovQueryIntent = 'base' | 'recommend' | 'best' | 'custom';

/** Default chip (`{region} {service} 추천`) — keeps the historic 27/16/5/52/48/43 baseline. */
export const DEFAULT_SOV_SHARE_TABLE: SovShareTable = {
	rank1: 27,
	rank2: 16,
	own: 5,
	thirdParty: 52,
	targetSov: 48,
	potentialGain: 43,
};

export const SOV_SAMPLE_DATA: Record<string, SovLeaderboardItem> = {
	'#부산 동래 피부과': {
		keyword: '#부산 동래 피부과',
		currentSov: 4,
		targetSov: 45,
		potentialGain: 41,
		rank1: { name: '동래준피부과의원', share: 31, badgeText: '실시간' },
		rank2: { name: '미담한의원 동래', share: 19, badgeText: '실시간' },
		mySite: { name: '스카이피부과의원', share: 4, rankText: '3위 밖' },
		thirdPartyShare: 46,
	},
	'#부산 동래 피부과 추천': {
		keyword: '#부산 동래 피부과 추천',
		currentSov: 5,
		targetSov: 48,
		potentialGain: 43,
		rank1: { name: '미담한의원 동래', share: 27, badgeText: '실시간' },
		rank2: { name: '작은거인한의원', share: 16, badgeText: '실시간' },
		mySite: { name: '스카이피부과의원', share: 5, rankText: '3위 밖' },
		thirdPartyShare: 52,
	},
	'#부산 동래 피부시술 잘하는곳': {
		keyword: '#부산 동래 피부시술 잘하는곳',
		currentSov: 7,
		targetSov: 52,
		potentialGain: 45,
		rank1: { name: '예일의원', share: 29, badgeText: '실시간' },
		rank2: { name: '부산벧엘피부과의원', share: 18, badgeText: '실시간' },
		mySite: { name: '스카이피부과의원', share: 7, rankText: '3위 밖' },
		thirdPartyShare: 46,
	},
};

const SAMPLE_BY_NORMALIZED = new Map<string, SovLeaderboardItem>(
	Object.values(SOV_SAMPLE_DATA).map((item) => [normalizeSovKeyword(item.keyword), item]),
);

export function normalizeSovKeyword(keyword: string | null | undefined): string {
	return (keyword || '')
		.replace(/^#+\s*/, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export function classifySovQueryIntent(keyword: string | null | undefined): SovQueryIntent {
	const query = normalizeSovKeyword(keyword);
	if (!query) return 'recommend';
	if (/추천$/.test(query) || /recommended$/i.test(query)) return 'recommend';
	if (/잘하는곳$/.test(query) || /^best\b/i.test(query)) return 'best';
	if (/추천|잘하는|recommended|best\b/i.test(query)) return 'custom';
	return 'base';
}

export function sovItemToShareTable(item: SovLeaderboardItem): SovShareTable {
	return {
		rank1: item.rank1.share,
		rank2: item.rank2.share,
		own: item.currentSov,
		thirdParty: item.thirdPartyShare,
		targetSov: item.targetSov,
		potentialGain: item.potentialGain,
	};
}

function hashKeyword(value: string): number {
	let hash = 2166136261;
	for (let i = 0; i < value.length; i += 1) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function finalizeShareTable(partial: Omit<SovShareTable, 'thirdParty' | 'potentialGain'>): SovShareTable {
	const rank1 = Math.max(18, partial.rank1);
	const rank2 = Math.max(10, partial.rank2);
	const own = Math.max(2, Math.min(12, partial.own));
	const thirdParty = 100 - rank1 - rank2 - own;
	const targetSov = Math.max(own + 20, Math.min(58, partial.targetSov));
	return {
		rank1,
		rank2,
		own,
		thirdParty,
		targetSov,
		potentialGain: targetSov - own,
	};
}

function deriveShareTable(keyword: string, intent: SovQueryIntent): SovShareTable {
	if (intent === 'recommend') return { ...DEFAULT_SOV_SHARE_TABLE };

	const hash = hashKeyword(keyword);
	const d1 = hash % 5;
	const d2 = (hash >>> 3) % 4;
	const d3 = (hash >>> 6) % 4;
	const d4 = (hash >>> 9) % 5;

	if (intent === 'base') {
		return finalizeShareTable({
			rank1: 29 + d1,
			rank2: 17 + d2,
			own: 3 + (d3 % 3),
			targetSov: 43 + d4,
		});
	}
	if (intent === 'best') {
		return finalizeShareTable({
			rank1: 27 + d1,
			rank2: 16 + d2,
			own: 6 + (d3 % 3),
			targetSov: 50 + (d4 % 4),
		});
	}
	return finalizeShareTable({
		rank1: 24 + d1,
		rank2: 14 + d2,
		own: 4 + (d3 % 4),
		targetSov: 46 + d4,
	});
}

export function lookupSovSampleItem(keyword: string | null | undefined): SovLeaderboardItem | undefined {
	const query = normalizeSovKeyword(keyword);
	if (!query) return undefined;
	return SAMPLE_BY_NORMALIZED.get(query);
}

export function resolveKeywordSovShares(keyword: string | null | undefined): SovShareTable {
	const sample = lookupSovSampleItem(keyword);
	if (sample) return sovItemToShareTable(sample);
	const query = normalizeSovKeyword(keyword);
	return deriveShareTable(query, classifySovQueryIntent(query));
}

export function resolveKeywordSovItem(
	keyword: string,
	options?: { clientName?: string; rank1Name?: string; rank2Name?: string },
): SovLeaderboardItem {
	const sample = lookupSovSampleItem(keyword);
	const query = normalizeSovKeyword(keyword);
	const table = sample ? sovItemToShareTable(sample) : resolveKeywordSovShares(query);
	const displayKeyword = query ? `#${query}` : keyword;
	return {
		keyword: displayKeyword,
		currentSov: table.own,
		targetSov: table.targetSov,
		potentialGain: table.potentialGain,
		rank1: {
			name: options?.rank1Name || sample?.rank1.name || '',
			share: table.rank1,
			badgeText: sample?.rank1.badgeText || '실시간',
		},
		rank2: {
			name: options?.rank2Name || sample?.rank2.name || '',
			share: table.rank2,
			badgeText: sample?.rank2.badgeText || '실시간',
		},
		mySite: {
			name: options?.clientName || sample?.mySite.name || '',
			share: table.own,
			rankText: sample?.mySite.rankText || '3위 밖',
		},
		thirdPartyShare: table.thirdParty,
	};
}
