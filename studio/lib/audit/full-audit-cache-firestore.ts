/**
 * Full-audit delta cache — Firestore adapter.
 * Imports firebase/admin (server-only). Do not import this from tsx score tests.
 */

import { getAdminFirestore, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import {
	FULL_AUDIT_CACHE_COLLECTION,
	isDeltaCacheDocument,
	originDocId,
	type DeltaCacheDocument,
} from '@/lib/audit/full-audit-cache-core';

export async function loadFirestoreCache(origin: string): Promise<DeltaCacheDocument | null> {
	if (!isFirebaseAdminConfigured()) return null;
	try {
		const snap = await getAdminFirestore().collection(FULL_AUDIT_CACHE_COLLECTION).doc(originDocId(origin)).get();
		if (!snap.exists) return null;
		const data = snap.data() as DeltaCacheDocument | undefined;
		return isDeltaCacheDocument(data) ? data : null;
	} catch (err) {
		console.warn('[full-audit-cache] Firestore read skipped:', err instanceof Error ? err.message : err);
		return null;
	}
}

export async function saveFirestoreCache(doc: DeltaCacheDocument): Promise<void> {
	if (!isFirebaseAdminConfigured()) return;
	try {
		await getAdminFirestore().collection(FULL_AUDIT_CACHE_COLLECTION).doc(originDocId(doc.site_origin)).set({
			...doc,
			updatedAt: new Date().toISOString(),
		});
	} catch (err) {
		console.warn('[full-audit-cache] Firestore write skipped:', err instanceof Error ? err.message : err);
	}
}
