/**
 * Cascade-delete a diagnosis across Firestore `audit_projects` and Prisma
 * (Project / AuditLead / AuditReport). History ids, Firestore doc ids, and
 * Prisma project ids can all differ for the same URL — delete by id AND url.
 */
import {
	deleteAllAuditProjects,
	deleteAuditProjectsByIds,
	deleteAuditProjectsByUrls,
} from '@/lib/firebase/audit-projects';
import { deleteDiagnosticsByIds, listDiagnostics } from '@/lib/firebase/diagnostics';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { prisma } from '@/lib/prisma';

export function normalizeAuditDeleteUrl(raw: string): string {
	try {
		const u = new URL(raw);
		u.hash = '';
		const path = u.pathname.replace(/\/+$/, '') || '/';
		return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
	} catch {
		return raw.trim();
	}
}

function uniqueIds(ids: Iterable<string>): string[] {
	return [...new Set([...ids].map((id) => String(id || '').trim()).filter(Boolean))];
}

function uniqueUrls(urls: Iterable<string>): string[] {
	return [...new Set([...urls].map(normalizeAuditDeleteUrl).filter(Boolean))];
}

export interface CascadeDeleteResult {
	deleted: boolean;
	firestoreDeleted: number;
	projectsDeleted: number;
	auditLeadsDeleted: number;
	auditReportsDeleted: number;
	ids: string[];
	urls: string[];
}

async function collectRelatedIdsAndUrls(ids: string[]): Promise<{ ids: string[]; urls: string[] }> {
	const idSet = new Set(ids);
	const urlSet = new Set<string>();

	if (ids.length === 0) return { ids: [], urls: [] };

	const [leads, projects, reports] = await Promise.all([
		prisma.auditLead.findMany({
			where: { OR: [{ id: { in: ids } }, { projectId: { in: ids } }] },
			select: { id: true, projectId: true, url: true },
		}),
		prisma.project.findMany({
			where: { OR: [{ id: { in: ids } }, { latestAuditId: { in: ids } }] },
			select: { id: true, latestAuditId: true, targetUrl: true },
		}),
		prisma.auditReport.findMany({
			where: { id: { in: ids } },
			select: { id: true, domain: true },
		}),
	]);

	for (const lead of leads) {
		idSet.add(lead.id);
		if (lead.projectId) idSet.add(lead.projectId);
		if (lead.url) urlSet.add(normalizeAuditDeleteUrl(lead.url));
	}
	for (const project of projects) {
		idSet.add(project.id);
		if (project.latestAuditId) idSet.add(project.latestAuditId);
		if (project.targetUrl) urlSet.add(normalizeAuditDeleteUrl(project.targetUrl));
	}
	for (const report of reports) {
		idSet.add(report.id);
		if (report.domain) urlSet.add(report.domain.toLowerCase());
	}

	return { ids: [...idSet], urls: [...urlSet] };
}

async function deletePrismaByIdsAndUrls(
	ids: string[],
	urls: string[],
): Promise<{ projectsDeleted: number; auditLeadsDeleted: number; auditReportsDeleted: number }> {
	const uniqueIdList = uniqueIds(ids);
	const uniqueUrlList = uniqueUrls(urls);

	const leadWhere =
		uniqueIdList.length || uniqueUrlList.length
			? {
					OR: [
						...(uniqueIdList.length
							? [{ id: { in: uniqueIdList } }, { projectId: { in: uniqueIdList } }]
							: []),
						...(uniqueUrlList.length ? [{ url: { in: uniqueUrlList } }] : []),
					],
				}
			: null;

	const projectWhere =
		uniqueIdList.length || uniqueUrlList.length
			? {
					OR: [
						...(uniqueIdList.length
							? [{ id: { in: uniqueIdList } }, { latestAuditId: { in: uniqueIdList } }]
							: []),
						...(uniqueUrlList.length ? [{ targetUrl: { in: uniqueUrlList } }] : []),
					],
				}
			: null;

	// Leads first so Project FK (onDelete: SetNull) never blocks project rows.
	const leadsResult = leadWhere
		? await prisma.auditLead.deleteMany({ where: leadWhere })
		: { count: 0 };
	const projectsResult = projectWhere
		? await prisma.project.deleteMany({ where: projectWhere })
		: { count: 0 };

	let auditLeadsDeleted = leadsResult.count;
	let projectsDeleted = projectsResult.count;

	if (uniqueUrlList.length > 0) {
		const urlSet = new Set(uniqueUrlList);
		const leftoverLeads = await prisma.auditLead.findMany({
			select: { id: true, url: true },
			take: 500,
			orderBy: { createdAt: 'desc' },
		});
		const orphanLeadIds = leftoverLeads
			.filter((lead) => urlSet.has(normalizeAuditDeleteUrl(lead.url)))
			.map((lead) => lead.id);
		if (orphanLeadIds.length) {
			const extra = await prisma.auditLead.deleteMany({ where: { id: { in: orphanLeadIds } } });
			auditLeadsDeleted += extra.count;
		}

		const leftoverProjects = await prisma.project.findMany({
			select: { id: true, targetUrl: true },
			take: 500,
			orderBy: { createdAt: 'desc' },
		});
		const orphanProjectIds = leftoverProjects
			.filter((project) => urlSet.has(normalizeAuditDeleteUrl(project.targetUrl)))
			.map((project) => project.id);
		if (orphanProjectIds.length) {
			const extra = await prisma.project.deleteMany({ where: { id: { in: orphanProjectIds } } });
			projectsDeleted += extra.count;
		}
	}

	let auditReportsDeleted = 0;
	if (uniqueIdList.length) {
		const byId = await prisma.auditReport.deleteMany({ where: { id: { in: uniqueIdList } } });
		auditReportsDeleted += byId.count;
	}
	if (uniqueUrlList.length) {
		const domains = [
			...new Set(
				uniqueUrlList
					.map((url) => {
						try {
							return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
						} catch {
							return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] || '';
						}
					})
					.filter(Boolean),
			),
		];
		if (domains.length) {
			const byDomain = await prisma.auditReport.deleteMany({ where: { domain: { in: domains } } });
			auditReportsDeleted += byDomain.count;
		}
	}

	return { projectsDeleted, auditLeadsDeleted, auditReportsDeleted };
}

export async function cascadeDeleteAudits(ids: string[]): Promise<CascadeDeleteResult> {
	const seedIds = uniqueIds(ids);
	if (seedIds.length === 0) {
		return {
			deleted: false,
			firestoreDeleted: 0,
			projectsDeleted: 0,
			auditLeadsDeleted: 0,
			auditReportsDeleted: 0,
			ids: [],
			urls: [],
		};
	}

	const related = await collectRelatedIdsAndUrls(seedIds);
	const allIds = uniqueIds([...seedIds, ...related.ids]);
	let urls = uniqueUrls(related.urls);

	let firestoreDeleted = 0;
	if (isFirebaseAdminConfigured()) {
		const byId = await deleteAuditProjectsByIds(allIds);
		firestoreDeleted += byId.deleted;
		urls = uniqueUrls([...urls, ...byId.urls]);
		if (urls.length) {
			const byUrl = await deleteAuditProjectsByUrls(urls);
			firestoreDeleted += byUrl.deleted;
			urls = uniqueUrls([...urls, ...byUrl.urls]);
		}
		const diagnosticIds = new Set(allIds);
		try {
			const diagnostics = await listDiagnostics(400);
			const hosts = new Set(
				urls.map((url) => {
					try {
						return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
					} catch {
						return url.replace(/^www\./i, '').toLowerCase();
					}
				}),
			);
			for (const row of diagnostics) {
				if (hosts.has(row.domain.replace(/^www\./i, '').toLowerCase())) {
					diagnosticIds.add(row.id);
				}
			}
		} catch {
			// Diagnostics cleanup is best-effort.
		}
		firestoreDeleted += await deleteDiagnosticsByIds([...diagnosticIds]);
	}

	const prismaCleanup = await deletePrismaByIdsAndUrls(allIds, urls);
	const deleted =
		firestoreDeleted > 0 ||
		prismaCleanup.projectsDeleted > 0 ||
		prismaCleanup.auditLeadsDeleted > 0 ||
		prismaCleanup.auditReportsDeleted > 0;

	return {
		deleted,
		firestoreDeleted,
		projectsDeleted: prismaCleanup.projectsDeleted,
		auditLeadsDeleted: prismaCleanup.auditLeadsDeleted,
		auditReportsDeleted: prismaCleanup.auditReportsDeleted,
		ids: allIds,
		urls,
	};
}

export async function cascadeDeleteAllAudits(): Promise<CascadeDeleteResult> {
	let firestoreDeleted = 0;
	if (isFirebaseAdminConfigured()) {
		const fsResult = await deleteAllAuditProjects();
		firestoreDeleted = fsResult.deleted;
		try {
			const diagnostics = await listDiagnostics(400);
			firestoreDeleted += await deleteDiagnosticsByIds(diagnostics.map((row) => row.id));
		} catch {
			// ignore
		}
	}
	const [leadsResult, projectsResult, reportsResult] = await Promise.all([
		prisma.auditLead.deleteMany(),
		prisma.project.deleteMany(),
		prisma.auditReport.deleteMany(),
	]);
	return {
		deleted: firestoreDeleted + leadsResult.count + projectsResult.count + reportsResult.count > 0,
		firestoreDeleted,
		projectsDeleted: projectsResult.count,
		auditLeadsDeleted: leadsResult.count,
		auditReportsDeleted: reportsResult.count,
		ids: [],
		urls: [],
	};
}
