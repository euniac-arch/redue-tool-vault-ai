import 'server-only';

import fs from 'node:fs';
import {
	normalizeContactInquiry,
	queryInquiries,
	type ContactInquiry,
	type ContactInquiryStatus,
	type InquiryListQuery,
	type InquiryListResult,
} from '@/lib/admin/inquiry-management';
import { ensureWritableDirSync, writableDataPath, writeJsonFileSync } from '@/lib/server/writable-data-dir';

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

export function readContactLeads(): ContactInquiry[] {
	return readRawLeads()
		.map(normalizeContactInquiry)
		.filter((item): item is ContactInquiry => Boolean(item));
}

export function appendContactLead(lead: ContactInquiry): void {
	const list = readRawLeads();
	list.unshift({ ...lead });
	persistLeads(list);
}

export function findContactLead(id: string): ContactInquiry | null {
	const target = id.trim();
	if (!target) return null;
	return readContactLeads().find((item) => item.id === target) || null;
}

export function queryContactLeads(query: InquiryListQuery): InquiryListResult {
	return queryInquiries(readContactLeads(), query);
}

export function listContactLeadsForUser(userId?: string | null, email?: string | null): ContactInquiry[] {
	const uid = userId?.trim() || '';
	const mail = email?.trim().toLowerCase() || '';
	if (!uid && !mail) return [];
	return readContactLeads()
		.filter((lead) => (uid && lead.userId === uid) || (mail && lead.email.toLowerCase() === mail))
		.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

export function updateContactLeadStatus(id: string, status: ContactInquiryStatus): ContactInquiry | null {
	const target = id.trim();
	if (!target) return null;
	const list = readRawLeads();
	const index = list.findIndex((row) => String(row.id || '').trim() === target);
	if (index < 0) return null;

	const now = new Date().toISOString();
	const nextRow = {
		...list[index],
		status,
		updatedAt: now,
		repliedAt: status === 'completed' ? now : list[index].repliedAt ?? null,
	};
	list[index] = nextRow;
	if (!persistLeads(list)) return null;
	return normalizeContactInquiry(nextRow);
}

export function deleteContactLead(id: string): ContactInquiry | null {
	const target = id.trim();
	if (!target) return null;
	const list = readRawLeads();
	const index = list.findIndex((row) => String(row.id || '').trim() === target);
	if (index < 0) return null;
	const [removed] = list.splice(index, 1);
	if (!persistLeads(list)) return null;
	return normalizeContactInquiry(removed);
}
