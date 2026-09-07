/**
 * Server-side query for admin diagnostic history.
 * Reads Firestore `diagnostics` / `reports` / `audit_projects`, then fills
 * gaps from Prisma `AuditLead` + `AuditReport` so the page never depends on
 * Firebase being configured.
 */
import { listAuditProjects } from '@/lib/firebase/audit-projects';
import { describeFirebaseAdminSetup, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { listDiagnostics, getDiagnosticById, type StoredDiagnostic } from '@/lib/firebase/diagnostics';
import { prisma } from '@/lib/prisma';
import type { AuditReport } from '@/lib/site-auditor';
import { buildDiagnosticFromReport, hostnameFromUrl, mapAuditProjectToDiagnostic } from './diagnostic-from-audit';
import {
	filterDiagnostics,
	formatDisplayDateTime,
	paginateDiagnostics,
	scoreToStatus,
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

function parseStoredReport(reportJson: string): AuditReport | null {
	try {
		const parsed = JSON.parse(reportJson) as AuditReport;
		if (parsed && typeof parsed === 'object' && typeof parsed.url === 'string') return parsed;
	} catch {
		/* ignore */
	}
	return null;
}

function fallbackFromLead(input: {
	id: string;
	url: string;
	score: number;
	statusLabel: string;
	createdAt: Date;
	requestedBy: string;
}): DiagnosticDetail {
	const domain = hostnameFromUrl(input.url);
	const totalScore = Math.max(0, Math.min(100, input.score));
	return {
		id: input.id,
		siteName: domain || input.url,
		domain,
		category: 'Corporate',
		totalScore,
		geoScore: totalScore,
		schemaScore: totalScore,
		status: scoreToStatus(totalScore),
		issues: input.statusLabel ? [input.statusLabel] : [],
		requestedBy: input.requestedBy,
		createdAt: formatDisplayDateTime(input.createdAt.toISOString()),
		reportShareUrl: `/audit/result?id=${encodeURIComponent(input.id)}`,
		knowledgeGraphScore: totalScore,
		localSovScore: totalScore,
		recommendations: [],
		summary: `${domain} 진단 결과 종합 ${totalScore}점입니다.`,
		prescriptionIssued: false,
		reportData: {
			url: input.url,
			knowledgeGraphScore: totalScore,
			localSovScore: totalScore,
			recommendations: [],
			summary: `${domain} 진단 결과 종합 ${totalScore}점입니다.`,
			prescriptionIssued: false,
		},
		url: input.url,
	};
}

async function collectPrismaDiagnosticRows(): Promise<DiagnosticDetail[]> {
	try {
		const [leads, reports] = await Promise.all([
			prisma.auditLead.findMany({
				orderBy: { createdAt: 'desc' },
				take: 300,
				select: {
					id: true,
					url: true,
					score: true,
					statusLabel: true,
					reportJson: true,
					userId: true,
					createdAt: true,
				},
			}),
			prisma.auditReport.findMany({
				orderBy: { createdAt: 'desc' },
				take: 200,
				select: {
					id: true,
					domain: true,
					brandName: true,
					score: true,
					reportJson: true,
					userId: true,
					createdAt: true,
				},
			}),
		]);

		const userIds = [
			...new Set(
				[...leads, ...reports]
					.map((row) => row.userId)
					.filter((id): id is string => Boolean(id)),
			),
		];
		const emailByUserId = new Map<string, string>();
		if (userIds.length > 0) {
			const users = await prisma.user.findMany({
				where: { id: { in: userIds } },
				select: { id: true, email: true },
			});
			for (const user of users) {
				if (user.email) emailByUserId.set(user.id, user.email);
			}
		}

		const rows: DiagnosticDetail[] = [];
		for (const lead of leads) {
			const requestedBy = emailByUserId.get(lead.userId || '') || 'Guest';
			const report = parseStoredReport(lead.reportJson);
			if (report) {
				rows.push(
					buildDiagnosticFromReport(report, {
						id: lead.id,
						requestedBy,
						createdAt: formatDisplayDateTime(lead.createdAt.toISOString()),
					}),
				);
				continue;
			}
			rows.push(
				fallbackFromLead({
					id: lead.id,
					url: lead.url,
					score: lead.score,
					statusLabel: lead.statusLabel,
					createdAt: lead.createdAt,
					requestedBy,
				}),
			);
		}

		for (const reportRow of reports) {
			if (rows.some((row) => row.id === reportRow.id)) continue;
			const requestedBy = emailByUserId.get(reportRow.userId) || 'Guest';
			const report = parseStoredReport(reportRow.reportJson);
			if (report) {
				rows.push(
					buildDiagnosticFromReport(report, {
						id: reportRow.id,
						requestedBy,
						createdAt: formatDisplayDateTime(reportRow.createdAt.toISOString()),
					}),
				);
				continue;
			}
			rows.push(
				fallbackFromLead({
					id: reportRow.id,
					url: `https://${reportRow.domain}`,
					score: reportRow.score,
					statusLabel: reportRow.brandName,
					createdAt: reportRow.createdAt,
					requestedBy,
				}),
			);
		}

		return rows;
	} catch (error) {
		console.error('[diagnostic-query] prisma fallback failed:', error);
		return [];
	}
}

export async function collectDiagnosticRows(): Promise<DiagnosticDetail[]> {
	const byId = new Map<string, DiagnosticDetail>();

	if (isFirebaseAdminConfigured()) {
		try {
			const [stored, projects] = await Promise.all([listDiagnostics(400), listAuditProjects(200)]);
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
		} catch (error) {
			console.error('[diagnostic-query] firestore collect failed:', error);
		}
	}

	const prismaRows = await collectPrismaDiagnosticRows();
	for (const row of prismaRows) {
		if (!byId.has(row.id)) byId.set(row.id, row);
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
		url: row.url || row.reportData?.url || `https://${row.domain}`,
	}));
	const firebase = describeFirebaseAdminSetup();

	return {
		items,
		totalCount: sorted.length,
		page: safePage,
		pageSize: params.pageSize,
		totalPages,
		kpiSummary: toKpiSummary(summarizeDiagnostics(all)),
		firebaseConfigured: firebase.configured,
		firebaseHint: firebase.hint,
		firebaseMissing: firebase.missing,
		source: firebase.configured ? 'firestore+prisma' : 'prisma',
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
