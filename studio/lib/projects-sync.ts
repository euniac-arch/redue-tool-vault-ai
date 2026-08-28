import { preferProjectName, resolveProjectSiteName } from '@/lib/audit/project-site-name';
import type { DiagnosisUserType } from '@/lib/firebase/audit-projects-types';
import { prisma } from '@/lib/prisma';
import type { AuditReport } from '@/lib/site-auditor';

function normalizeTargetUrl(raw: string): string {
	try {
		const u = new URL(raw);
		u.hash = '';
		const path = u.pathname.replace(/\/+$/, '') || '/';
		return `${u.protocol}//${u.host.toLowerCase()}${path === '/' ? '' : path}${u.search}`;
	} catch {
		return raw.trim().replace(/\/+$/, '');
	}
}

function hostKey(raw: string): string {
	try {
		return new URL(raw).hostname.replace(/^www\./, '').toLowerCase();
	} catch {
		return raw.trim().toLowerCase();
	}
}

function categoryScores(report: AuditReport) {
	const seo = report.categories?.find((c) => c.id === 'seo');
	const schema = report.categories?.find((c) => c.id === 'schema');
	const geoCat = report.categories?.find((c) => c.id === 'geo');
	const seoScore = seo ? Math.round((seo.score / Math.max(seo.maxScore, 1)) * 100) : Math.round(report.score);
	const schemaScore =
		typeof report.schemaCoverage === 'number'
			? Math.round(report.schemaCoverage)
			: schema
				? Math.round((schema.score / Math.max(schema.maxScore, 1)) * 100)
				: null;
	const geoScore =
		typeof report.geoCitationScore === 'number'
			? Math.round(report.geoCitationScore)
			: geoCat
				? Math.round((geoCat.score / Math.max(geoCat.maxScore, 1)) * 100)
				: null;
	return { seoScore, schemaScore, geoScore };
}

/**
 * After a free-audit scan: upsert Project by URL and link the AuditLead,
 * so completed diagnoses appear in /admin/projects.
 */
export async function syncProjectFromAuditLead(args: {
	auditLeadId: string;
	report: AuditReport;
	userType?: DiagnosisUserType;
	diagnosedAt?: Date;
}): Promise<{ projectId: string } | null> {
	const targetUrl = normalizeTargetUrl(args.report.url);
	if (!targetUrl) return null;

	const { seoScore, schemaScore, geoScore } = categoryScores(args.report);
	const overall = Math.round(args.report.score);
	const latestUserType = args.userType || 'guest';
	const host = hostKey(targetUrl);
	const siteName = resolveProjectSiteName(args.report);

	const existing =
		(await prisma.project.findFirst({
			where: {
				OR: [{ targetUrl }, { targetUrl: args.report.url }, { latestAuditId: args.auditLeadId }],
			},
			orderBy: { updatedAt: 'desc' },
		})) ||
		(await prisma.project.findFirst({
			where: { targetUrl: { contains: host } },
			orderBy: { updatedAt: 'desc' },
		}).then((row) => (row && hostKey(row.targetUrl) === host ? row : null)));

	let projectId: string;

	if (existing) {
		const updated = await prisma.project.update({
			where: { id: existing.id },
			data: {
				name: preferProjectName(siteName, existing.name, targetUrl),
				targetUrl,
				latestScore: overall,
				latestSeoScore: seoScore,
				latestGeoScore: geoScore,
				latestSchemaScore: schemaScore,
				latestAuditId: args.auditLeadId,
				latestUserType,
				auditCount: existing.latestAuditId === args.auditLeadId ? existing.auditCount : { increment: 1 },
				status: 'ACTIVE',
			},
		});
		projectId = updated.id;
	} else {
		const created = await prisma.project.create({
			data: {
				name: siteName,
				targetUrl,
				cmsType: 'UNKNOWN',
				category: 'SOLUTIONS',
				status: 'ACTIVE',
				latestScore: overall,
				latestSeoScore: seoScore,
				latestGeoScore: geoScore,
				latestSchemaScore: schemaScore,
				latestAuditId: args.auditLeadId,
				latestUserType,
				auditCount: 1,
			},
		});
		projectId = created.id;
	}

	await prisma.auditLead.update({
		where: { id: args.auditLeadId },
		data: { projectId },
	});

	return { projectId };
}

/**
 * Backfill: link orphan AuditLeads (no projectId) to projects so history
 * and project list stay in sync for older scans.
 */
export async function backfillOrphanAuditLeads(limit = 50): Promise<number> {
	const orphans = await prisma.auditLead.findMany({
		where: { projectId: null },
		orderBy: { createdAt: 'desc' },
		take: limit,
	});

	let linked = 0;
	for (const lead of orphans) {
		try {
			const report = JSON.parse(lead.reportJson) as AuditReport;
			if (!report?.url) continue;
			const userType = (lead.userType as DiagnosisUserType) || (lead.userId ? 'user' : 'guest');
			const result = await syncProjectFromAuditLead({ auditLeadId: lead.id, report, userType });
			if (result) linked += 1;
		} catch {
			// skip corrupt rows
		}
	}
	return linked;
}
