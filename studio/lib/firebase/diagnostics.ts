import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { createdAtToIso, stripUndefinedDeep } from '@/lib/firebase/audit-projects-types';
import type {
	DiagnosticCategory,
	DiagnosticDetail,
	DiagnosticRecommendation,
	DiagnosticReportData,
	DiagnosticStatus,
} from '@/lib/admin/diagnostic-management';
import { formatDisplayDateTime, scoreToStatus } from '@/lib/admin/diagnostic-management';

export const DIAGNOSTICS_COLLECTION = 'diagnostics';

export type DiagnosticDocInput = {
	siteName: string;
	domain: string;
	url?: string;
	category: DiagnosticCategory;
	totalScore: number;
	geoScore: number;
	schemaScore: number;
	status: DiagnosticStatus;
	issues: string[];
	reportData: DiagnosticReportData;
	requestedBy: string;
	userId?: string | null;
	userType?: string | null;
	auditProjectId?: string | null;
};

export type StoredDiagnostic = DiagnosticDetail & {
	userId: string | null;
	userType: string | null;
	auditProjectId: string | null;
};

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function asRecommendations(value: unknown): DiagnosticRecommendation[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => {
			if (!item || typeof item !== 'object') return null;
			const row = item as Record<string, unknown>;
			const title = typeof row.title === 'string' ? row.title : '';
			if (!title) return null;
			const priority = row.priority === 'high' || row.priority === 'medium' || row.priority === 'low' ? row.priority : 'medium';
			return {
				title,
				description: typeof row.description === 'string' ? row.description : '',
				priority,
			};
		})
		.filter((item): item is DiagnosticRecommendation => Boolean(item));
}

function asCategory(value: unknown): DiagnosticCategory {
	if (value === 'Medical' || value === 'Pet' || value === 'Commerce' || value === 'Corporate') return value;
	return 'Corporate';
}

export function mapDiagnosticDoc(id: string, data: Record<string, unknown>): StoredDiagnostic | null {
	const siteName = typeof data.siteName === 'string' ? data.siteName : '';
	const domain = typeof data.domain === 'string' ? data.domain : '';
	if (!siteName && !domain) return null;

	const totalScore = typeof data.totalScore === 'number' ? data.totalScore : 0;
	const geoScore = typeof data.geoScore === 'number' ? data.geoScore : 0;
	const schemaScore = typeof data.schemaScore === 'number' ? data.schemaScore : 0;
	const rawReport = data.reportData && typeof data.reportData === 'object' ? (data.reportData as Record<string, unknown>) : {};
	const recommendations = asRecommendations(rawReport.recommendations ?? data.recommendations);
	const knowledgeGraphScore =
		typeof rawReport.knowledgeGraphScore === 'number'
			? rawReport.knowledgeGraphScore
			: typeof data.knowledgeGraphScore === 'number'
				? data.knowledgeGraphScore
				: 0;
	const localSovScore =
		typeof rawReport.localSovScore === 'number'
			? rawReport.localSovScore
			: typeof data.localSovScore === 'number'
				? data.localSovScore
				: 0;
	const summary =
		typeof rawReport.summary === 'string'
			? rawReport.summary
			: typeof data.summary === 'string'
				? data.summary
				: '';
	const prescriptionIssued =
		typeof rawReport.prescriptionIssued === 'boolean'
			? rawReport.prescriptionIssued
			: Boolean(data.prescriptionIssued);
	const createdAtIso = createdAtToIso(data.createdAt);
	const reportData: DiagnosticReportData = {
		url: typeof rawReport.url === 'string' ? rawReport.url : typeof data.url === 'string' ? data.url : undefined,
		knowledgeGraphScore,
		localSovScore,
		schemaTypes: asStringArray(rawReport.schemaTypes),
		jsonLdBlockCount: typeof rawReport.jsonLdBlockCount === 'number' ? rawReport.jsonLdBlockCount : 0,
		recommendations,
		summary,
		prescriptionIssued,
	};

	return {
		id,
		siteName: siteName || domain,
		domain,
		category: asCategory(data.category),
		totalScore,
		geoScore,
		schemaScore,
		status: scoreToStatus(totalScore),
		issues: asStringArray(data.issues),
		requestedBy: typeof data.requestedBy === 'string' && data.requestedBy.trim() ? data.requestedBy : 'Guest',
		createdAt: formatDisplayDateTime(createdAtIso),
		reportShareUrl: typeof data.reportShareUrl === 'string' ? data.reportShareUrl : `/audit/result?id=${encodeURIComponent(id)}`,
		knowledgeGraphScore,
		localSovScore,
		recommendations,
		summary,
		prescriptionIssued,
		reportData,
		url: reportData.url,
		userId: typeof data.userId === 'string' ? data.userId : null,
		userType: typeof data.userType === 'string' ? data.userType : null,
		auditProjectId: typeof data.auditProjectId === 'string' ? data.auditProjectId : null,
	};
}

function writePayload(input: DiagnosticDocInput, reportShareUrl: string) {
	return stripUndefinedDeep({
		siteName: input.siteName,
		domain: input.domain,
		url: input.url || input.reportData.url || `https://${input.domain}`,
		category: input.category,
		totalScore: input.totalScore,
		geoScore: input.geoScore,
		schemaScore: input.schemaScore,
		status: input.status,
		issues: input.issues,
		reportData: input.reportData,
		requestedBy: input.requestedBy || 'Guest',
		userId: input.userId ?? null,
		userType: input.userType ?? null,
		auditProjectId: input.auditProjectId ?? null,
		reportShareUrl,
	});
}

export async function addDiagnostic(input: DiagnosticDocInput, id?: string): Promise<{ id: string }> {
	if (!isFirebaseAdminConfigured()) {
		throw new Error('Firebase Admin is not configured.');
	}
	const db = getAdminFirestore();
	const payload = writePayload(input, id ? `/audit/result?id=${encodeURIComponent(id)}` : '/audit/result');
	if (id) {
		await db.collection(DIAGNOSTICS_COLLECTION).doc(id).set({
			...payload,
			createdAt: FieldValue.serverTimestamp(),
			updatedAt: FieldValue.serverTimestamp(),
		});
		return { id };
	}
	const ref = await db.collection(DIAGNOSTICS_COLLECTION).add({
		...payload,
		createdAt: FieldValue.serverTimestamp(),
		updatedAt: FieldValue.serverTimestamp(),
	});
	await ref.update({ reportShareUrl: `/audit/result?id=${encodeURIComponent(ref.id)}` });
	return { id: ref.id };
}

export async function updateDiagnostic(
	id: string,
	input: DiagnosticDocInput,
	opts?: { refreshCreatedAt?: boolean },
): Promise<{ id: string } | null> {
	if (!id || !isFirebaseAdminConfigured()) return null;
	const db = getAdminFirestore();
	const ref = db.collection(DIAGNOSTICS_COLLECTION).doc(id);
	const snap = await ref.get();
	if (!snap.exists) return null;
	await ref.update({
		...writePayload(input, `/audit/result?id=${encodeURIComponent(id)}`),
		updatedAt: FieldValue.serverTimestamp(),
		...(opts?.refreshCreatedAt ? { createdAt: FieldValue.serverTimestamp() } : {}),
	});
	return { id };
}

export async function upsertDiagnostic(
	id: string,
	input: DiagnosticDocInput,
	opts?: { refreshCreatedAt?: boolean },
): Promise<{ id: string }> {
	if (!isFirebaseAdminConfigured()) {
		throw new Error('Firebase Admin is not configured.');
	}
	const db = getAdminFirestore();
	const ref = db.collection(DIAGNOSTICS_COLLECTION).doc(id);
	const snap = await ref.get();
	const payload = writePayload(input, `/audit/result?id=${encodeURIComponent(id)}`);
	if (snap.exists) {
		await ref.update({
			...payload,
			updatedAt: FieldValue.serverTimestamp(),
			...(opts?.refreshCreatedAt ? { createdAt: FieldValue.serverTimestamp() } : {}),
		});
	} else {
		await ref.set({
			...payload,
			createdAt: FieldValue.serverTimestamp(),
			updatedAt: FieldValue.serverTimestamp(),
		});
	}
	return { id };
}

export async function getDiagnosticById(id: string): Promise<StoredDiagnostic | null> {
	if (!id || !isFirebaseAdminConfigured()) return null;
	const snap = await getAdminFirestore().collection(DIAGNOSTICS_COLLECTION).doc(id).get();
	if (!snap.exists) return null;
	return mapDiagnosticDoc(snap.id, snap.data() as Record<string, unknown>);
}

export async function findLatestDiagnosticByDomain(domain: string): Promise<StoredDiagnostic | null> {
	if (!domain || !isFirebaseAdminConfigured()) return null;
	const target = domain.replace(/^www\./i, '').toLowerCase();
	const rows = await listDiagnostics(200);
	return rows.find((row) => row.domain.replace(/^www\./i, '').toLowerCase() === target) ?? null;
}

export async function listDiagnostics(limit = 400): Promise<StoredDiagnostic[]> {
	if (!isFirebaseAdminConfigured()) return [];
	const snap = await getAdminFirestore()
		.collection(DIAGNOSTICS_COLLECTION)
		.orderBy('createdAt', 'desc')
		.limit(limit)
		.get();
	const rows: StoredDiagnostic[] = [];
	for (const docSnap of snap.docs) {
		const mapped = mapDiagnosticDoc(docSnap.id, docSnap.data() as Record<string, unknown>);
		if (mapped) rows.push(mapped);
	}
	return rows;
}

export async function deleteDiagnosticsByIds(ids: string[]): Promise<number> {
	const unique = [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];
	if (!isFirebaseAdminConfigured() || unique.length === 0) return 0;
	const db = getAdminFirestore();
	let deleted = 0;
	for (let i = 0; i < unique.length; i += 400) {
		const chunk = unique.slice(i, i + 400);
		const refs = chunk.map((id) => db.collection(DIAGNOSTICS_COLLECTION).doc(id));
		const snaps = await db.getAll(...refs);
		const batch = db.batch();
		let ops = 0;
		for (const snap of snaps) {
			if (!snap.exists) continue;
			batch.delete(snap.ref);
			ops += 1;
		}
		if (ops > 0) {
			await batch.commit();
			deleted += ops;
		}
	}
	return deleted;
}
