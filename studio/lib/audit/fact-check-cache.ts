/**
 * 10-minute response cache for the AI schema fact-check endpoint, keyed by
 * `hash(url) + hash(schema)` (see `computeFactCheckCacheKey`). An in-process
 * Map absorbs bursty repeat calls within one server instance; Firestore
 * backs it up across instances/cold-starts when Firebase Admin is configured.
 */

import { getAdminFirestore, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import type { FactCheckResponse } from '@/lib/audit/fact-check';

export const FACT_CHECK_CACHE_TTL_MS = 10 * 60 * 1000;
export const FACT_CHECK_COLLECTION = 'schema_fact_checks';

interface CacheEntry {
	value: FactCheckResponse;
	expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry>();

function isFresh(entry: { expiresAt: number } | null | undefined): boolean {
	return Boolean(entry && entry.expiresAt > Date.now());
}

function pruneMemoryCache(): void {
	if (memoryCache.size < 500) return;
	const now = Date.now();
	for (const [key, entry] of memoryCache) {
		if (entry.expiresAt <= now) memoryCache.delete(key);
	}
}

export async function getCachedFactCheck(cacheKey: string): Promise<FactCheckResponse | null> {
	const inMemory = memoryCache.get(cacheKey);
	if (isFresh(inMemory)) return inMemory!.value;
	if (inMemory) memoryCache.delete(cacheKey);

	if (!isFirebaseAdminConfigured()) return null;
	try {
		const snap = await getAdminFirestore().collection(FACT_CHECK_COLLECTION).doc(cacheKey).get();
		if (!snap.exists) return null;
		const data = snap.data() as { value?: FactCheckResponse; expiresAtMs?: number } | undefined;
		if (!data?.value || !isFresh({ expiresAt: data.expiresAtMs ?? 0 })) return null;
		memoryCache.set(cacheKey, { value: data.value, expiresAt: data.expiresAtMs ?? 0 });
		return data.value;
	} catch (err) {
		console.error('[fact-check-cache] Firestore read failed:', err);
		return null;
	}
}

export async function setCachedFactCheck(cacheKey: string, value: FactCheckResponse): Promise<void> {
	const expiresAt = Date.now() + FACT_CHECK_CACHE_TTL_MS;
	pruneMemoryCache();
	memoryCache.set(cacheKey, { value, expiresAt });

	if (!isFirebaseAdminConfigured()) return;
	try {
		await getAdminFirestore().collection(FACT_CHECK_COLLECTION).doc(cacheKey).set({
			value,
			expiresAtMs: expiresAt,
			url: value.url,
			createdAt: new Date().toISOString(),
		});
	} catch (err) {
		console.error('[fact-check-cache] Firestore write failed:', err);
	}
}
