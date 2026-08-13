import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import {
	deleteAllAuditProjects,
	deleteAuditProjectsByIds,
} from '@/lib/firebase/audit-projects';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function normalizeUrl(raw: string): string {
	try {
		const u = new URL(raw);
		u.hash = '';
		const path = u.pathname.replace(/\/+$/, '') || '/';
		return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
	} catch {
		return raw.trim();
	}
}

/**
 * Remove Prisma Project + AuditLead rows that correspond to deleted Firestore
 * audit_projects (ids may be Firestore doc ids, Prisma Project ids, or AuditLead ids).
 */
async function deletePrismaRecordsForIds(ids: string[], urls: string[]) {
	const uniqueIds = [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];
	const uniqueUrls = [...new Set(urls.map(normalizeUrl).filter(Boolean))];

	const leadWhere =
		uniqueIds.length || uniqueUrls.length
			? {
					OR: [
						...(uniqueIds.length
							? [{ id: { in: uniqueIds } }, { projectId: { in: uniqueIds } }]
							: []),
						...(uniqueUrls.length ? [{ url: { in: uniqueUrls } }] : []),
					],
				}
			: null;

	const projectWhere =
		uniqueIds.length || uniqueUrls.length
			? {
					OR: [
						...(uniqueIds.length
							? [{ id: { in: uniqueIds } }, { latestAuditId: { in: uniqueIds } }]
							: []),
						...(uniqueUrls.length ? [{ targetUrl: { in: uniqueUrls } }] : []),
					],
				}
			: null;

	const [leadsResult, projectsResult] = await Promise.all([
		leadWhere ? prisma.auditLead.deleteMany({ where: leadWhere }) : Promise.resolve({ count: 0 }),
		projectWhere ? prisma.project.deleteMany({ where: projectWhere }) : Promise.resolve({ count: 0 }),
	]);

	// URL matching in SQLite is exact; also sweep leads whose url normalizes to a deleted url.
	if (uniqueUrls.length > 0) {
		const urlSet = new Set(uniqueUrls);
		const leftoverLeads = await prisma.auditLead.findMany({
			select: { id: true, url: true },
			take: 500,
			orderBy: { createdAt: 'desc' },
		});
		const orphanLeadIds = leftoverLeads
			.filter((lead) => urlSet.has(normalizeUrl(lead.url)))
			.map((lead) => lead.id);
		if (orphanLeadIds.length) {
			const extra = await prisma.auditLead.deleteMany({ where: { id: { in: orphanLeadIds } } });
			leadsResult.count += extra.count;
		}

		const leftoverProjects = await prisma.project.findMany({
			select: { id: true, targetUrl: true },
			take: 500,
			orderBy: { createdAt: 'desc' },
		});
		const orphanProjectIds = leftoverProjects
			.filter((project) => urlSet.has(normalizeUrl(project.targetUrl)))
			.map((project) => project.id);
		if (orphanProjectIds.length) {
			const extra = await prisma.project.deleteMany({ where: { id: { in: orphanProjectIds } } });
			projectsResult.count += extra.count;
		}
	}

	return { auditLeadsDeleted: leadsResult.count, projectsDeleted: projectsResult.count };
}

function revalidateAuditViews() {
	revalidatePath('/audit/history');
	revalidatePath('/admin/projects');
	revalidatePath('/audit/result');
}

/**
 * POST /api/admin/projects/bulk-delete
 * Body: { ids?: string[], all?: boolean }
 *
 * Hard-deletes Firestore `audit_projects` and matching Prisma Project / AuditLead
 * rows so /audit/history cannot resurface deleted diagnostics.
 * TEMP: requireAdmin bypassed while login is incomplete.
 */
export async function POST(request: Request) {
	const body = (await request.json().catch(() => null)) as { ids?: string[]; all?: boolean } | null;

	try {
		if (body?.all === true) {
			let firestoreDeleted = 0;
			if (isFirebaseAdminConfigured()) {
				const fsResult = await deleteAllAuditProjects();
				firestoreDeleted = fsResult.deleted;
			}
			const [leadsResult, projectsResult] = await Promise.all([
				prisma.auditLead.deleteMany(),
				prisma.project.deleteMany(),
			]);
			const deleted = Math.max(firestoreDeleted, projectsResult.count, leadsResult.count);
			revalidateAuditViews();
			return NextResponse.json({
				ok: true,
				deleted,
				all: true,
				firestoreDeleted,
				prismaDeleted: projectsResult.count,
				auditLeadsDeleted: leadsResult.count,
			});
		}

		const list = Array.isArray(body?.ids)
			? [...new Set(body!.ids!.map((id) => String(id || '').trim()).filter(Boolean))]
			: [];

		if (list.length === 0) {
			return NextResponse.json(
				{ error: true, code: 'MISSING_IDS', message: '삭제할 프로젝트 ID가 필요합니다.' },
				{ status: 400 },
			);
		}

		let firestoreDeleted = 0;
		let urls: string[] = [];
		if (isFirebaseAdminConfigured()) {
			const fsResult = await deleteAuditProjectsByIds(list);
			firestoreDeleted = fsResult.deleted;
			urls = fsResult.urls;
		}

		// Also resolve URLs from Prisma leads/projects when Firestore ids miss or Admin is off.
		const [leadsForUrls, projectsForUrls] = await Promise.all([
			prisma.auditLead.findMany({
				where: { OR: [{ id: { in: list } }, { projectId: { in: list } }] },
				select: { url: true },
			}),
			prisma.project.findMany({
				where: { OR: [{ id: { in: list } }, { latestAuditId: { in: list } }] },
				select: { targetUrl: true },
			}),
		]);
		urls = [
			...new Set([
				...urls,
				...leadsForUrls.map((l) => l.url),
				...projectsForUrls.map((p) => p.targetUrl),
			]),
		];

		const prismaCleanup = await deletePrismaRecordsForIds(list, urls);
		const deleted = Math.max(
			firestoreDeleted,
			prismaCleanup.projectsDeleted,
			prismaCleanup.auditLeadsDeleted,
		);

		revalidateAuditViews();
		return NextResponse.json({
			ok: true,
			deleted,
			ids: list,
			all: false,
			firestoreDeleted,
			prismaDeleted: prismaCleanup.projectsDeleted,
			auditLeadsDeleted: prismaCleanup.auditLeadsDeleted,
		});
	} catch (err) {
		console.error('[admin/projects/bulk-delete] failed:', err);
		return NextResponse.json(
			{
				error: true,
				code: 'DELETE_FAILED',
				message: err instanceof Error ? err.message : '프로젝트 삭제에 실패했습니다.',
			},
			{ status: 500 },
		);
	}
}
