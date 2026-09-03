/**
 * Delta-cache persistence for Full Audit.
 * Compatible with LocalStorage / IndexedDB (JSON), Firestore, and a file cache.
 * The in-process Map is always used; remote/file backends are best-effort.
 *
 * Pure types / memory / file helpers live in `full-audit-cache-core`.
 * Firestore is a server adapter and is loaded only when persist/load actually runs,
 * so tsx score tests can import this module without pulling `server-only`.
 */

import {
	loadFileCache,
	normalizeSiteOrigin,
	readMemoryDeltaCache,
	saveFileCache,
	writeMemoryDeltaCache,
	type DeltaCacheDocument,
} from '@/lib/audit/full-audit-cache-core';

export {
	FULL_AUDIT_CACHE_COLLECTION,
	FULL_AUDIT_CACHE_KEY_PREFIX,
	clearMemoryDeltaCache,
	deltaCacheStorageKey,
	emptyDeltaCache,
	isDeltaCacheDocument,
	normalizeSiteOrigin,
	parseDeltaCache,
	peekMemoryDeltaCache,
	seedMemoryDeltaCache,
	serializeDeltaCache,
	type DeltaCacheDocument,
	type DeltaCachePage,
} from '@/lib/audit/full-audit-cache-core';

export async function loadDeltaCache(origin: string, timeoutMs = 1_200): Promise<DeltaCacheDocument | null> {
	const key = normalizeSiteOrigin(origin);
	const mem = readMemoryDeltaCache(key);
	if (mem) return mem;
	try {
		const remote = await Promise.race([
			(async () => {
				const { loadFirestoreCache } = await import('@/lib/audit/full-audit-cache-firestore');
				return (await loadFirestoreCache(key)) || (await loadFileCache(key));
			})(),
			new Promise<null>((resolve) => {
				setTimeout(() => resolve(null), timeoutMs);
			}),
		]);
		if (remote) writeMemoryDeltaCache(remote);
		return remote;
	} catch (err) {
		console.warn('[full-audit-cache] load skipped:', err instanceof Error ? err.message : err);
		return null;
	}
}

export async function saveDeltaCache(doc: DeltaCacheDocument): Promise<void> {
	const normalized: DeltaCacheDocument = {
		site_origin: normalizeSiteOrigin(doc.site_origin),
		last_full_scan: doc.last_full_scan,
		pages: { ...doc.pages },
	};
	writeMemoryDeltaCache(normalized);
	const { saveFirestoreCache } = await import('@/lib/audit/full-audit-cache-firestore');
	await Promise.all([saveFileCache(normalized), saveFirestoreCache(normalized)]);
}
