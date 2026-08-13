import type { AuditReport } from '@/lib/site-auditor';
import { countAuditDefects } from '@/lib/audit/latest-audit-payload';
import { getProjectCategoryLabel } from '@/lib/project-categories';
import type { AuditHistoryItem, ProjectListItem } from '@/lib/projects';

export const LOCAL_PROJECTS_STORAGE_KEY = 'redue_local_projects';
export const LOCAL_PROJECTS_MAX = 50;

export interface LocalProjectArchive {
	id: string;
	name: string;
	targetUrl: string;
	cmsType: string;
	category: string;
	auditedAt: string;
	defectCount: number;
	score: number;
	maxScore: number;
	auditId: string | null;
	statusLabel: string;
}

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

function normalizeUrl(raw: string): string {
	try {
		const u = new URL(raw);
		u.hash = '';
		const path = u.pathname.replace(/\/+$/, '') || '/';
		return `${u.protocol}//${u.host.toLowerCase()}${path === '/' ? '' : path}${u.search}`;
	} catch {
		return raw.trim().replace(/\/+$/, '');
	}
}

function nameFromUrl(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '') || url;
	} catch {
		return url;
	}
}

function readRaw(): LocalProjectArchive[] {
	if (!isBrowser()) return [];
	try {
		const raw = window.localStorage.getItem(LOCAL_PROJECTS_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as LocalProjectArchive[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function writeRaw(entries: LocalProjectArchive[]): void {
	if (!isBrowser()) return;
	try {
		window.localStorage.setItem(
			LOCAL_PROJECTS_STORAGE_KEY,
			JSON.stringify(entries.slice(0, LOCAL_PROJECTS_MAX)),
		);
	} catch {
		// quota / private mode
	}
}

/**
 * After each completed diagnosis, upsert a local project row so /admin/projects
 * always shows the latest audit even before (or without) DB sync.
 */
export function archiveLocalProjectFromAudit(
	report: AuditReport,
	opts?: { auditId?: string | null; cmsType?: string },
): LocalProjectArchive {
	const targetUrl = normalizeUrl(report.url);
	const auditedAt = report.fetchedAt || new Date().toISOString();
	const entry: LocalProjectArchive = {
		id: opts?.auditId || `local-${Date.now()}`,
		name: report.siteMeta?.brandName || nameFromUrl(targetUrl),
		targetUrl,
		cmsType: opts?.cmsType || 'UNKNOWN',
		category: 'SOLUTIONS',
		auditedAt,
		defectCount: countAuditDefects(report),
		score: Math.round(report.score),
		maxScore: report.maxScore,
		auditId: opts?.auditId ?? null,
		statusLabel: report.statusLabel || 'COMPLETED',
	};

	const existing = readRaw();
	const withoutDup = existing.filter((p) => normalizeUrl(p.targetUrl) !== targetUrl);
	writeRaw([entry, ...withoutDup]);
	if (isBrowser()) {
		window.dispatchEvent(new CustomEvent('redue:local-projects', { detail: entry }));
	}
	return entry;
}

export function getLocalProjects(): LocalProjectArchive[] {
	return readRaw().sort((a, b) => +new Date(b.auditedAt) - +new Date(a.auditedAt));
}

export function localArchiveToProjectListItem(row: LocalProjectArchive): ProjectListItem {
	return {
		id: row.id.startsWith('local-') ? row.id : `local-proj-${row.id}`,
		name: row.name,
		targetUrl: row.targetUrl,
		cmsType: row.cmsType,
		category: row.category,
		categoryLabel: getProjectCategoryLabel(row.category),
		status: 'ACTIVE',
		thumbnailUrl: null,
		latestScore: row.score,
		latestSeoScore: row.score,
		latestGeoScore: null,
		latestSchemaScore: null,
		latestAuditId: row.auditId,
		auditCount: 1,
		createdAt: row.auditedAt,
		defectCount: row.defectCount,
		isLocalOnly: true,
	};
}

export function localArchiveToAuditHistoryItem(row: LocalProjectArchive): AuditHistoryItem {
	return {
		auditId: row.auditId || row.id,
		projectId: null,
		projectName: row.name,
		targetUrl: row.targetUrl,
		status: row.statusLabel || 'COMPLETED',
		overallScore: row.score,
		createdAt: row.auditedAt,
		category: row.category,
		categoryLabel: getProjectCategoryLabel(row.category),
		thumbnailUrl: null,
		defectCount: row.defectCount,
	};
}

/** Merge server projects with local archives (server wins on same URL). */
export function mergeProjectsWithLocal(
	serverProjects: ProjectListItem[],
	local: LocalProjectArchive[],
): ProjectListItem[] {
	const serverUrls = new Set(serverProjects.map((p) => normalizeUrl(p.targetUrl)));
	const localsOnly = local
		.filter((l) => !serverUrls.has(normalizeUrl(l.targetUrl)))
		.map(localArchiveToProjectListItem);

	const enrichedServer = serverProjects.map((p) => {
		const match = local.find((l) => normalizeUrl(l.targetUrl) === normalizeUrl(p.targetUrl));
		if (!match) return p;
		return {
			...p,
			defectCount: p.defectCount ?? match.defectCount,
		};
	});

	return [...enrichedServer, ...localsOnly].sort(
		(a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
	);
}

/** Merge server audit history with local rows (server wins on same auditId). */
export function mergeAuditsWithLocal(
	serverAudits: AuditHistoryItem[],
	local: LocalProjectArchive[],
): AuditHistoryItem[] {
	const serverIds = new Set(serverAudits.map((a) => a.auditId));
	const localsOnly = local
		.filter((l) => {
			const id = l.auditId || l.id;
			return !serverIds.has(id);
		})
		.map(localArchiveToAuditHistoryItem);

	const enriched = serverAudits.map((a) => {
		const match = local.find((l) => (l.auditId || l.id) === a.auditId);
		if (!match) return a;
		return { ...a, defectCount: a.defectCount ?? match.defectCount };
	});

	return [...enriched, ...localsOnly].sort(
		(a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
	);
}
