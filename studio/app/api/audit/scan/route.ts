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
	/** Recrawl live HTML meta/schema. Defaults to true; set false only to skip cache-bust. */
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

function errorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}

function errorStack(err: unknown): string | undefined {
	return err instanceof Error ? err.stack : undefined;
}

function clientErrorPayload(err: unknown): { status: number; error: string; stage: string } {
	if (err instanceof UnsafeAuditUrlError) {
		return { status: 400, error: err.message, stage: 'url' };
	}
	const message = errorMessage(err);
	if (/json/i.test(message) && /parse|unexpected/i.test(message)) {
		return {
			status: 502,
			error: '사이트 또는 외부 API 응답을 해석하지 못했습니다. 잠시 후 다시 시도해 주세요.',
			stage: 'json',
		};
	}
	if (/timeout|aborted|fetch failed|ECONN|ENOTFOUND|certificate|SSL|TLS/i.test(message)) {
		return {
			status: 502,
			error: '대상 사이트에 연결하지 못했습니다. URL, 방화벽, SSL 인증서를 확인해 주세요.',
			stage: 'fetch',
		};
	}
	if (/api key|rate limit|quota|openai|gemini|anthropic|claude/i.test(message)) {
		return {
			status: 502,
			error: '외부 AI API 호출에 실패했습니다. 잠시 후 다시 시도해 주세요.',
			stage: 'ai',
		};
	}
	return {
		status: 500,
		error: '진단 중 오류가 발생했습니다. URL을 다시 확인해 주세요.',
		stage: 'audit',
	};
}

/**
 * POST /api/audit/scan — public lead-magnet endpoint. Returns the live report
 * plus `id` of the persisted Firestore `audit_projects` doc (primary) so the
 * client can deep-link to `/audit/result?id=…` and `/admin/solve?id=…`.
 *
 * Same `targetUrl` is always recrawled (HTML meta + schema). `forceRefresh`
 * (default true) cache-busts the live crawl and overwrites the existing audit
 * row (replaceId or latest same-URL doc) instead of returning stored cache.
 */
export async function POST(request: Request) {
	let rawUrl = '';
	try {
		const body = (await request.json().catch((err) => {
			console.error('[audit/scan] request JSON parse failed:', errorMessage(err));
			return {} as AuditScanBody;
		})) as AuditScanBody;
		rawUrl = body.url?.trim() || '';
		if (!rawUrl) {
			return noStoreJson({ error: '진단할 URL을 입력해 주세요.', stage: 'url' }, { status: 400 });
		}

		let lang: AuditLang;
		try {
			lang = await resolveLang(body.lang);
		} catch (err) {
			console.error('[audit/scan] locale resolve failed:', errorMessage(err), errorStack(err));
			lang = 'ko';
		}
		const forceRefresh = body.forceRefresh !== false;
		const replaceId = typeof body.replaceId === 'string' ? body.replaceId.trim() : '';

		let report;
		try {
			// Live-fetch HTML meta + schema. forceRefresh (default) cache-busts CDN/proxy
			// and overwrites the prior diagnosis row for the same targetUrl.
			report = await auditSite(rawUrl, lang, { forceRefresh });
		} catch (err) {
			const mapped = clientErrorPayload(err);
			console.error('[audit/scan] auditSite failed:', {
				url: rawUrl,
				stage: mapped.stage,
				message: errorMessage(err),
				stack: errorStack(err),
			});
			return noStoreJson(
				{ error: mapped.error, stage: mapped.stage },
				{ status: mapped.status },
			);
		}

		let session: Awaited<ReturnType<typeof getServerSession>> = null;
		try {
			session = await getServerSession(authOptions);
		} catch (err) {
			console.error('[audit/scan] session lookup failed:', errorMessage(err), errorStack(err));
		}

		let auditId: string | null = null;
		let createInput;
		try {
			createInput = buildAuditProjectCreateInput(report);
		} catch (err) {
			console.error('[audit/scan] audit payload build failed:', errorMessage(err), errorStack(err));
			createInput = null;
		}

		// Primary: Firestore audit_projects (source of truth for /admin/solve & /admin/projects)
		if (createInput && isFirebaseAdminConfigured()) {
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
				console.error('[audit/scan] Firestore audit_projects save failed:', {
					url: report.url,
					message: errorMessage(err),
					stack: errorStack(err),
				});
			}
		}

		// Secondary: Prisma AuditLead (legacy share links / history) — best-effort
		try {
			let reportJson: string;
			try {
				reportJson = JSON.stringify(report);
			} catch (err) {
				console.error('[audit/scan] report JSON.stringify failed:', errorMessage(err), errorStack(err));
				throw err;
			}

			const leadData = {
				url: report.url,
				score: report.score,
				maxScore: report.maxScore,
				statusLabel: report.statusLabel,
				reportJson,
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
					} catch (err) {
						console.error('[audit/scan] Prisma replaceId update skipped:', {
							replaceId,
							message: errorMessage(err),
						});
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
				await syncProjectFromAuditLead({ auditLeadId: leadId, report }).catch((err) => {
					console.error('[audit/scan] project sync failed:', errorMessage(err), errorStack(err));
					return null;
				});
			} else {
				const lead = await prisma.auditLead.create({ data: leadData });
				if (!auditId) auditId = lead.id;
				await syncProjectFromAuditLead({ auditLeadId: lead.id, report }).catch((err) => {
					console.error('[audit/scan] project sync failed:', errorMessage(err), errorStack(err));
					return null;
				});
			}
		} catch (err) {
			console.error('[audit/scan] Prisma AuditLead save failed:', {
				url: report.url,
				message: errorMessage(err),
				stack: errorStack(err),
			});
			// Lead logging is best-effort — never fail the visitor-facing report over it.
		}

		return noStoreJson({ ...report, id: auditId, forceRefresh });
	} catch (err) {
		const mapped = clientErrorPayload(err);
		console.error('[audit/scan] unhandled POST error:', {
			url: rawUrl || '(missing)',
			stage: mapped.stage,
			message: errorMessage(err),
			stack: errorStack(err),
		});
		return noStoreJson({ error: mapped.error, stage: mapped.stage }, { status: mapped.status });
	}
}
