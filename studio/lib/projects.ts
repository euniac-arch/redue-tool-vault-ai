import type { Project } from '@prisma/client';
import {
	getProjectCategoryLabel,
	normalizeProjectCategory,
	type ProjectCategoryFilter,
} from '@/lib/project-categories';

export interface ProjectListItem {
	id: string;
	name: string;
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
	defectCount?: number | null;
}

export function mapProjectRow(row: Project): ProjectListItem {
	const category = normalizeProjectCategory(row.category) as string;
	return {
		id: row.id,
		name: row.name,
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
	};
}

export function filterProjects(
	projects: ProjectListItem[],
	opts: { search?: string; cms?: string; category?: ProjectCategoryFilter },
): ProjectListItem[] {
	const search = (opts.search || '').trim().toLowerCase();
	const cms = opts.cms && opts.cms !== 'all' ? opts.cms : null;
	const category = opts.category && opts.category !== 'ALL' ? opts.category : null;

	return projects.filter((p) => {
		if (category && p.category !== category) return false;
		if (cms && p.cmsType !== cms) return false;
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
