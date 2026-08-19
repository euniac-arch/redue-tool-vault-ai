import { ensureMasterAdminUser } from '@/lib/ensure-master-admin';
import { MASTER_ADMIN_ID } from '@/lib/master-admin';
import { prisma } from '@/lib/prisma';
import { gradeForScore } from '@/lib/audit/score-grade';
import { formatTargetCategory, resolveTargetBrandName } from '@/lib/audit/target-entity';
import { resolveAuditScoreFromReport } from '@/lib/audit/resolveAuditScore';
import type { AuditReport as SiteAuditReport } from '@/lib/site-auditor';

function errorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}

export function auditDomainFromReport(report: SiteAuditReport): string {
	const fromMeta = report.siteMeta?.domain?.trim();
	if (fromMeta) return fromMeta.replace(/^www\./i, '').toLowerCase();
	try {
		return new URL(report.url).hostname.replace(/^www\./i, '').toLowerCase();
	} catch {
		return report.url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] || report.url;
	}
}

function persistFields(report: SiteAuditReport) {
	const domain = auditDomainFromReport(report);
	const brandName = resolveTargetBrandName(report) || domain;
	const category = formatTargetCategory(report.siteMeta, report.lang === 'en' ? 'en' : 'ko');
	const auditScore = resolveAuditScoreFromReport(report);
	const score = Math.round(auditScore.normalizedScore ?? report.score ?? 0);
	const grade = String(auditScore.grade || gradeForScore(score));
	return {
		domain,
		brandName,
		category,
		score,
		grade,
		statusLabel: report.statusLabel,
		reportJson: JSON.stringify(report),
	};
}

export async function persistSignedInAuditReport(opts: {
	report: SiteAuditReport;
	userId: string;
	preferredId?: string | null;
	replaceId?: string | null;
}): Promise<{ id: string } | null> {
	const userId = opts.userId.trim() || MASTER_ADMIN_ID;
	if (userId === MASTER_ADMIN_ID) {
		await ensureMasterAdminUser().catch((err) => {
			console.error('[audit/persist] ensureMasterAdminUser failed:', errorMessage(err));
		});
	}
	const preferredId = opts.preferredId?.trim() || '';
	const replaceId = opts.replaceId?.trim() || '';
	const data = persistFields(opts.report);

	try {
		if (replaceId) {
			try {
				const updated = await prisma.auditReport.update({
					where: { id: replaceId },
					data: { ...data, userId },
					select: { id: true },
				});
				return updated;
			} catch {
				// replaceId may belong to Firestore / AuditLead only
			}
		}

		if (preferredId) {
			try {
				const updated = await prisma.auditReport.update({
					where: { id: preferredId },
					data: { ...data, userId },
					select: { id: true },
				});
				return updated;
			} catch {
				try {
					const created = await prisma.auditReport.create({
						data: { id: preferredId, userId, ...data },
						select: { id: true },
					});
					return created;
				} catch {
					// Fall through to userId+domain upsert
				}
			}
		}

		const saved = await prisma.auditReport.upsert({
			where: { userId_domain: { userId, domain: data.domain } },
			create: { userId, ...data },
			update: data,
			select: { id: true },
		});
		return saved;
	} catch (err) {
		console.error('[audit/persist] AuditReport save failed:', errorMessage(err));
		return null;
	}
}
