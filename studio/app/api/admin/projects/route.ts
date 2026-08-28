import { NextResponse } from 'next/server';
import { countAuditDefects } from '@/lib/audit/latest-audit-payload';
import {
	preferProjectName,
	resolveProjectSiteName,
} from '@/lib/audit/project-site-name';
import { listAuditProjects } from '@/lib/firebase/audit-projects';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { prisma } from '@/lib/prisma';
import {
	getProjectCategoryLabel,
	isValidProjectCategory,
	normalizeProjectCategory,
} from '@/lib/project-categories';
import {
	mapProjectRow,
	matchesTypeFilter,
	normalizeUserType,
	type AuditHistoryItem,
	type DiagnosisTypeFilter,
	type ProjectListItem,
} from '@/lib/projects';
import { backfillOrphanAuditLeads } from '@/lib/projects-sync';
import type { AuditReport } from '@/lib/site-auditor';

function normalizeTypeFilter(raw: string | null): DiagnosisTypeFilter {
	const v = (raw || '').trim().toLowerCase();
	if (v === 'admin') return 'ADMIN';
	if (v === 'public') return 'PUBLIC';
	return 'ALL';
}

function countByType<T extends { userType: string }>(rows: T[]) {
	let admin = 0;
	let publicCount = 0;
	for (const row of rows) {
		if (normalizeUserType(row.userType) === 'admin') admin += 1;
		else publicCount += 1;
	}
	return { all: rows.length, admin, public: publicCount };
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function noStoreJson(body: unknown, init?: { status?: number }) {
	return NextResponse.json(body, {
		status: init?.status,
		headers: {
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
		},
	});
}

function hostKey(raw: string): string {
	try {
		return new URL(raw).hostname.replace(/^www\./, '').toLowerCase();
	} catch {
		return raw.trim().toLowerCase();
	}
}

function preferUserType(a: string, b: string) {
	const left = normalizeUserType(a);
	const right = normalizeUserType(b);
	if (left === 'admin' || right === 'admin') return 'admin' as const;
	if (left === 'user' || right === 'user') return 'user' as const;
	return 'guest' as const;
}

function mergeByHost(primary: ProjectListItem[], extra: ProjectListItem[]): ProjectListItem[] {
	const byHost = new Map<string, ProjectListItem>();
	for (const row of primary) {
		byHost.set(hostKey(row.targetUrl), row);
	}
	for (const row of extra) {
		const key = hostKey(row.targetUrl);
		const existing = byHost.get(key);
		if (!existing) {
			byHost.set(key, row);
			continue;
		}
		const existingTime = +new Date(existing.createdAt);
		const extraTime = +new Date(row.createdAt);
		byHost.set(key, {
			...existing,
			userType: preferUserType(existing.userType, row.userType),
			latestScore: extraTime >= existingTime ? (row.latestScore ?? existing.latestScore) : existing.latestScore,
			latestSeoScore: extraTime >= existingTime ? (row.latestSeoScore ?? existing.latestSeoScore) : existing.latestSeoScore,
			latestGeoScore: extraTime >= existingTime ? (row.latestGeoScore ?? existing.latestGeoScore) : existing.latestGeoScore,
			latestSchemaScore:
				extraTime >= existingTime ? (row.latestSchemaScore ?? existing.latestSchemaScore) : existing.latestSchemaScore,
			latestAuditId: existing.latestAuditId || row.latestAuditId,
			auditCount: Math.max(existing.auditCount || 0, row.auditCount || 0, 1),
			defectCount: existing.defectCount ?? row.defectCount,
			name: preferProjectName(existing.name, row.name, existing.targetUrl || row.targetUrl),
			siteName: preferProjectName(
				existing.siteName || existing.name,
				row.siteName || row.name,
				existing.targetUrl || row.targetUrl,
			),
		});
	}
	return [...byHost.values()].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

function mergeAuditsByHost(primary: AuditHistoryItem[], extra: AuditHistoryItem[]): AuditHistoryItem[] {
	const byHost = new Map<string, AuditHistoryItem>();
	for (const row of primary) {
		byHost.set(hostKey(row.targetUrl), row);
	}
	for (const row of extra) {
		const key = hostKey(row.targetUrl);
		const existing = byHost.get(key);
		if (!existing) {
			byHost.set(key, row);
			continue;
		}
		const newer = +new Date(row.createdAt) > +new Date(existing.createdAt) ? row : existing;
		byHost.set(key, {
			...newer,
			userType: preferUserType(existing.userType, row.userType),
			defectCount: newer.defectCount ?? existing.defectCount ?? row.defectCount,
			projectName: preferProjectName(existing.projectName, newer.projectName, newer.targetUrl),
		});
	}
	return [...byHost.values()].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

function firestoreProjectsToListItems(
	docs: Awaited<ReturnType<typeof listAuditProjects>>,
): { projects: ProjectListItem[]; recentAudits: AuditHistoryItem[] } {
	const projects: ProjectListItem[] = docs.map((doc) => {
		const report = doc.auditPayload.report;
		const category = 'SOLUTIONS';
		const seo = report.categories?.find((c) => c.id === 'seo');
		const geo = report.categories?.find((c) => c.id === 'geo');
		const siteName = preferProjectName(
			doc.siteName,
			resolveProjectSiteName(report),
			doc.url,
		);
		return {
			id: doc.id,
			name: siteName,
			siteName,
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
			userType: normalizeUserType(doc.userType, doc.userId),
			defectCount: doc.issueCount,
		};
	});

	const recentAudits: AuditHistoryItem[] = docs.map((doc) => ({
		auditId: doc.id,
		projectId: doc.id,
		projectName: preferProjectName(
			doc.siteName,
			resolveProjectSiteName(doc.auditPayload.report),
			doc.url,
		),
		targetUrl: doc.url,
		status: doc.auditPayload.report.statusLabel || 'COMPLETED',
		overallScore: doc.score,
		createdAt: doc.createdAt,
		category: 'SOLUTIONS',
		categoryLabel: getProjectCategoryLabel('SOLUTIONS'),
		thumbnailUrl: null,
		userType: normalizeUserType(doc.userType, doc.userId),
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
	const typeFilter = normalizeTypeFilter(searchParams.get('type'));

	if (isFirebaseAdminConfigured()) {
		try {
			const docs = await listAuditProjects(200);
			let { projects, recentAudits } = firestoreProjectsToListItems(docs);

			// Merge Prisma registry so a successful scan still appears when the
			// Firestore write lagged / failed, or when only AuditLead was persisted.
			try {
				await backfillOrphanAuditLeads(40).catch(() => 0);
				const [projectRows, leads] = await Promise.all([
					prisma.project.findMany({ orderBy: { createdAt: 'desc' } }),
					prisma.auditLead.findMany({
						orderBy: { createdAt: 'desc' },
						take: 200,
						include: { project: { select: { id: true, name: true, category: true, thumbnailUrl: true } } },
					}),
				]);
				const prismaProjects = projectRows.map(mapProjectRow);
				const prismaAudits: AuditHistoryItem[] = leads.map((lead) => {
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
						userType: normalizeUserType(lead.userType || (lead.userId ? 'user' : 'guest'), lead.userId),
						defectCount: null,
					};
				});
				projects = mergeByHost(projects, prismaProjects);
				recentAudits = mergeAuditsByHost(recentAudits, prismaAudits);
			} catch (mergeErr) {
				console.error('[admin/projects] Prisma merge skipped:', mergeErr);
			}

			const counts = {
				projects: countByType(projects),
				audits: countByType(recentAudits),
			};
			if (filterCategory !== 'ALL') {
				projects = projects.filter((p) => p.category === filterCategory);
			}
			projects = projects.filter((p) => matchesTypeFilter(p.userType, typeFilter));
			recentAudits = recentAudits.filter((a) => matchesTypeFilter(a.userType, typeFilter));
			return noStoreJson({
				projects,
				recentAudits,
				counts,
				categoryFilter: filterCategory,
				typeFilter,
				source: 'firestore+prisma',
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

	const defectByAuditId = new Map<string, number>();
	const siteNameByHost = new Map<string, string>();
	const siteNameByAuditId = new Map<string, string>();
	for (const lead of leads) {
		try {
			const report = JSON.parse(lead.reportJson) as AuditReport;
			if (!report?.url) continue;
			defectByAuditId.set(lead.id, countAuditDefects(report));
			const recovered = resolveProjectSiteName(report);
			siteNameByAuditId.set(lead.id, recovered);
			const key = hostKey(report.url);
			siteNameByHost.set(key, preferProjectName(siteNameByHost.get(key), recovered, report.url));
		} catch {
			// skip
		}
	}

	projects = projects.map((p) => {
		const recovered = siteNameByHost.get(hostKey(p.targetUrl));
		const name = preferProjectName(recovered, p.name, p.targetUrl);
		return {
			...p,
			name,
			siteName: name,
			defectCount: p.latestAuditId ? defectByAuditId.get(p.latestAuditId) ?? null : null,
		};
	});

	const recentAudits: AuditHistoryItem[] = leads.map((lead) => {
		const category = lead.project?.category
			? normalizeProjectCategory(lead.project.category)
			: null;
		return {
			auditId: lead.id,
			projectId: lead.projectId,
			projectName: preferProjectName(
				siteNameByAuditId.get(lead.id),
				lead.project?.name,
				lead.url,
			),
			targetUrl: lead.url,
			status: lead.statusLabel || 'COMPLETED',
			overallScore: lead.score,
			createdAt: lead.createdAt.toISOString(),
			category: category === 'ALL' ? null : category,
			categoryLabel: category && category !== 'ALL' ? getProjectCategoryLabel(category) : null,
			thumbnailUrl: lead.project?.thumbnailUrl ?? null,
			userType: normalizeUserType(lead.userType || (lead.userId ? 'user' : 'guest'), lead.userId),
			defectCount: defectByAuditId.get(lead.id) ?? null,
		};
	});

	projects = mergeByHost(projects, []);
	const dedupedAudits = mergeAuditsByHost(recentAudits, []);

	const counts = {
		projects: countByType(projects),
		audits: countByType(dedupedAudits),
	};

	if (filterCategory !== 'ALL') {
		projects = projects.filter((p) => p.category === filterCategory);
	}
	projects = projects.filter((p) => matchesTypeFilter(p.userType, typeFilter));
	const filteredAudits = dedupedAudits.filter((a) => matchesTypeFilter(a.userType, typeFilter));

	return noStoreJson({
		projects,
		recentAudits: filteredAudits,
		counts,
		categoryFilter: filterCategory,
		typeFilter,
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
