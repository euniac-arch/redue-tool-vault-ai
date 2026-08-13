import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { LOCALE_COOKIE, SUPPORTED_LOCALES } from '@/i18n/request';
import { authOptions } from '@/lib/auth';
import {
	addAuditProject,
	buildAuditProjectCreateInput,
	findLatestAuditProjectByUrl,
	updateAuditProject,
} from '@/lib/firebase/audit-projects';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { prisma } from '@/lib/prisma';
import { syncProjectFromAuditLead } from '@/lib/projects-sync';
import { auditSite, type AuditLang } from '@/lib/site-auditor';
import { UnsafeAuditUrlError } from '@/lib/ssrf-guard';

export const runtime = 'nodejs';

interface AuditScanBody {
	url?: string;
	lang?: string;
	/** When true: live crawl with cache-bust; overwrite prior history row for this URL. */
	forceRefresh?: boolean;
	/** Client cache-bust timestamp (ignored server-side except for logging). */
	t?: number;
	/** Existing Firestore / AuditLead id to overwrite on re-audit. */
	replaceId?: string;
}

function noStoreJson(body: unknown, init?: { status?: number }) {
	return NextResponse.json(body, {
		status: init?.status,
		headers: {
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
		},
	});
}

function normalizeMatchUrl(raw: string): string {
	try {
		const u = new URL(raw);
		u.hash = '';
		const path = u.pathname.replace(/\/+$/, '') || '/';
		return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
	} catch {
		return raw.trim().toLowerCase().replace(/\/+$/, '');
	}
}

function hostKey(raw: string): string {
	try {
		return new URL(raw).hostname.replace(/^www\./, '').toLowerCase();
	} catch {
		return raw.trim().toLowerCase();
	}
}

async function resolveLang(explicit?: string): Promise<AuditLang> {
	if (SUPPORTED_LOCALES.includes(explicit as AuditLang)) return explicit as AuditLang;
	const store = await cookies();
	const cookieLocale = store.get(LOCALE_COOKIE)?.value;
	return SUPPORTED_LOCALES.includes(cookieLocale as AuditLang) ? (cookieLocale as AuditLang) : 'ko';
}

/**
 * POST /api/audit/scan — public lead-magnet endpoint. Returns the live report
 * plus `id` of the persisted Firestore `audit_projects` doc (primary) so the
 * client can deep-link to `/audit/result?id=…` and `/admin/solve?id=…`.
 *
 * With `forceRefresh: true`, skips history reuse, cache-busts the live crawl,
 * and overwrites the existing audit row (replaceId or latest same-URL doc).
 */
export async function POST(request: Request) {
	const body = (await request.json().catch(() => ({}))) as AuditScanBody;
	const rawUrl = body.url?.trim();
	if (!rawUrl) {
		return noStoreJson({ error: '진단할 URL을 입력해 주세요.' }, { status: 400 });
	}

	const lang = await resolveLang(body.lang);
	const forceRefresh = body.forceRefresh === true;
	const replaceId = typeof body.replaceId === 'string' ? body.replaceId.trim() : '';

	let report;
	try {
		// Always live-fetch; forceRefresh adds ?_redue_nocache= and no-cache headers.
		report = await auditSite(rawUrl, lang, { forceRefresh });
	} catch (err) {
		if (err instanceof UnsafeAuditUrlError) {
			return noStoreJson({ error: err.message }, { status: 400 });
		}
		return noStoreJson(
			{ error: '진단 중 오류가 발생했습니다. URL을 다시 확인해 주세요.' },
			{ status: 500 },
		);
	}

	const session = await getServerSession(authOptions);
	let auditId: string | null = null;
	const createInput = buildAuditProjectCreateInput(report);

	// Primary: Firestore audit_projects (source of truth for /admin/solve & /admin/projects)
	if (isFirebaseAdminConfigured()) {
		try {
			if (forceRefresh) {
				let overwritten: { id: string } | null = null;
				if (replaceId) {
					overwritten = await updateAuditProject(replaceId, createInput);
				}
				if (!overwritten) {
					const existing = await findLatestAuditProjectByUrl(report.url);
					if (existing) {
						overwritten = await updateAuditProject(existing.id, createInput);
					}
				}
				if (overwritten) {
					auditId = overwritten.id;
				} else {
					const created = await addAuditProject(createInput);
					auditId = created.id;
				}
			} else {
				const created = await addAuditProject(createInput);
				auditId = created.id;
			}
		} catch (err) {
			console.error('[audit/scan] Firestore audit_projects save failed:', err);
		}
	}

	// Secondary: Prisma AuditLead (legacy share links / history) — best-effort
	try {
		const leadData = {
			url: report.url,
			score: report.score,
			maxScore: report.maxScore,
			statusLabel: report.statusLabel,
			reportJson: JSON.stringify(report),
			userId: session?.user?.id ?? null,
		};

		if (forceRefresh) {
			let leadId: string | null = null;

			if (replaceId) {
				try {
					const updated = await prisma.auditLead.update({
						where: { id: replaceId },
						data: leadData,
					});
					leadId = updated.id;
				} catch {
					// replaceId may be a Firestore-only id — fall through to URL match / create
				}
			}

			if (!leadId) {
				const host = hostKey(report.url);
				const recent = await prisma.auditLead.findMany({
					orderBy: { createdAt: 'desc' },
					take: 40,
					select: { id: true, url: true },
				});
				const existing =
					recent.find((row) => normalizeMatchUrl(row.url) === normalizeMatchUrl(report.url)) ||
					recent.find((row) => hostKey(row.url) === host);
				if (existing) {
					const updated = await prisma.auditLead.update({
						where: { id: existing.id },
						data: leadData,
					});
					leadId = updated.id;
				}
			}

			if (!leadId) {
				const lead = await prisma.auditLead.create({ data: leadData });
				leadId = lead.id;
			}

			if (!auditId) auditId = leadId;
			await syncProjectFromAuditLead({ auditLeadId: leadId, report }).catch(() => null);
		} else {
			const lead = await prisma.auditLead.create({ data: leadData });
			if (!auditId) auditId = lead.id;
			await syncProjectFromAuditLead({ auditLeadId: lead.id, report }).catch(() => null);
		}
	} catch {
		// Lead logging is best-effort — never fail the visitor-facing report over it.
	}

	return noStoreJson({ ...report, id: auditId, forceRefresh });
}
