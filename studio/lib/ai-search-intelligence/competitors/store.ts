import { isAsiCompetitorVisible, type AsiCompetitorStage } from '@/lib/ai-search-intelligence/competitors/lifecycle';
import { asiDatasetScopeKey, type AsiDatasetScope } from '@/lib/ai-search-intelligence/competitors/scope';
import type { AsiEngineId } from '@/lib/ai-search-intelligence/types';

export type AsiCompetitorRecord = {
	key: string;
	name: string;
	competitorId: string;
	competitorName: string;
	domain?: string;
	location?: string;
	category?: string;
	normalizedName: string;
	entityKey: string;
	aliases: string[];
	stage: AsiCompetitorStage;
	mentionCount: number;
	recommendCount: number;
	queries: string[];
	providers: AsiEngineId[];
	engineMentions: Partial<Record<AsiEngineId, number>>;
	engineRecommends: Partial<Record<AsiEngineId, number>>;
	firstSeen: string;
	lastSeen: string;
	origin: 'live' | 'audit';
};

const STORE = new Map<string, AsiCompetitorRecord[]>();

function keyFor(scope: string | AsiDatasetScope): string {
	return asiDatasetScopeKey(scope);
}

export function clearAsiCompetitorStore(scope?: string | AsiDatasetScope) {
	if (!scope) {
		STORE.clear();
		return;
	}
	STORE.delete(keyFor(scope));
}

export function readAsiCompetitorStore(scope: string | AsiDatasetScope): AsiCompetitorRecord[] {
	return [...(STORE.get(keyFor(scope)) ?? [])];
}

export function writeAsiCompetitorStore(
	scope: string | AsiDatasetScope,
	records: readonly AsiCompetitorRecord[],
) {
	STORE.set(keyFor(scope), [...records]);
}

export function readAsiCompetitorRoster(
	scope: string | AsiDatasetScope,
	stages?: readonly AsiCompetitorStage[],
): AsiCompetitorRecord[] {
	const rows = readAsiCompetitorStore(scope);
	if (!stages?.length) return rows.filter((row) => isAsiCompetitorVisible(row.stage));
	return rows.filter((row) => stages.includes(row.stage));
}
