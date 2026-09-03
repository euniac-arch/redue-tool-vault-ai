import type { AuditReport } from '@/lib/site-auditor';
import { countAuditDefects } from '@/lib/audit/latest-audit-payload';
import { preferProjectName, resolveProjectSiteName } from '@/lib/audit/project-site-name';
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
	userType?: 'admin' | 'user' | 'guest';
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
	opts?: { auditId?: string | null; cmsType?: string; userType?: 'admin' | 'user' | 'guest' },
): LocalProjectArchive {
	const targetUrl = normalizeUrl(report.url);
	const auditedAt = report.fetchedAt || new Date().toISOString();
	const entry: LocalProjectArchive = {
		id: opts?.auditId || `local-${Date.now()}`,
		name: resolveProjectSiteName(report) || nameFromUrl(targetUrl),
		targetUrl,
		cmsType: opts?.cmsType || 'UNKNOWN',
		category: 'SOLUTIONS',
		auditedAt,
		defectCount: countAuditDefects(report),
		score: Math.round(report.score),
		maxScore: report.maxScore,
		auditId: opts?.auditId ?? null,
		statusLabel: report.statusLabel || 'COMPLETED',
		userType: opts?.userType || 'guest',
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

/** Drop local project archives that match history / Firestore / Prisma ids. */
export function removeLocalProjectsByIds(ids: Iterable<string>): void {
	const remove = new Set([...ids].map((id) => String(id || '').trim()).filter(Boolean));
	if (remove.size === 0) return;
	const next = readRaw().filter((row) => {
		const rowIds = [row.id, row.auditId, row.id.startsWith('local-') ? '' : `local-proj-${row.id}`];
		return !rowIds.some((id) => id && remove.has(id));
	});
	writeRaw(next);
	if (isBrowser()) {
		window.dispatchEvent(new CustomEvent('redue:local-projects', { detail: { removed: [...remove] } }));
	}
}

export function localArchiveToProjectListItem(row: LocalProjectArchive): ProjectListItem {
	return {
		id: row.id.startsWith('local-') ? row.id : `local-proj-${row.id}`,
		name: row.name,
		siteName: row.name,
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
		userType: row.userType || 'guest',
		defectCount: row.defectCount,
		isLocalOnly: true,
		// Local-only rows aren't persisted server-side yet, so the case-study
		// toggle stays disabled for them (see ProjectWorkspace).
		isCaseStudy: false,
		caseStudyType: null,
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
		userType: row.userType || 'guest',
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
			name: preferProjectName(p.siteName || p.name, match.name, p.targetUrl),
			siteName: preferProjectName(p.siteName || p.name, match.name, p.targetUrl),
			defectCount: p.defectCount ?? match.defectCount,
		};
	});

	return [...enrichedServer, ...localsOnly].sort(
		(a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
	);
}

/** Merge server audit history with local rows (server wins on same auditId or URL). */
export function mergeAuditsWithLocal(
	serverAudits: AuditHistoryItem[],
	local: LocalProjectArchive[],
): AuditHistoryItem[] {
	const serverIds = new Set(serverAudits.map((a) => a.auditId));
	const serverUrls = new Set(serverAudits.map((a) => normalizeUrl(a.targetUrl)));
	const localsOnly = local
		.filter((l) => {
			const id = l.auditId || l.id;
			if (serverIds.has(id)) return false;
			return !serverUrls.has(normalizeUrl(l.targetUrl));
		})
		.map(localArchiveToAuditHistoryItem);

	const enriched = serverAudits.map((a) => {
		const match = local.find((l) => (l.auditId || l.id) === a.auditId);
		if (!match) return a;
		return {
			...a,
			projectName: preferProjectName(a.projectName, match.name, a.targetUrl),
			defectCount: a.defectCount ?? match.defectCount,
		};
	});

	return [...enriched, ...localsOnly].sort(
		(a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
	);
}
