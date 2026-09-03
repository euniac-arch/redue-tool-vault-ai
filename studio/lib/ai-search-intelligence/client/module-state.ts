import { asiSitesMatch, normalizeAsiSiteUrl } from '@/lib/ai-search-intelligence/normalize-site-url';
import {
	ASI_IA_ENTRY_IDS,
	type AsiIaEntryId,
} from '@/lib/ai-search-intelligence/routes';

export type SubModuleState = {
	isLoading: boolean;
	data: unknown | null;
	error: string | null;
	lastAnalyzedUrl?: string;
};

export function emptySubModuleState(): SubModuleState {
	return { isLoading: false, data: null, error: null };
}

export function createEmptyModules(): Record<AsiIaEntryId, SubModuleState> {
	return Object.fromEntries(ASI_IA_ENTRY_IDS.map((id) => [id, emptySubModuleState()])) as Record<
		AsiIaEntryId,
		SubModuleState
	>;
}

export function moduleHasFreshCache(state: SubModuleState | undefined, url: string): boolean {
	const normalized = normalizeAsiSiteUrl(url);
	if (!normalized || !state?.lastAnalyzedUrl || state.data == null) return false;
	return asiSitesMatch(state.lastAnalyzedUrl, normalized);
}

export function shouldLazyAnalyzeModule(input: {
	targetUrl: string;
	cacheReady: boolean;
	startedKey?: string | null;
	analysisEpoch: number;
}): string | null {
	const url = normalizeAsiSiteUrl(input.targetUrl);
	if (!url || input.cacheReady) return null;
	const runKey = `${input.analysisEpoch}:${url}`;
	if (input.startedKey === runKey) return null;
	return url;
}
