import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import {
	AUDIT_PROJECTS_COLLECTION,
	mapAuditProjectDoc,
	stripUndefinedDeep,
	type AuditProjectCreateInput,
	type AuditProjectDoc,
} from '@/lib/firebase/audit-projects-types';

export {
	AUDIT_PROJECTS_COLLECTION,
	buildAuditProjectCreateInput,
	buildAuditProjectPayload,
	type AuditProjectCreateInput,
	type AuditProjectDoc,
	type AuditProjectPayload,
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
	const ref = await db.collection(AUDIT_PROJECTS_COLLECTION).add({
		url: input.url,
		score: input.score,
		issueCount: input.issueCount,
		auditPayload: stripUndefinedDeep(input.auditPayload),
		createdAt: FieldValue.serverTimestamp(),
	});
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

	await ref.update({
		url: input.url,
		score: input.score,
		issueCount: input.issueCount,
		auditPayload: stripUndefinedDeep(input.auditPayload),
		updatedAt: FieldValue.serverTimestamp(),
	});
	return { id };
}

/**
 * Find the newest audit_projects doc whose URL matches (for forceRefresh overwrite).
 */
export async function findLatestAuditProjectByUrl(url: string): Promise<AuditProjectDoc | null> {
	if (!url || !isFirebaseAdminConfigured()) return null;

	const target = normalizeProjectUrl(url);
	const docs = await listAuditProjects(80);
	for (const doc of docs) {
		if (normalizeProjectUrl(doc.url) === target) return doc;
	}
	return null;
}

/** Server-side get by document id (Admin SDK). */
export async function getAuditProjectById(id: string): Promise<AuditProjectDoc | null> {
	if (!id || !isFirebaseAdminConfigured()) return null;
	const snap = await getAdminFirestore().collection(AUDIT_PROJECTS_COLLECTION).doc(id).get();
	if (!snap.exists) return null;
	return mapAuditProjectDoc(snap.id, snap.data() as Record<string, unknown>);
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

/** Firestore batch write hard limit is 500; keep headroom. */
const FIRESTORE_DELETE_CHUNK = 400;

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
			deletedIds.push(snap.id);
			ops += 1;
		}
		if (ops > 0) {
			await batch.commit();
		}
	}

	return { deleted: deletedIds.length, ids: deletedIds, urls: [...urlSet] };
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
			deletedIds.push(docSnap.id);
		}
		await batch.commit();
	}

	return { deleted: deletedIds.length, ids: deletedIds, urls: [...urlSet] };
}
