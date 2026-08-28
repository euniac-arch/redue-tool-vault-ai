/**
 * Server-side query for admin diagnostic history.
 * Reads Firestore `diagnostics` and fills gaps from `audit_projects`.
 */
import { listAuditProjects } from '@/lib/firebase/audit-projects';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { listDiagnostics, getDiagnosticById, type StoredDiagnostic } from '@/lib/firebase/diagnostics';
import { prisma } from '@/lib/prisma';
import { mapAuditProjectToDiagnostic } from './diagnostic-from-audit';
import {
	filterDiagnostics,
	paginateDiagnostics,
	sortDiagnostics,
	summarizeDiagnostics,
	toKpiSummary,
	type DiagnosticDetail,
	type DiagnosticFilters,
	type DiagnosticPageSize,
	type DiagnosticSortBy,
} from './diagnostic-management';

export type QueryDiagnosticsParams = {
	filters: DiagnosticFilters;
	page: number;
	pageSize: DiagnosticPageSize;
	sortBy?: DiagnosticSortBy;
};

async function resolveRequestedBy(userId: string | null): Promise<string> {
	if (!userId) return 'Guest';
	try {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { email: true },
		});
		return user?.email || 'Guest';
	} catch {
		return 'Guest';
	}
}

export async function collectDiagnosticRows(): Promise<DiagnosticDetail[]> {
	if (!isFirebaseAdminConfigured()) return [];

	const [stored, projects] = await Promise.all([listDiagnostics(400), listAuditProjects(200)]);
	const byId = new Map<string, DiagnosticDetail>();

	for (const row of stored) {
		byId.set(row.id, row);
		if (row.auditProjectId) byId.set(row.auditProjectId, row);
	}

	const missingUserIds = [
		...new Set(
			projects
				.filter((project) => !byId.has(project.id) && project.userId)
				.map((project) => project.userId as string),
		),
	];
	const emailByUserId = new Map<string, string>();
	if (missingUserIds.length > 0) {
		try {
			const users = await prisma.user.findMany({
				where: { id: { in: missingUserIds } },
				select: { id: true, email: true },
			});
			for (const user of users) {
				if (user.email) emailByUserId.set(user.id, user.email);
			}
		} catch {
			// Prisma may be unavailable — fall back to Guest.
		}
	}

	for (const project of projects) {
		if (byId.has(project.id)) continue;
		const requestedBy =
			emailByUserId.get(project.userId || '') ||
			(project.userType === 'guest' || !project.userId ? 'Guest' : 'Guest');
		byId.set(project.id, mapAuditProjectToDiagnostic(project, requestedBy));
	}

	return [...new Map([...byId.values()].map((row) => [row.id, row])).values()];
}

export async function queryDiagnosticHistory(params: QueryDiagnosticsParams) {
	const all = await collectDiagnosticRows();
	const filtered = filterDiagnostics(all, params.filters);
	const sorted = sortDiagnostics(filtered, params.sortBy);
	const totalPages = Math.max(1, Math.ceil(sorted.length / params.pageSize));
	const safePage = Math.min(Math.max(1, params.page), totalPages);
	const items = paginateDiagnostics(sorted, safePage, params.pageSize).map((row) => ({
		id: row.id,
		siteName: row.siteName,
		domain: row.domain,
		category: row.category,
		totalScore: row.totalScore,
		geoScore: row.geoScore,
		schemaScore: row.schemaScore,
		status: row.status,
		issues: row.issues,
		requestedBy: row.requestedBy,
		createdAt: row.createdAt,
		reportShareUrl: row.reportShareUrl,
	}));

	return {
		items,
		totalCount: sorted.length,
		page: safePage,
		pageSize: params.pageSize,
		totalPages,
		kpiSummary: toKpiSummary(summarizeDiagnostics(all)),
	};
}

export async function queryDiagnosticDetail(id: string): Promise<DiagnosticDetail | null> {
	const stored = await getDiagnosticById(id);
	if (stored) {
		if (stored.requestedBy === 'Guest' && stored.userId) {
			const email = await resolveRequestedBy(stored.userId);
			return { ...stored, requestedBy: email };
		}
		return stored;
	}

	const all = await collectDiagnosticRows();
	return all.find((row) => row.id === id) ?? null;
}

export type { StoredDiagnostic };
