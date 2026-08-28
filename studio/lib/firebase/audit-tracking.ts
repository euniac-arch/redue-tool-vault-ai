/**
 * Server-side (Admin SDK) persistence for the lightweight "4주 추이" round-tracking
 * history. One document per domain in the `audit_tracking` collection, keyed by
 * `sanitizeUrlToDocId(domain)`. Every write is a small (~1KB) JSON object — this is
 * the durable source of truth for round score trends, decoupled from the much
 * larger per-browser localStorage cache that still holds full frozen reports.
 *
 * Gracefully no-ops (returns null / echoes input) when Firebase Admin is not
 * configured, mirroring the `audit-projects.ts` / old `milestone-snapshots.ts`
 * conventions used elsewhere in this codebase.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { stripUndefinedDeep } from '@/lib/firebase/audit-projects-types';
import {
	AUDIT_TRACKING_COLLECTION,
	emptyAuditTrackingDoc,
	sanitizeUrlToDocId,
	type AuditTrackingDoc,
	type RoundSnapshot,
	type TrackingRound,
} from '@/lib/audit/round-tracking-types';

export async function getAuditTrackingHistory(domain: string): Promise<AuditTrackingDoc | null> {
	const key = domain?.trim() || '';
	if (!key || !isFirebaseAdminConfigured()) return null;

	const snap = await getAdminFirestore()
		.collection(AUDIT_TRACKING_COLLECTION)
		.doc(sanitizeUrlToDocId(key))
		.get();
	if (!snap.exists) return null;

	const data = snap.data() as Record<string, unknown> | undefined;
	if (!data) return null;
	return {
		domain: (data.domain as string) || key,
		rounds: (data.rounds as AuditTrackingDoc['rounds']) ?? {},
		updatedAt:
			typeof data.updatedAt === 'string'
				? data.updatedAt
				: (data.updatedAt as { toDate?: () => Date })?.toDate?.().toISOString(),
	};
}

/**
 * Upsert a single round slot into the domain's tracking document.
 * `setDoc`-with-merge semantics: read-modify-write against whatever rounds are
 * already stored server-side, so concurrent writes for different rounds never
 * clobber each other.
 */
export async function saveRoundSnapshot(
	domain: string,
	round: TrackingRound,
	snapshot: RoundSnapshot,
): Promise<AuditTrackingDoc> {
	const key = domain?.trim() || '';
	if (!key || !isFirebaseAdminConfigured()) {
		return { ...emptyAuditTrackingDoc(key), rounds: { [round]: snapshot } };
	}

	const db = getAdminFirestore();
	const ref = db.collection(AUDIT_TRACKING_COLLECTION).doc(sanitizeUrlToDocId(key));
	const existing = await ref.get();
	const existingRounds = existing.exists
		? ((existing.data()?.rounds as AuditTrackingDoc['rounds']) ?? {})
		: {};

	const mergedRounds = { ...existingRounds, [round]: snapshot };

	await ref.set(
		{
			domain: key,
			rounds: stripUndefinedDeep(mergedRounds),
			updatedAt: FieldValue.serverTimestamp(),
		},
		{ merge: true },
	);

	return {
		domain: key,
		rounds: mergedRounds,
		updatedAt: new Date().toISOString(),
	};
}
