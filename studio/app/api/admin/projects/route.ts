import { NextResponse } from 'next/server';
import { countAuditDefects } from '@/lib/audit/latest-audit-payload';
import { listAuditProjects } from '@/lib/firebase/audit-projects';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { prisma } from '@/lib/prisma';
import {
	getProjectCategoryLabel,
	isValidProjectCategory,
	normalizeProjectCategory,
} from '@/lib/project-categories';
import { mapProjectRow, type AuditHistoryItem, type ProjectListItem } from '@/lib/projects';
import { backfillOrphanAuditLeads } from '@/lib/projects-sync';
import type { AuditReport } from '@/lib/site-auditor';

export const runtime = 'nodejs';

function hostnameFromUrl(raw: string): string {
	try {
		return new URL(raw).hostname.replace(/^www\./, '') || raw;
	} catch {
		return raw;
	}
}

function firestoreProjectsToListItems(
	docs: Awaited<ReturnType<typeof listAuditProjects>>,
): { projects: ProjectListItem[]; recentAudits: AuditHistoryItem[] } {
	const projects: ProjectListItem[] = docs.map((doc) => {
		const report = doc.auditPayload.report;
		const category = 'SOLUTIONS';
		const seo = report.categories?.find((c) => c.id === 'seo');
		const geo = report.categories?.find((c) => c.id === 'geo');
		return {
			id: doc.id,
			name: report.siteMeta?.brandName || hostnameFromUrl(doc.url),
			targetUrl: doc.url,
			cmsType: doc.auditPayload.cmsType || 'UNKNOWN',
			category,
			categoryLabel: getProjectCategoryLabel(category),
			status: 'ACTIVE',
			thumbnailUrl: null,
			latestScore: doc.score,
			latestSeoScore: seo
				? Math.round((seo.score / Math.max(seo.maxScore, 1)) * 100)
				: doc.score,
			latestGeoScore:
				typeof report.geoCitationScore === 'number'
					? Math.round(report.geoCitationScore)
					: geo
						? Math.round((geo.score / Math.max(geo.maxScore, 1)) * 100)
						: null,
			latestSchemaScore:
				typeof report.schemaCoverage === 'number' ? Math.round(report.schemaCoverage) : null,
			latestAuditId: doc.id,
			auditCount: 1,
			createdAt: doc.createdAt,
			defectCount: doc.issueCount,
		};
	});

	const recentAudits: AuditHistoryItem[] = docs.map((doc) => ({
		auditId: doc.id,
		projectId: doc.id,
		projectName: doc.auditPayload.report.siteMeta?.brandName || hostnameFromUrl(doc.url),
		targetUrl: doc.url,
		status: doc.auditPayload.report.statusLabel || 'COMPLETED',
		overallScore: doc.score,
		createdAt: doc.createdAt,
		category: 'SOLUTIONS',
		categoryLabel: getProjectCategoryLabel('SOLUTIONS'),
		thumbnailUrl: null,
		defectCount: doc.issueCount,
	}));

	return { projects, recentAudits };
}

/**
 * GET /api/admin/projects — list projects + recent audits.
 * Prefers Firestore `audit_projects` (createdAt desc) when configured.
 * POST /api/admin/projects — create a project (Prisma registry).
 * TEMP: requireAdmin bypassed while login is incomplete.
 */
export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const filterCategory = normalizeProjectCategory(searchParams.get('category'), { allowAll: true });

	if (isFirebaseAdminConfigured()) {
		try {
			const docs = await listAuditProjects(200);
			let { projects, recentAudits } = firestoreProjectsToListItems(docs);
			if (filterCategory !== 'ALL') {
				projects = projects.filter((p) => p.category === filterCategory);
			}
			return NextResponse.json({
				projects,
				recentAudits,
				categoryFilter: filterCategory,
				source: 'firestore',
				timestamp: new Date().toISOString(),
			});
		} catch (err) {
			console.error('[admin/projects] Firestore list failed, falling back to Prisma:', err);
		}
	}

	await backfillOrphanAuditLeads(40).catch(() => 0);

	const [projectRows, leads] = await Promise.all([
		prisma.project.findMany({ orderBy: { createdAt: 'desc' } }),
		prisma.auditLead.findMany({
			orderBy: { createdAt: 'desc' },
			take: 200,
			include: { project: { select: { id: true, name: true, category: true, thumbnailUrl: true } } },
		}),
	]);

	let projects = projectRows.map(mapProjectRow);
	if (filterCategory !== 'ALL') {
		projects = projects.filter((p) => p.category === filterCategory);
	}

	const defectByAuditId = new Map<string, number>();
	for (const lead of leads) {
		try {
			const report = JSON.parse(lead.reportJson) as AuditReport;
			if (report?.url) defectByAuditId.set(lead.id, countAuditDefects(report));
		} catch {
			// skip
		}
	}

	projects = projects.map((p) => ({
		...p,
		defectCount: p.latestAuditId ? defectByAuditId.get(p.latestAuditId) ?? null : null,
	}));

	const recentAudits: AuditHistoryItem[] = leads.map((lead) => {
		const category = lead.project?.category
			? normalizeProjectCategory(lead.project.category)
			: null;
		return {
			auditId: lead.id,
			projectId: lead.projectId,
			projectName: lead.project?.name ?? null,
			targetUrl: lead.url,
			status: lead.statusLabel || 'COMPLETED',
			overallScore: lead.score,
			createdAt: lead.createdAt.toISOString(),
			category: category === 'ALL' ? null : category,
			categoryLabel: category && category !== 'ALL' ? getProjectCategoryLabel(category) : null,
			thumbnailUrl: lead.project?.thumbnailUrl ?? null,
			defectCount: defectByAuditId.get(lead.id) ?? null,
		};
	});

	return NextResponse.json({
		projects,
		recentAudits,
		categoryFilter: filterCategory,
		source: 'prisma',
		timestamp: new Date().toISOString(),
	});
}

export async function POST(request: Request) {
	const body = (await request.json().catch(() => null)) as {
		name?: string;
		targetUrl?: string;
		cmsType?: string;
		category?: string;
	} | null;

	const name = body?.name?.trim();
	const targetUrl = body?.targetUrl?.trim();
	const cmsType = body?.cmsType?.trim() || 'UNKNOWN';
	const category = body?.category;

	if (!name || !targetUrl) {
		return NextResponse.json(
			{ error: true, code: 'MISSING_FIELDS', message: 'name과 targetUrl은 필수입니다.' },
			{ status: 400 },
		);
	}

	if (!isValidProjectCategory(category)) {
		return NextResponse.json(
			{
				error: true,
				code: 'INVALID_CATEGORY',
				message: 'category는 MEDICAL, CORPORATE, COMMERCE, PUBLIC, SOLUTIONS 중 하나여야 합니다.',
			},
			{ status: 400 },
		);
	}

	const project = await prisma.project.create({
		data: {
			name,
			targetUrl,
			cmsType,
			category: normalizeProjectCategory(category) as string,
			status: 'ACTIVE',
		},
	});

	return NextResponse.json(mapProjectRow(project), { status: 201 });
}
