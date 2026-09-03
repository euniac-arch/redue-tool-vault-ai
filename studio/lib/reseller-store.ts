import fs from 'node:fs';
import { ensureWritableDirSync, writableDataPath, writeJsonFileSync } from '@/lib/server/writable-data-dir';

export interface ResellerClient {
	id: string;
	name: string;
	email: string;
	creditsAllocated: number;
	createdAt: string;
}

export interface ResellerProfile {
	userId: string;
	partnerName: string;
	customDomain: string;
	logoDataUrl: string | null;
	brandColor: string;
	creditPool: number;
	clients: ResellerClient[];
	updatedAt: string;
}

const RESELLER_DIR = writableDataPath('resellers');

const DEFAULT_BRAND_COLOR = '#22d3ee';

function ensureDir(): void {
	ensureWritableDirSync(RESELLER_DIR);
}

function profilePath(userId: string): string {
	return writableDataPath('resellers', `${userId}.json`);
}

export function defaultResellerProfile(userId: string, partnerName = 'Agency Partner'): ResellerProfile {
	return {
		userId,
		partnerName,
		customDomain: 'seo.agency-domain.com',
		logoDataUrl: null,
		brandColor: DEFAULT_BRAND_COLOR,
		creditPool: 500,
		clients: [
			{
				id: 'demo-client-1',
				name: 'Acme Retail KR',
				email: 'seo@acme-retail.kr',
				creditsAllocated: 40,
				createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
			},
			{
				id: 'demo-client-2',
				name: 'Northwind Media',
				email: 'ops@northwind.media',
				creditsAllocated: 25,
				createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
			},
		],
		updatedAt: new Date().toISOString(),
	};
}

export function loadResellerProfile(userId: string): ResellerProfile {
	ensureDir();
	try {
		const raw = fs.readFileSync(profilePath(userId), 'utf8');
		return JSON.parse(raw) as ResellerProfile;
	} catch {
		const profile = defaultResellerProfile(userId);
		saveResellerProfile(profile);
		return profile;
	}
}

export function saveResellerProfile(profile: ResellerProfile): void {
	ensureDir();
	profile.updatedAt = new Date().toISOString();
	writeJsonFileSync(profilePath(profile.userId), profile);
}

export function appendEnterpriseLead(lead: Record<string, unknown>): void {
	ensureDir();
	const file = writableDataPath('enterprise-leads.json');
	let list: Record<string, unknown>[] = [];
	try {
		list = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>[];
	} catch {
		list = [];
	}
	list.unshift(lead);
	writeJsonFileSync(file, list);
}
