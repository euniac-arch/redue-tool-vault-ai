import { doc, getDoc } from 'firebase/firestore';
import { getClientFirestore, isFirebaseClientConfigured } from '@/lib/firebase/client';
import {
	AUDIT_PROJECTS_COLLECTION,
	mapAuditProjectDoc,
	type AuditProjectDoc,
} from '@/lib/firebase/audit-projects-types';

export type { AuditProjectDoc, AuditProjectPayload } from '@/lib/firebase/audit-projects-types';

/**
 * Client-side `getDoc` for /admin/solve hydration.
 * Prefer this in the browser when NEXT_PUBLIC_FIREBASE_* is set.
 */
export async function getAuditProjectByIdClient(id: string): Promise<AuditProjectDoc | null> {
	if (!id || typeof window === 'undefined' || !isFirebaseClientConfigured()) return null;
	const ref = doc(getClientFirestore(), AUDIT_PROJECTS_COLLECTION, id);
	const snap = await getDoc(ref);
	if (!snap.exists()) return null;
	return mapAuditProjectDoc(snap.id, snap.data() as Record<string, unknown>);
}
