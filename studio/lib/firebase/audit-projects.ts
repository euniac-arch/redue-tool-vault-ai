import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import {
	AUDIT_PROJECT_PAGE_DETAILS_DOC_ID,
	AUDIT_PROJECT_PAGE_DETAILS_SUBCOLLECTION,
	AUDIT_PROJECTS_COLLECTION,
	mapAuditProjectDoc,
	mergeAuditProjectPageDetails,
	splitAuditProjectPayload,
	stripUndefinedDeep,
	type AuditProjectCreateInput,
	type AuditProjectDoc,
	type AuditProjectPageDetails,
	type CaseStudyType,
} from '@/lib/firebase/audit-projects-types';
import type { Firestore } from 'firebase-admin/firestore';

/** `audit_projects/{id}/pageDetails/main` doc ref holding the heavy per-subpage
 *  crawl detail split out of the main doc (see `splitAuditProjectPayload`). */
function pageDetailsRef(db: Firestore, id: string) {
	return db
		.collection(AUDIT_PROJECTS_COLLECTION)
		.doc(id)
		.collection(AUDIT_PROJECT_PAGE_DETAILS_SUBCOLLECTION)
		.doc(AUDIT_PROJECT_PAGE_DETAILS_DOC_ID);
}

async function fetchPageDetails(db: Firestore, id: string): Promise<AuditProjectPageDetails | null> {
	try {
		const snap = await pageDetailsRef(db, id).get();
		if (!snap.exists) return null;
		return (snap.data() as AuditProjectPageDetails | undefined) || null;
	} catch (err) {
		console.error('[audit-projects] pageDetails read failed:', id, err);
		return null;
	}
}

export {
	AUDIT_PROJECTS_COLLECTION,
	buildAuditProjectCreateInput,
	buildAuditProjectPayload,
	type AuditProjectCreateInput,
	type AuditProjectDoc,
	type AuditProjectPayload,
	type CaseStudyType,
	type DiagnosisUserType,
} from '@/lib/firebase/audit-projects-types';

function normalizeProjectUrl(raw: string): string {
	try {
		const u = new URL(raw);
		u.hash = '';
		const path = u.pathname.replace(/\/+$/, '') || '/';
		return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
	} catch {
		return raw.trim().toLowerCase().replace(/\/+$/, '');
	}
}

/**
 * Persist a diagnosis to Firestore `audit_projects` via Admin SDK.
 * Returns the new document id (same role as client `addDoc` id).
 */
export async function addAuditProject(
	input: AuditProjectCreateInput,
): Promise<{ id: string }> {
	if (!isFirebaseAdminConfigured()) {
		throw new Error('Firebase Admin is not configured.');
	}

	const db = getAdminFirestore();
	const { corePayload, pageDetails } = splitAuditProjectPayload(input.auditPayload);
	const ref = db.collection(AUDIT_PROJECTS_COLLECTION).doc();

	const batch = db.batch();
	batch.set(ref, {
		url: input.url,
		siteName: input.siteName,
		score: input.score,
		issueCount: input.issueCount,
		auditPayload: stripUndefinedDeep(corePayload),
		userType: input.userType,
		userId: input.userId,
		userAgent: input.userAgent ?? null,
		diagnosedAt: FieldValue.serverTimestamp(),
		createdAt: FieldValue.serverTimestamp(),
	});
	if (pageDetails.pageMetas.length > 0) {
		batch.set(pageDetailsRef(db, ref.id), stripUndefinedDeep(pageDetails));
	}
	await batch.commit();
	return { id: ref.id };
}

/**
 * Overwrite an existing `audit_projects` doc (re-audit). Keeps the same id / createdAt.
 */
export async function updateAuditProject(
	id: string,
	input: AuditProjectCreateInput,
): Promise<{ id: string } | null> {
	if (!id || !isFirebaseAdminConfigured()) return null;

	const db = getAdminFirestore();
	const ref = db.collection(AUDIT_PROJECTS_COLLECTION).doc(id);
	const snap = await ref.get();
	if (!snap.exists) return null;

	const { corePayload, pageDetails } = splitAuditProjectPayload(input.auditPayload);
	const batch = db.batch();
	batch.update(ref, {
		url: input.url,
		siteName: input.siteName,
		score: input.score,
		issueCount: input.issueCount,
		auditPayload: stripUndefinedDeep(corePayload),
		userType: input.userType,
		userId: input.userId,
		userAgent: input.userAgent ?? null,
		diagnosedAt: FieldValue.serverTimestamp(),
		updatedAt: FieldValue.serverTimestamp(),
	});
	if (pageDetails.pageMetas.length > 0) {
		batch.set(pageDetailsRef(db, id), stripUndefinedDeep(pageDetails));
	} else {
		batch.delete(pageDetailsRef(db, id));
	}
	await batch.commit();
	return { id };
}

/**
 * Partial update of just the public "도입 사례" exposure flags on an
 * `audit_projects` doc — does not touch `auditPayload` / score / etc.
 * Returns null when the doc does not exist (or Admin SDK is unavailable) so
 * callers can fall back to the Prisma `Project` table.
 */
export async function updateAuditProjectCaseStudyFields(
	id: string,
	input: {
		isCaseStudy: boolean;
		caseStudyType: CaseStudyType | null;
		customBaseline?: AuditProjectDoc['customBaseline'];
	},
): Promise<{
	id: string;
	isCaseStudy: boolean;
	caseStudyType: CaseStudyType | null;
	customBaseline?: AuditProjectDoc['customBaseline'];
} | null> {
	if (!id || !isFirebaseAdminConfigured()) return null;

	const db = getAdminFirestore();
	const ref = db.collection(AUDIT_PROJECTS_COLLECTION).doc(id);
	const snap = await ref.get();
	if (!snap.exists) return null;

	const caseStudyType = input.isCaseStudy ? input.caseStudyType : null;
	const payload: Record<string, unknown> = {
		isCaseStudy: input.isCaseStudy,
		caseStudyType,
		updatedAt: FieldValue.serverTimestamp(),
	};
	if (input.customBaseline !== undefined) {
		payload.customBaseline = input.customBaseline;
	}
	await ref.update(payload);
	return {
		id,
		isCaseStudy: input.isCaseStudy,
		caseStudyType,
		customBaseline: input.customBaseline,
	};
}

/**
 * Find the newest audit_projects doc whose URL matches (for forceRefresh overwrite).
 */
export async function findLatestAuditProjectByUrl(url: string): Promise<AuditProjectDoc | null> {
	if (!url || !isFirebaseAdminConfigured()) return null;

	const target = normalizeProjectUrl(url);
	let host = '';
	try {
		host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
	} catch {
		host = url.trim().toLowerCase();
	}
	const docs = await listAuditProjects(200);
	let hostMatch: AuditProjectDoc | null = null;
	for (const doc of docs) {
		if (normalizeProjectUrl(doc.url) === target) return doc;
		if (!hostMatch) {
			try {
				const docHost = new URL(doc.url).hostname.replace(/^www\./, '').toLowerCase();
				if (docHost === host) hostMatch = doc;
			} catch {
				// skip
			}
		}
	}
	return hostMatch;
}

/** Server-side get by document id (Admin SDK). Re-attaches the `pageDetails`
 *  subcollection (see `splitAuditProjectPayload`) so callers always see the full
 *  report shape regardless of how it was split for storage. */
export async function getAuditProjectById(id: string): Promise<AuditProjectDoc | null> {
	if (!id || !isFirebaseAdminConfigured()) return null;
	const db = getAdminFirestore();
	const snap = await db.collection(AUDIT_PROJECTS_COLLECTION).doc(id).get();
	if (!snap.exists) return null;
	const mapped = mapAuditProjectDoc(snap.id, snap.data() as Record<string, unknown>);
	if (!mapped) return null;
	const pageDetails = await fetchPageDetails(db, id);
	return mergeAuditProjectPageDetails(mapped, pageDetails);
}

/** List `audit_projects` newest first (`createdAt` desc). */
export async function listAuditProjects(limit = 200): Promise<AuditProjectDoc[]> {
	if (!isFirebaseAdminConfigured()) return [];

	const snap = await getAdminFirestore()
		.collection(AUDIT_PROJECTS_COLLECTION)
		.orderBy('createdAt', 'desc')
		.limit(limit)
		.get();

	const rows: AuditProjectDoc[] = [];
	for (const docSnap of snap.docs) {
		const mapped = mapAuditProjectDoc(docSnap.id, docSnap.data() as Record<string, unknown>);
		if (mapped) rows.push(mapped);
	}
	return rows;
}

/** Firestore batch write hard limit is 500 ops; each doc here deletes both the
 *  main doc and its `pageDetails` subcollection doc (2 ops), so this stays well
 *  under that ceiling. */
const FIRESTORE_DELETE_CHUNK = 200;

export type AuditProjectDeleteResult = {
	deleted: number;
	ids: string[];
	urls: string[];
};

function normalizeDeleteUrl(raw: string): string {
	try {
		const u = new URL(raw);
		u.hash = '';
		const path = u.pathname.replace(/\/+$/, '') || '/';
		return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
	} catch {
		return raw.trim();
	}
}

/** Batch-delete `audit_projects` docs by id. Collects urls for Prisma cascade cleanup. */
export async function deleteAuditProjectsByIds(ids: string[]): Promise<AuditProjectDeleteResult> {
	const unique = [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];
	if (!isFirebaseAdminConfigured() || unique.length === 0) {
		return { deleted: 0, ids: [], urls: [] };
	}

	const db = getAdminFirestore();
	const deletedIds: string[] = [];
	const urlSet = new Set<string>();

	for (let i = 0; i < unique.length; i += FIRESTORE_DELETE_CHUNK) {
		const chunk = unique.slice(i, i + FIRESTORE_DELETE_CHUNK);
		const refs = chunk.map((id) => db.collection(AUDIT_PROJECTS_COLLECTION).doc(id));
		const snaps = await db.getAll(...refs);
		const batch = db.batch();
		let ops = 0;
		for (const snap of snaps) {
			if (!snap.exists) continue;
			const data = snap.data() as Record<string, unknown> | undefined;
			const url = typeof data?.url === 'string' ? data.url.trim() : '';
			if (url) urlSet.add(normalizeDeleteUrl(url));
			batch.delete(snap.ref);
			batch.delete(pageDetailsRef(db, snap.id));
			deletedIds.push(snap.id);
			ops += 1;
		}
		if (ops > 0) {
			await batch.commit();
		}
	}

	return { deleted: deletedIds.length, ids: deletedIds, urls: [...urlSet] };
}

/**
 * Delete `audit_projects` whose URL matches (covers Prisma/history ids that
 * differ from the Firestore document id).
 */
export async function deleteAuditProjectsByUrls(urls: string[]): Promise<AuditProjectDeleteResult> {
	const targets = new Set(
		urls.map(normalizeDeleteUrl).filter((url) => url.length > 0),
	);
	if (!isFirebaseAdminConfigured() || targets.size === 0) {
		return { deleted: 0, ids: [], urls: [] };
	}

	const docs = await listAuditProjects(200);
	const matchIds = docs
		.filter((doc) => targets.has(normalizeDeleteUrl(doc.url)))
		.map((doc) => doc.id);
	if (matchIds.length === 0) {
		return { deleted: 0, ids: [], urls: [...targets] };
	}

	const result = await deleteAuditProjectsByIds(matchIds);
	return {
		deleted: result.deleted,
		ids: result.ids,
		urls: [...new Set([...result.urls, ...targets])],
	};
}

/** Delete every document in `audit_projects` (paged batches). */
export async function deleteAllAuditProjects(): Promise<AuditProjectDeleteResult> {
	if (!isFirebaseAdminConfigured()) {
		return { deleted: 0, ids: [], urls: [] };
	}

	const db = getAdminFirestore();
	const deletedIds: string[] = [];
	const urlSet = new Set<string>();

	for (;;) {
		const snap = await db.collection(AUDIT_PROJECTS_COLLECTION).limit(FIRESTORE_DELETE_CHUNK).get();
		if (snap.empty) break;
		const batch = db.batch();
		for (const docSnap of snap.docs) {
			const data = docSnap.data() as Record<string, unknown>;
			const url = typeof data?.url === 'string' ? data.url.trim() : '';
			if (url) urlSet.add(normalizeDeleteUrl(url));
			batch.delete(docSnap.ref);
			batch.delete(pageDetailsRef(db, docSnap.id));
			deletedIds.push(docSnap.id);
		}
		await batch.commit();
	}

	return { deleted: deletedIds.length, ids: deletedIds, urls: [...urlSet] };
}
