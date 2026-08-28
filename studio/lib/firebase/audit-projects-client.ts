import { doc, getDoc } from 'firebase/firestore';
import { getClientFirestore, isFirebaseClientConfigured } from '@/lib/firebase/client';
import {
	AUDIT_PROJECT_PAGE_DETAILS_DOC_ID,
	AUDIT_PROJECT_PAGE_DETAILS_SUBCOLLECTION,
	AUDIT_PROJECTS_COLLECTION,
	mapAuditProjectDoc,
	mergeAuditProjectPageDetails,
	type AuditProjectDoc,
	type AuditProjectPageDetails,
} from '@/lib/firebase/audit-projects-types';

export type { AuditProjectDoc, AuditProjectPayload } from '@/lib/firebase/audit-projects-types';

/**
 * Client-side `getDoc` for /admin/solve hydration.
 * Prefer this in the browser when NEXT_PUBLIC_FIREBASE_* is set.
 * Re-attaches the `pageDetails` subcollection (see `splitAuditProjectPayload`) so
 * the full report shape — pageMetas included — is always returned, matching the
 * server-side `getAuditProjectById` behavior.
 */
export async function getAuditProjectByIdClient(id: string): Promise<AuditProjectDoc | null> {
	if (!id || typeof window === 'undefined' || !isFirebaseClientConfigured()) return null;
	const db = getClientFirestore();
	const ref = doc(db, AUDIT_PROJECTS_COLLECTION, id);
	const snap = await getDoc(ref);
	if (!snap.exists()) return null;
	const mapped = mapAuditProjectDoc(snap.id, snap.data() as Record<string, unknown>);
	if (!mapped) return null;

	const detailsRef = doc(
		db,
		AUDIT_PROJECTS_COLLECTION,
		id,
		AUDIT_PROJECT_PAGE_DETAILS_SUBCOLLECTION,
		AUDIT_PROJECT_PAGE_DETAILS_DOC_ID,
	);
	const pageDetails = await getDoc(detailsRef)
		.then((s) => (s.exists() ? (s.data() as AuditProjectPageDetails) : null))
		.catch(() => null);
	return mergeAuditProjectPageDetails(mapped, pageDetails);
}
