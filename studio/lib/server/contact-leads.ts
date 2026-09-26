import 'server-only';

import fs from 'node:fs';
import { getAdminFirestore, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import {
	normalizeContactInquiry,
	queryInquiries,
	type ContactInquiry,
	type ContactInquiryStatus,
	type InquiryListQuery,
	type InquiryListResult,
} from '@/lib/admin/inquiry-management';
import { ensureWritableDirSync, isReadOnlyDeployRuntime, writableDataPath, writeJsonFileSync } from '@/lib/server/writable-data-dir';

/** Shared across Vercel instances. JSON under /tmp is not. */
export const CONTACT_INQUIRIES_COLLECTION = 'contact_inquiries';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' } as const;

export function contactLeadNoStoreHeaders(): Record<string, string> {
	return { ...NO_STORE_HEADERS };
}

function leadsFilePath() {
	return writableDataPath('contact-leads.json');
}

function readRawLeads(): Record<string, unknown>[] {
	try {
		const parsed = JSON.parse(fs.readFileSync(leadsFilePath(), 'utf8')) as unknown;
		return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
	} catch {
		return [];
	}
}

function persistLeads(list: Record<string, unknown>[]): boolean {
	ensureWritableDirSync(writableDataPath());
	return writeJsonFileSync(leadsFilePath(), list);
}

function readContactLeadsFromFile(): ContactInquiry[] {
	return readRawLeads()
		.map(normalizeContactInquiry)
		.filter((item): item is ContactInquiry => Boolean(item));
}

function storedFields(lead: ContactInquiry): Record<string, unknown> {
	return {
		userId: lead.userId,
		name: lead.name,
		company: lead.company,
		email: lead.email,
		phone: lead.phone,
		inquiryType: lead.inquiryType,
		serviceType: lead.serviceType,
		title: lead.title,
		message: lead.message,
		pageUrl: lead.pageUrl,
		status: lead.status,
		adminReply: lead.adminReply,
		repliedAt: lead.repliedAt,
		createdAt: lead.createdAt,
		updatedAt: lead.updatedAt,
	};
}

let fileImportStarted = false;

/** Local `.data/contact-leads.json` rows are copied once into Firestore so existing dev inquiries stay visible. */
async function importFileLeadsIntoFirestore(): Promise<void> {
	if (fileImportStarted || isReadOnlyDeployRuntime() || !isFirebaseAdminConfigured()) return;
	fileImportStarted = true;
	const rows = readRawLeads();
	if (!rows.length) return;
	const db = getAdminFirestore();
	for (const row of rows) {
		const lead = normalizeContactInquiry(row);
		if (!lead) continue;
		try {
			const ref = db.collection(CONTACT_INQUIRIES_COLLECTION).doc(lead.id);
			const existing = await ref.get();
			if (!existing.exists) await ref.set(storedFields(lead));
		} catch (error) {
			fileImportStarted = false;
			console.error('[contact-leads] local JSON import failed', lead.id, error);
			return;
		}
	}
}

async function readContactLeadsFromFirestore(): Promise<ContactInquiry[]> {
	await importFileLeadsIntoFirestore();
	const db = getAdminFirestore();
	let snap;
	try {
		snap = await db.collection(CONTACT_INQUIRIES_COLLECTION).orderBy('createdAt', 'desc').get();
	} catch (error) {
		console.error('[contact-leads] ordered firestore read failed, retrying unordered', error);
		snap = await db.collection(CONTACT_INQUIRIES_COLLECTION).get();
	}
	return snap.docs
		.map((doc) => normalizeContactInquiry({ id: doc.id, ...doc.data() }))
		.filter((item): item is ContactInquiry => Boolean(item))
		.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

export async function readContactLeads(): Promise<ContactInquiry[]> {
	if (isFirebaseAdminConfigured()) {
		try {
			return await readContactLeadsFromFirestore();
		} catch (error) {
			console.error('[contact-leads] firestore read failed', error);
			if (isReadOnlyDeployRuntime()) throw error;
		}
	}
	if (isReadOnlyDeployRuntime()) {
		const error = new Error(
			'Firebase Admin is not configured on this deployment. Inquiry reads cannot use the ephemeral /tmp file.',
		);
		console.error('[contact-leads]', error.message);
		throw error;
	}
	return readContactLeadsFromFile();
}

export async function appendContactLead(lead: ContactInquiry): Promise<'firestore' | 'file'> {
	if (isFirebaseAdminConfigured()) {
		try {
			await getAdminFirestore().collection(CONTACT_INQUIRIES_COLLECTION).doc(lead.id).set(storedFields(lead));
			return 'firestore';
		} catch (error) {
			console.error('[contact-leads] firestore write failed', { id: lead.id, email: lead.email, error });
			if (isReadOnlyDeployRuntime()) throw error;
		}
	}

	if (isReadOnlyDeployRuntime()) {
		const error = new Error(
			'Inquiry store is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.',
		);
		console.error('[contact-leads] refusing ephemeral /tmp write', { id: lead.id, email: lead.email, error });
		throw error;
	}

	const list = readRawLeads();
	list.unshift({ ...lead });
	if (!persistLeads(list)) {
		const error = new Error(`Failed to write ${leadsFilePath()}`);
		console.error('[contact-leads] file write failed', { id: lead.id, email: lead.email, error });
		throw error;
	}
	return 'file';
}

export async function findContactLead(id: string): Promise<ContactInquiry | null> {
	const target = id.trim();
	if (!target) return null;
	if (isFirebaseAdminConfigured()) {
		try {
			const snap = await getAdminFirestore().collection(CONTACT_INQUIRIES_COLLECTION).doc(target).get();
			if (snap.exists) {
				return normalizeContactInquiry({ id: snap.id, ...snap.data() });
			}
		} catch (error) {
			console.error('[contact-leads] firestore find failed', target, error);
			if (isReadOnlyDeployRuntime()) throw error;
		}
	}
	return readContactLeadsFromFile().find((item) => item.id === target) || null;
}

export async function queryContactLeads(query: InquiryListQuery): Promise<InquiryListResult> {
	return queryInquiries(await readContactLeads(), query);
}

export async function listContactLeadsForUser(userId?: string | null, email?: string | null): Promise<ContactInquiry[]> {
	const uid = userId?.trim() || '';
	const mail = email?.trim().toLowerCase() || '';
	if (!uid && !mail) return [];
	return (await readContactLeads())
		.filter((lead) => (uid && lead.userId === uid) || (mail && lead.email.toLowerCase() === mail))
		.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

export async function updateContactLeadStatus(id: string, status: ContactInquiryStatus): Promise<ContactInquiry | null> {
	const target = id.trim();
	if (!target) return null;
	const now = new Date().toISOString();

	if (isFirebaseAdminConfigured()) {
		try {
			const ref = getAdminFirestore().collection(CONTACT_INQUIRIES_COLLECTION).doc(target);
			const snap = await ref.get();
			if (!snap.exists) return null;
			const next = {
				...snap.data(),
				status,
				updatedAt: now,
				repliedAt: status === 'completed' ? now : (snap.data()?.repliedAt ?? null),
			};
			await ref.set(next, { merge: true });
			return normalizeContactInquiry({ id: target, ...next });
		} catch (error) {
			console.error('[contact-leads] firestore status update failed', target, error);
			if (isReadOnlyDeployRuntime()) throw error;
		}
	}

	const list = readRawLeads();
	const index = list.findIndex((row) => String(row.id || '').trim() === target);
	if (index < 0) return null;
	const nextRow = {
		...list[index],
		status,
		updatedAt: now,
		repliedAt: status === 'completed' ? now : list[index].repliedAt ?? null,
	};
	list[index] = nextRow;
	if (!persistLeads(list)) {
		console.error('[contact-leads] file status update failed', target);
		return null;
	}
	return normalizeContactInquiry(nextRow);
}

export async function deleteContactLead(id: string): Promise<ContactInquiry | null> {
	const target = id.trim();
	if (!target) return null;

	if (isFirebaseAdminConfigured()) {
		try {
			const ref = getAdminFirestore().collection(CONTACT_INQUIRIES_COLLECTION).doc(target);
			const snap = await ref.get();
			if (!snap.exists) return null;
			const removed = normalizeContactInquiry({ id: snap.id, ...snap.data() });
			await ref.delete();
			return removed;
		} catch (error) {
			console.error('[contact-leads] firestore delete failed', target, error);
			if (isReadOnlyDeployRuntime()) throw error;
		}
	}

	const list = readRawLeads();
	const index = list.findIndex((row) => String(row.id || '').trim() === target);
	if (index < 0) return null;
	const [removed] = list.splice(index, 1);
	if (!persistLeads(list)) {
		console.error('[contact-leads] file delete failed', target);
		return null;
	}
	return normalizeContactInquiry(removed);
}
