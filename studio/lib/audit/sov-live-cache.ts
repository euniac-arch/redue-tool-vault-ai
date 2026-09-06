/**
 * 24-hour cache for live SoV LLM measurements.
 * In-process Map absorbs repeat diagnoses on the same instance;
 * Firestore backs it up across cold starts when Admin is configured.
 */

import { getAdminFirestore, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import type { LiveSovAnalysisResponse } from '@/lib/audit/sov-live-measure';

export const SOV_LIVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const SOV_LIVE_COLLECTION = 'sov_live_analysis';

interface CacheEntry {
	value: LiveSovAnalysisResponse;
	expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry>();

function isFresh(entry: { expiresAt: number } | null | undefined): boolean {
	return Boolean(entry && entry.expiresAt > Date.now());
}

function pruneMemoryCache(): void {
	if (memoryCache.size < 400) return;
	const now = Date.now();
	for (const [key, entry] of memoryCache) {
		if (entry.expiresAt <= now) memoryCache.delete(key);
	}
}

export async function getCachedLiveSov(cacheKey: string): Promise<LiveSovAnalysisResponse | null> {
	const inMemory = memoryCache.get(cacheKey);
	if (isFresh(inMemory)) return inMemory!.value;
	if (inMemory) memoryCache.delete(cacheKey);

	if (!isFirebaseAdminConfigured()) return null;
	try {
		const snap = await getAdminFirestore().collection(SOV_LIVE_COLLECTION).doc(cacheKey).get();
		if (!snap.exists) return null;
		const data = snap.data() as { value?: LiveSovAnalysisResponse; expiresAtMs?: number } | undefined;
		if (!data?.value || !isFresh({ expiresAt: data.expiresAtMs ?? 0 })) return null;
		memoryCache.set(cacheKey, { value: data.value, expiresAt: data.expiresAtMs ?? 0 });
		return data.value;
	} catch (err) {
		console.error('[sov-live-cache] Firestore read failed:', err);
		return null;
	}
}

export async function setCachedLiveSov(cacheKey: string, value: LiveSovAnalysisResponse): Promise<void> {
	const expiresAt = Date.now() + SOV_LIVE_CACHE_TTL_MS;
	pruneMemoryCache();
	memoryCache.set(cacheKey, { value, expiresAt });

	if (!isFirebaseAdminConfigured()) return;
	try {
		await getAdminFirestore().collection(SOV_LIVE_COLLECTION).doc(cacheKey).set({
			value,
			expiresAtMs: expiresAt,
			brand: value.targetBrand,
			createdAt: new Date().toISOString(),
		});
	} catch (err) {
		console.error('[sov-live-cache] Firestore write failed:', err);
	}
}
