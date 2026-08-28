import type { Project } from '@prisma/client';
import { MASTER_ADMIN_ID } from '@/lib/master-admin';
import { preferProjectName } from '@/lib/audit/project-site-name';
import {
	getProjectCategoryLabel,
	normalizeProjectCategory,
	type ProjectCategoryFilter,
} from '@/lib/project-categories';

/** Diagnosing party captured at scan time: 'admin' | 'user' | 'guest'. */
export type DiagnosisUserType = 'admin' | 'user' | 'guest';

/** Admin list filter: ALL / admin-only / public (guest + user). */
export type DiagnosisTypeFilter = 'ALL' | 'ADMIN' | 'PUBLIC';

export interface ProjectListItem {
	id: string;
	name: string;
	/** Official brand; same as `name` after the site-name resolver. */
	siteName?: string;
	targetUrl: string;
	cmsType: string;
	category: string;
	categoryLabel: string;
	status: string;
	thumbnailUrl: string | null;
	latestScore: number | null;
	latestSeoScore: number | null;
	latestGeoScore: number | null;
	latestSchemaScore: number | null;
	latestAuditId: string | null;
	auditCount: number;
	createdAt: string;
	/** Who ran the latest diagnosis on this project. */
	userType: DiagnosisUserType;
	/** Optional: detected defect count from latest live audit */
	defectCount?: number | null;
	/** True when row exists only in browser localStorage (DB not yet synced) */
	isLocalOnly?: boolean;
}

export interface AuditHistoryItem {
	auditId: string;
	projectId: string | null;
	projectName: string | null;
	targetUrl: string;
	status: string;
	overallScore: number;
	createdAt: string;
	category: string | null;
	categoryLabel: string | null;
	thumbnailUrl: string | null;
	/** Who ran this diagnosis. */
	userType: DiagnosisUserType;
	defectCount?: number | null;
}

export function mapProjectRow(row: Project): ProjectListItem {
	const category = normalizeProjectCategory(row.category) as string;
	const name = preferProjectName(row.name, null, row.targetUrl);
	return {
		id: row.id,
		name,
		siteName: name,
		targetUrl: row.targetUrl,
		cmsType: row.cmsType,
		category,
		categoryLabel: getProjectCategoryLabel(category),
		status: row.status,
		thumbnailUrl: row.thumbnailUrl,
		latestScore: row.latestScore,
		latestSeoScore: row.latestSeoScore,
		latestGeoScore: row.latestGeoScore,
		latestSchemaScore: row.latestSchemaScore,
		latestAuditId: row.latestAuditId,
		auditCount: row.auditCount,
		createdAt: row.createdAt.toISOString(),
		userType: normalizeUserType(row.latestUserType),
	};
}

export function projectDisplayName(
	project: Pick<ProjectListItem, 'name' | 'siteName' | 'targetUrl'>,
): string {
	return preferProjectName(project.siteName, project.name, project.targetUrl);
}

export function auditDisplayName(audit: Pick<AuditHistoryItem, 'projectName' | 'targetUrl'>): string {
	return preferProjectName(audit.projectName, null, audit.targetUrl) || audit.targetUrl;
}

export function normalizeUserType(raw: unknown, userId?: string | null): DiagnosisUserType {
	if (userId && userId === MASTER_ADMIN_ID) return 'admin';
	const value = String(raw || '')
		.trim()
		.toLowerCase();
	if (value === 'admin') return 'admin';
	if (value === 'user') return 'user';
	return 'guest';
}

/** 'ALL' matches everything; 'ADMIN' matches admin-run diagnoses; 'PUBLIC' matches guest + user. */
export function matchesTypeFilter(userType: DiagnosisUserType, filter: DiagnosisTypeFilter): boolean {
	if (filter === 'ALL') return true;
	if (filter === 'ADMIN') return userType === 'admin';
	return userType !== 'admin';
}

export function filterProjects(
	projects: ProjectListItem[],
	opts: { search?: string; cms?: string; category?: ProjectCategoryFilter; type?: DiagnosisTypeFilter },
): ProjectListItem[] {
	const search = (opts.search || '').trim().toLowerCase();
	const cms = opts.cms && opts.cms !== 'all' ? opts.cms : null;
	const category = opts.category && opts.category !== 'ALL' ? opts.category : null;
	const type = opts.type || 'ALL';

	return projects.filter((p) => {
		if (category && p.category !== category) return false;
		if (cms && p.cmsType !== cms) return false;
		if (!matchesTypeFilter(p.userType, type)) return false;
		if (search) {
			const hay = `${p.name} ${p.targetUrl}`.toLowerCase();
			if (!hay.includes(search)) return false;
		}
		return true;
	});
}

export interface ProjectKpi {
	projectCount: number;
	averageSeoScore: number;
	averageGeoScore: number;
	monthlyDiagnosis: number;
	todayDiagnosis: number;
	averageScore: number | null;
	successRate: number | null;
	schemaRate: number | null;
	recentLabel: string;
	recentMeta: string;
}

export function computeProjectKpi(
	projects: ProjectListItem[],
	audits: AuditHistoryItem[],
): ProjectKpi {
	const projectCount = projects.length;
	const seoScores = projects.map((p) => p.latestSeoScore ?? p.latestScore).filter((n): n is number => n != null);
	const geoScores = projects.map((p) => p.latestGeoScore).filter((n): n is number => n != null);
	const overallScores = projects.map((p) => p.latestScore).filter((n): n is number => n != null);

	const now = new Date();
	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
	const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	const monthlyDiagnosis = audits.filter((a) => new Date(a.createdAt) >= monthStart).length;
	const todayDiagnosis = audits.filter((a) => new Date(a.createdAt) >= dayStart).length;
	const completed = audits.filter((a) => a.status === 'COMPLETED' || a.status === 'PASS');
	const successRate =
		audits.length > 0 ? Math.round((completed.length / audits.length) * 100) : null;
	const withCms = projects.filter((p) => p.cmsType && p.cmsType !== 'UNKNOWN').length;
	const schemaRate = projectCount > 0 ? Math.round((withCms / projectCount) * 100) : null;

	const recent = audits[0];
	return {
		projectCount,
		averageSeoScore: avg(seoScores),
		averageGeoScore: avg(geoScores),
		monthlyDiagnosis,
		todayDiagnosis,
		averageScore: overallScores.length ? avg(overallScores) : null,
		successRate,
		schemaRate,
		recentLabel: recent?.projectName || recent?.targetUrl || '—',
		recentMeta: recent ? new Date(recent.createdAt).toLocaleString('ko-KR') : '이력이 없습니다',
	};
}

function avg(nums: number[]): number {
	if (!nums.length) return 0;
	return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}
