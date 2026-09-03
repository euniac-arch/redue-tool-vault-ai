import { ASI_GUARD } from '@/lib/ai-search-intelligence/guard/limits';
import type { AIResponse, AsiEngineId } from '@/lib/ai-search-intelligence/types';

type CacheEntry = {
	response: AIResponse;
	storedAt: number;
};

const CACHE = new Map<string, CacheEntry>();
const COOLDOWN = new Map<string, number>();

export function asiQueryCacheKey(provider: AsiEngineId, url: string, query: string): string {
	return `${provider}::${url.trim().toLowerCase()}::${query.trim().toLowerCase()}`;
}

export function clearAsiQueryCache() {
	CACHE.clear();
	COOLDOWN.clear();
}

export function readAsiQueryCache(key: string, now = Date.now(), options?: { allowStale?: boolean }): AIResponse | null {
	const entry = CACHE.get(key);
	if (!entry) return null;
	if (now - entry.storedAt > ASI_GUARD.cacheTtlMs) {
		if (options?.allowStale) return entry.response;
		CACHE.delete(key);
		return null;
	}
	return entry.response;
}

export function writeAsiQueryCache(key: string, response: AIResponse, now = Date.now()) {
	CACHE.set(key, { response, storedAt: now });
}

export function markAsiQueryCooldown(key: string, now = Date.now()) {
	COOLDOWN.set(key, now);
}

export function isAsiQueryCoolingDown(key: string, now = Date.now()): boolean {
	const last = COOLDOWN.get(key);
	if (last == null) return false;
	if (now - last > ASI_GUARD.cooldownMs) {
		COOLDOWN.delete(key);
		return false;
	}
	return true;
}
