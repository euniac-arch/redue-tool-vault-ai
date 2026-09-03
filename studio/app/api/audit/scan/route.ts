import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { LOCALE_COOKIE, SUPPORTED_LOCALES } from '@/i18n/request';
import { resolveDiagnosisActor, type DiagnosisUserType } from '@/lib/audit/diagnosis-actor';
import { authOptions } from '@/lib/auth';
import {
	addAuditProject,
	buildAuditProjectCreateInput,
	findLatestAuditProjectByUrl,
	updateAuditProject,
} from '@/lib/firebase/audit-projects';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { persistDiagnosticFromReport } from '@/lib/admin/diagnostic-persist';
import { persistSignedInAuditReport } from '@/lib/audit/persist-audit-report';
import {
	applyGuestAuditCookie,
	incrementAuditUsage,
	limitReachedPayload,
	resolveAuditQuota,
} from '@/lib/audit/free-audit-quota-server';
import { MASTER_ADMIN_ID, resolveNextAuthSecret } from '@/lib/master-admin';
import { prisma } from '@/lib/prisma';
import { syncProjectFromAuditLead } from '@/lib/projects-sync';
import {
	deletePsiCacheForUrl,
	fetchPageSpeedDeduped,
} from '@/lib/audit/pagespeed-fetch';
import type { PageSpeedSnapshot } from '@/lib/audit/pagespeed';
import { coerceHttpUrl } from '@/lib/audit/normalize-url';
import { auditSite, buildDegradedAuditReport, type AuditLang, type AuditReport } from '@/lib/site-auditor';
import { UnsafeAuditUrlError } from '@/lib/ssrf-guard';

export const runtime = 'nodejs';
// Force this route (and every fetch it triggers) off Next.js's Data Cache / Full Route
// Cache — a re-diagnosis must always hit the live target site, never a cached render.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
// Track 1/2 (HTML crawl) now fully determines the response time (~2-3s) — Track 3
// (PageSpeed/Lighthouse, mobile + desktop) is fired in the background and never awaited
// here (see `POST` below), so the result screen shows the dashboard immediately and
// renders Track 3 progressively once it lands (`useAuditReportEnrichment`). `maxDuration`
// stays generous because the background Lighthouse reads + the best-effort backfill they
// trigger (`scheduleTrack3Backfill`) keep this handler's async work alive well past the
// point the HTTP response is sent.
export const maxDuration = 90;

interface AuditScanBody {
	url?: string;
	lang?: string;
	/** Recrawl live HTML meta/schema. Defaults to true; set false only to skip cache-bust. */
	forceRefresh?: boolean;
	/** Full-site census (sitemap/GNB/CMS). Defaults to true. */
	fullAudit?: boolean;
	/** Reuse unchanged pages via content_hash. Defaults to true. */
	useDeltaCache?: boolean;
	/** Client cache-bust timestamp (ignored server-side except for logging). */
	t?: number;
	/** Existing Firestore / AuditLead id to overwrite on re-audit. */
	replaceId?: string;
	/** Client session hint — verified against the NextAuth cookie/JWT, never trusted alone. */
	userId?: string;
	role?: string;
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
 * Track 3 (PageSpeed/Lighthouse) is fired in the background and never blocks the scan
 * response (see `POST` below), so the report persisted a few lines earlier is saved
 * without it. Once both reads settle — usually 10-20s later — patch the already-saved
 * Firestore `audit_projects` doc (primary source for `/admin/solve` & `/admin/projects`)
 * and, for signed-in users, the durable Prisma `AuditReport` row, so reopening this same
 * audit later doesn't need a fresh Lighthouse run. Best-effort only: never throws and
 * never touches the response that already went out.
 */
function scheduleTrack3Backfill(
	report: AuditReport,
	desktopPromise: Promise<PageSpeedSnapshot | null>,
	mobilePromise: Promise<PageSpeedSnapshot | null>,
	ctx: {
		auditId: string | null;
		userType: DiagnosisUserType;
		sessionUserId: string | null;
		sessionEmail: string | null;
		userAgent: string | null;
	},
): void {
	void Promise.allSettled([desktopPromise, mobilePromise])
		.then(async ([desktopResult, mobileResult]) => {
			// Both promises already `.catch(() => null)` at the call site, so `allSettled`
			// is only a defense-in-depth guard — one strategy failing/rejecting must never
			// stop the other from backfilling.
			const pageSpeedDesktop = desktopResult.status === 'fulfilled' ? desktopResult.value : null;
			const pageSpeedMobile = mobileResult.status === 'fulfilled' ? mobileResult.value : null;
			if (!pageSpeedDesktop && !pageSpeedMobile) return;
			const mergedReport: AuditReport = { ...report, pageSpeedDesktop, pageSpeedMobile };

			if (ctx.auditId && isFirebaseAdminConfigured()) {
				try {
					const backfillInput = buildAuditProjectCreateInput(mergedReport, {
						userType: ctx.userType,
						userId: ctx.sessionUserId,
						userAgent: ctx.userAgent,
					});
					await updateAuditProject(ctx.auditId, backfillInput);
				} catch (err) {
					console.error('[audit/scan] Track 3 backfill (Firestore audit_projects) failed:', {
						url: mergedReport.url,
						message: errorMessage(err),
					});
				}
				try {
					await persistDiagnosticFromReport({
						report: mergedReport,
						requestedBy: ctx.sessionEmail,
						userId: ctx.sessionUserId,
						userType: ctx.userType,
						replaceId: ctx.auditId,
						auditProjectId: ctx.auditId,
						overwrite: true,
					});
				} catch (err) {
					console.error('[audit/scan] Track 3 backfill (Firestore diagnostics) failed:', {
						url: mergedReport.url,
						message: errorMessage(err),
					});
				}
			}

			if (ctx.sessionUserId) {
				try {
					await persistSignedInAuditReport({
						report: mergedReport,
						userId: ctx.sessionUserId,
						preferredId: ctx.auditId,
					});
				} catch (err) {
					console.error('[audit/scan] Track 3 backfill (Prisma AuditReport) failed:', {
						url: mergedReport.url,
						message: errorMessage(err),
					});
				}
			}
		})
		.catch((err) => {
			console.error('[audit/scan] Track 3 backfill failed unexpectedly:', errorMessage(err));
		});
}

function errorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}

function errorStack(err: unknown): string | undefined {
	return err instanceof Error ? err.stack : undefined;
}

/**
 * Safety-net deadline for any single awaited sub-task (Firestore/Prisma/session lookup/
 * Track 1-2 crawl). A hung network call does not *throw* — it just never resolves — so a
 * plain `try/catch` around it does nothing. Racing it against a timer that *rejects* turns
 * a silent hang into an ordinary error that the existing (already best-effort) catch
 * blocks around every call site below already know how to swallow, log, and move past.
 * The original promise is never aborted; it keeps running in the background (e.g. to warm
 * a cache) and any late resolution/rejection is ignored.
 */
function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	let settled = false;
	promise.then(
		() => {
			settled = true;
		},
		() => {
			settled = true;
		},
	);
	return Promise.race([
		promise,
		new Promise<T>((_, reject) => {
			setTimeout(() => {
				if (settled) return;
				console.error(`[audit/scan] ⏱ TIMEOUT — ${label} exceeded ${ms}ms, treating as failed so the response is never blocked.`);
				reject(new Error(`${label} exceeded ${ms}ms safety timeout`));
			}, ms);
		}),
	]);
}

interface SecondaryPersistCtx {
	forceRefresh: boolean;
	replaceId: string;
	sessionUserId: string | null;
	userType: DiagnosisUserType;
	actorEmail: string | null;
	userAgent: string | null;
	ipAddress: string | null;
	diagnosedAt: Date;
}

/**
 * Everything after the primary Firestore `audit_projects` save: the Firestore
 * `diagnostics` doc, the legacy Prisma `AuditLead` row (+ project sync), and — for
 * signed-in users — the durable Prisma `AuditReport` row. None of these feed the
 * response body once an `auditId` already exists (the common case, Firestore
 * configured), so `POST` fires this in the background instead of awaiting it —
 * that's what was holding the "Dashboard Ready" step for several sequential
 * Firestore/Prisma round-trips before the client ever saw a 200. It is only
 * awaited when Firestore did not already hand back an id, since Prisma AuditLead
 * is then the sole remaining source of one.
 */
async function persistSecondaryDiagnosisData(
	report: AuditReport,
	initialAuditId: string | null,
	ctx: SecondaryPersistCtx,
): Promise<string | null> {
	let auditId = initialAuditId;
	const { forceRefresh, replaceId, sessionUserId, userType, actorEmail, userAgent, ipAddress, diagnosedAt } = ctx;

	if (isFirebaseAdminConfigured()) {
		try {
			await withDeadline(
				persistDiagnosticFromReport({
					report,
					requestedBy: actorEmail,
					userId: sessionUserId,
					userType,
					replaceId: forceRefresh ? replaceId || auditId : auditId,
					auditProjectId: auditId,
					overwrite: Boolean(forceRefresh),
				}),
				PERSIST_DEADLINE_MS,
				'Firestore persistDiagnosticFromReport',
			);
		} catch (err) {
			console.error('[audit/scan] Firestore diagnostics save failed/timed out:', {
				url: report.url,
				message: errorMessage(err),
				stack: errorStack(err),
			});
		}
	}

	// Secondary: Prisma AuditLead (legacy share links / history) — best-effort
	console.log('[audit/scan][persist] Prisma AuditLead 저장 시작:', { url: report.url, forceRefresh });
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
			userId: sessionUserId,
			userType,
			userAgent,
			ipAddress,
		};

		if (forceRefresh) {
			let leadId: string | null = null;

			if (replaceId) {
				try {
					const updated = await withDeadline(
						prisma.auditLead.update({ where: { id: replaceId }, data: leadData }),
						PERSIST_DEADLINE_MS,
						'Prisma auditLead.update(replaceId)',
					);
					leadId = updated.id;
				} catch (err) {
					console.error('[audit/scan] Prisma replaceId update skipped/timed out:', {
						replaceId,
						message: errorMessage(err),
					});
					// replaceId may be a Firestore-only id — fall through to URL match / create
				}
			}

			if (!leadId && auditId) {
				try {
					const updated = await withDeadline(
						prisma.auditLead.update({ where: { id: auditId }, data: leadData }),
						PERSIST_DEADLINE_MS,
						'Prisma auditLead.update(auditId)',
					);
					leadId = updated.id;
				} catch {
					// Firestore id may not exist in Prisma yet (or the call timed out)
				}
			}

			if (!leadId) {
				const host = hostKey(report.url);
				const targetUrl = normalizeMatchUrl(report.url);
				const recent = await withDeadline(
					prisma.auditLead.findMany({
						where: { url: { contains: host } },
						orderBy: { createdAt: 'desc' },
						take: 80,
						select: { id: true, url: true },
					}),
					PERSIST_DEADLINE_MS,
					'Prisma auditLead.findMany',
				);
				const existing =
					recent.find((row) => normalizeMatchUrl(row.url) === targetUrl) ||
					recent.find((row) => hostKey(row.url) === host);
				if (existing) {
					const updated = await withDeadline(
						prisma.auditLead.update({ where: { id: existing.id }, data: leadData }),
						PERSIST_DEADLINE_MS,
						'Prisma auditLead.update(existing)',
					);
					leadId = updated.id;
				}
			}

			if (!leadId) {
				try {
					const lead = await withDeadline(
						prisma.auditLead.create({ data: auditId ? { id: auditId, ...leadData } : leadData }),
						PERSIST_DEADLINE_MS,
						'Prisma auditLead.create',
					);
					leadId = lead.id;
				} catch {
					if (auditId) {
						try {
							const updated = await withDeadline(
								prisma.auditLead.update({ where: { id: auditId }, data: leadData }),
								PERSIST_DEADLINE_MS,
								'Prisma auditLead.update(auditId fallback)',
							);
							leadId = updated.id;
						} catch {
							const lead = await withDeadline(
								prisma.auditLead.create({ data: leadData }),
								PERSIST_DEADLINE_MS,
								'Prisma auditLead.create(fallback)',
							);
							leadId = lead.id;
						}
					} else {
						const lead = await withDeadline(
							prisma.auditLead.create({ data: leadData }),
							PERSIST_DEADLINE_MS,
							'Prisma auditLead.create(no auditId)',
						);
						leadId = lead.id;
					}
				}
			}

			if (!auditId) auditId = leadId;
			await withDeadline(
				syncProjectFromAuditLead({ auditLeadId: leadId, report, userType, diagnosedAt }),
				PERSIST_DEADLINE_MS,
				'syncProjectFromAuditLead',
			).catch((err) => {
				console.error('[audit/scan] project sync failed/timed out:', errorMessage(err), errorStack(err));
				return null;
			});
		} else {
			const lead = await withDeadline(
				prisma.auditLead.create({ data: auditId ? { id: auditId, ...leadData } : leadData }),
				PERSIST_DEADLINE_MS,
				'Prisma auditLead.create(no forceRefresh)',
			);
			if (!auditId) auditId = lead.id;
			await withDeadline(
				syncProjectFromAuditLead({ auditLeadId: lead.id, report, userType, diagnosedAt }),
				PERSIST_DEADLINE_MS,
				'syncProjectFromAuditLead',
			).catch((err) => {
				console.error('[audit/scan] project sync failed/timed out:', errorMessage(err), errorStack(err));
				return null;
			});
		}
		console.log('[audit/scan][persist] Prisma AuditLead 저장 완료:', { url: report.url, auditId });
	} catch (err) {
		console.error('[audit/scan] Prisma AuditLead save failed/timed out:', {
			url: report.url,
			message: errorMessage(err),
			stack: errorStack(err),
		});
		// Lead logging is best-effort — never fail the visitor-facing report over it.
	}

	// Signed-in admin/user: persist a durable Prisma AuditReport so history
	// survives browser close and is visible after logging in elsewhere.
	if (sessionUserId) {
		try {
			const savedReport = await withDeadline(
				persistSignedInAuditReport({
					report,
					userId: sessionUserId || MASTER_ADMIN_ID,
					preferredId: auditId,
					replaceId,
				}),
				PERSIST_DEADLINE_MS,
				'persistSignedInAuditReport',
			);
			if (savedReport && !auditId) auditId = savedReport.id;
		} catch (err) {
			console.error('[audit/scan] Prisma AuditReport save failed/timed out:', {
				url: report.url,
				message: errorMessage(err),
				stack: errorStack(err),
			});
		}
	}

	return auditId;
}

async function readJwtActor(request: Request): Promise<{
	userId: string | null;
	email: string | null;
	role: string | null;
}> {
	try {
		const token = await getToken({
			req: request as unknown as NextRequest,
			secret: resolveNextAuthSecret(),
		});
		if (!token) return { userId: null, email: null, role: null };
		const userId =
			(typeof token.uid === 'string' && token.uid.trim()) ||
			(typeof token.sub === 'string' && token.sub.trim()) ||
			null;
		return {
			userId,
			email: typeof token.email === 'string' ? token.email : null,
			role: typeof token.role === 'string' ? token.role : null,
		};
	} catch (err) {
		console.error('[audit/scan] JWT lookup failed:', errorMessage(err));
		return { userId: null, email: null, role: null };
	}
}

function clientIpFromHeaders(request: Request): string | null {
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) return forwarded.split(',')[0]?.trim() || null;
	return request.headers.get('x-real-ip')?.trim() || null;
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
 * Free-plan / guest callers are capped at 3 scans per KST day (`AUDIT_LIMIT_REACHED` / 402).
 *
 * Same `targetUrl` is always recrawled (HTML meta + schema). `forceRefresh`
 * (default true) cache-busts the live crawl and overwrites the existing audit
 * row (replaceId or latest same-URL doc) instead of returning stored cache.
 */
/** Hard ceiling on Track 1/2 for the public *quick* scan (40 pages). Sized for a
 *  5–15s dashboard — well under `maxDuration=90` so persistence + background PSI
 *  still have headroom. Admin recrawl uses `fullAuditDepth: 'deep'` and does not
 *  share this deadline. If `auditSite()` is still running when this fires, the
 *  response proceeds with a degraded report. */
const TRACK_1_2_DEADLINE_MS = 16_000;
/** Hard ceiling on each individual Firestore/Prisma persistence call. */
const PERSIST_DEADLINE_MS = 5_000;

export async function POST(request: Request) {
	let rawUrl = '';
	let completedReport: AuditReport | null = null;
	const requestStartedAt = Date.now();
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
		const fullAudit = body.fullAudit !== false;
		const useDeltaCache = body.useDeltaCache !== false;
		const replaceId = typeof body.replaceId === 'string' ? body.replaceId.trim() : '';
		const hintedUserId =
			(typeof body.userId === 'string' ? body.userId.trim() : '') ||
			request.headers.get('x-redue-user-id')?.trim() ||
			'';
		const hintedRole =
			(typeof body.role === 'string' ? body.role.trim() : '') ||
			request.headers.get('x-redue-user-role')?.trim() ||
			'';

		const quota = await resolveAuditQuota();
		if (quota.exhausted) {
			const limitMessage = quota.userId
				? '오늘 무료 진단 횟수(3회)를 모두 소진했습니다. 내일 자정에 충전됩니다.'
				: '게스트 무료 진단 횟수(3회)를 모두 사용했습니다. 로그인/회원가입하면 계속 진단할 수 있습니다.';
			return noStoreJson(limitReachedPayload(quota, limitMessage), { status: 402 });
		}

		// Same protocol/Punycode normalization `auditSite` applies internally — PSI must
		// target the same absolute URL, and computing it here doesn't need the DNS lookup
		// `assertPublicHttpUrl` performs, so it's safe to do before `auditSite` resolves.
		const psiTargetUrl = (() => {
			try {
				return coerceHttpUrl(rawUrl).toString();
			} catch {
				return rawUrl;
			}
		})();

		let report: AuditReport;
		// Defaults so `scheduleTrack3Backfill` below always has real promises to await even
		// if the try block throws before either PSI fetch is fired (e.g. `deletePsiCacheForUrl`
		// throwing synchronously) — never left "used before assigned".
		let desktopPsiPromise: Promise<PageSpeedSnapshot | null> = Promise.resolve(null);
		let mobilePsiPromise: Promise<PageSpeedSnapshot | null> = Promise.resolve(null);
		const sessionPromise = getServerSession(authOptions).catch((err) => {
			console.error('[audit/scan] session lookup failed:', errorMessage(err), errorStack(err));
			return null;
		});
		const jwtActorPromise = readJwtActor(request).catch((err) => {
			console.error('[audit/scan] JWT actor read failed:', errorMessage(err), errorStack(err));
			return { userId: null, email: null, role: null };
		});
		try {
			// Track 1/2 (HTML meta + schema) is the only thing this response waits on —
			// Track 3 (PageSpeed/Lighthouse) is fired here but never awaited, so the
			// result screen can enter the dashboard in ~5-15s instead of ~45-60s. Both
			// PSI reads keep running in the background: `fetchPageSpeedDeduped` warms the
			// shared cache/in-flight map so the client's own `/api/audit/pagespeed` call
			// (fired by `useAuditReportEnrichment` once it notices `pageSpeedDesktop`/
			// `pageSpeedMobile` are missing) reuses this same read instead of duplicating
			// it, and `scheduleTrack3Backfill` (below) patches the already-persisted
			// report once they land.
			if (forceRefresh) {
				deletePsiCacheForUrl(psiTargetUrl);
			}
			const psiOpts = { forceRefresh };
			console.log('[audit/scan][Track 3] PageSpeed(CWV) 조회 시작 (백그라운드, 응답을 막지 않음):', {
				url: psiTargetUrl,
			});
			desktopPsiPromise = fetchPageSpeedDeduped(psiTargetUrl, 'desktop', psiOpts).catch((err) => {
				console.error('[audit/scan][Track 3] background PageSpeed desktop fetch failed:', {
					url: psiTargetUrl,
					error: errorMessage(err),
				});
				return null;
			});
			mobilePsiPromise = fetchPageSpeedDeduped(psiTargetUrl, 'mobile', psiOpts).catch((err) => {
				console.error('[audit/scan][Track 3] background PageSpeed mobile fetch failed:', {
					url: psiTargetUrl,
					error: errorMessage(err),
				});
				return null;
			});

			console.log('[audit/scan][Track 1-2] 크롤링 + AI/스키마 분석 시작:', { url: rawUrl, forceRefresh, fullAudit });
			const track12StartedAt = Date.now();
			report = await withDeadline(
				auditSite(rawUrl, lang, { forceRefresh, fullAudit, useDeltaCache, fullAuditDepth: 'quick' }),
				TRACK_1_2_DEADLINE_MS,
				'Track 1-2 auditSite (크롤링+분석)',
			);
			console.log('[audit/scan][Track 1-2] 크롤링 + AI/스키마 분석 완료:', {
				url: rawUrl,
				elapsedMs: Date.now() - track12StartedAt,
				score: report.score,
			});
		} catch (err) {
			const mapped = clientErrorPayload(err);
			console.error('[audit/scan][Track 1-2] auditSite 실패/타임아웃 — 200 degraded report로 대체:', {
				url: rawUrl,
				stage: mapped.stage,
				message: errorMessage(err),
				stack: errorStack(err),
			});
			if (mapped.stage === 'url') {
				return noStoreJson(
					{ error: mapped.error, stage: mapped.stage },
					{ status: mapped.status },
				);
			}
			// Auxiliary fetch / TLS / timeout must not abort the result screen —
			// return whatever on-page signals we can still score.
			report = buildDegradedAuditReport(psiTargetUrl || rawUrl, lang, err);
		}
		completedReport = report;
		const quotaIncPromise = incrementAuditUsage(quota).catch((err) => {
			console.error('[audit/scan] incrementAuditUsage failed — using prior quota snapshot:', errorMessage(err));
			return quota;
		});

		let session: Awaited<ReturnType<typeof getServerSession>> = null;
		try {
			session = await withDeadline(sessionPromise, 2_000, 'getServerSession');
		} catch (err) {
			console.error('[audit/scan] session lookup failed/timed out:', errorMessage(err), errorStack(err));
		}
		const sessionUser = (session as { user?: { id?: string; email?: string; role?: string } } | null)?.user;
		const jwtActor = await jwtActorPromise;
		const actor = resolveDiagnosisActor({
			sessionUserId: sessionUser?.id || jwtActor.userId,
			sessionEmail: sessionUser?.email || jwtActor.email,
			sessionRole: sessionUser?.role || jwtActor.role,
			quotaUserId: quota.userId,
			quotaRole: quota.role,
			hintedUserId,
			hintedRole,
		});
		const sessionUserId = actor.userId;
		const userType = actor.userType;
		const diagnosedAt = new Date();
		const userAgent = request.headers.get('user-agent') || null;
		const ipAddress = clientIpFromHeaders(request);

		let auditId: string | null = null;
		let createInput;
		try {
			createInput = buildAuditProjectCreateInput(report, {
				userType,
				userId: sessionUserId,
				userAgent,
			});
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
						overwritten = await withDeadline(
							updateAuditProject(replaceId, createInput),
							PERSIST_DEADLINE_MS,
							'Firestore updateAuditProject(replaceId)',
						);
					}
					if (!overwritten) {
						const existing = await withDeadline(
							findLatestAuditProjectByUrl(report.url),
							PERSIST_DEADLINE_MS,
							'Firestore findLatestAuditProjectByUrl',
						);
						if (existing) {
							overwritten = await withDeadline(
								updateAuditProject(existing.id, createInput),
								PERSIST_DEADLINE_MS,
								'Firestore updateAuditProject(existing)',
							);
						}
					}
					if (overwritten) {
						auditId = overwritten.id;
					} else {
						const created = await withDeadline(
							addAuditProject(createInput),
							PERSIST_DEADLINE_MS,
							'Firestore addAuditProject',
						);
						auditId = created.id;
					}
				} else {
					const created = await withDeadline(
						addAuditProject(createInput),
						PERSIST_DEADLINE_MS,
						'Firestore addAuditProject',
					);
					auditId = created.id;
				}
			} catch (err) {
				console.error('[audit/scan] Firestore audit_projects save failed/timed out:', {
					url: report.url,
					message: errorMessage(err),
					stack: errorStack(err),
				});
			}
		}

		const secondaryCtx: SecondaryPersistCtx = {
			forceRefresh,
			replaceId,
			sessionUserId,
			userType,
			actorEmail: actor.email,
			userAgent,
			ipAddress,
			diagnosedAt,
		};

		if (auditId) {
			// Firestore's primary save already produced a durable id — the Firestore
			// diagnostics doc, legacy Prisma AuditLead row, and signed-in AuditReport
			// row are all bookkeeping the response body doesn't need, so they run in
			// the background instead of blocking the "Dashboard Ready" step on 3-4
			// more sequential Firestore/Prisma round-trips.
			void persistSecondaryDiagnosisData(report, auditId, secondaryCtx).catch((err) => {
				console.error('[audit/scan] background secondary persistence failed:', errorMessage(err));
			});
		} else {
			// No id yet (Firestore not configured, or the primary save failed) — Prisma
			// AuditLead is the only remaining source of one, so this leg must be
			// awaited or the client would have nothing to route/deep-link to.
			auditId = await persistSecondaryDiagnosisData(report, auditId, secondaryCtx);
		}

		// Track 3 lands later in the background (see above) — once both strategies settle,
		// best-effort patch the persisted records so revisiting this audit doesn't need a
		// fresh Lighthouse run. Never awaited: must not delay this response.
		scheduleTrack3Backfill(report, desktopPsiPromise, mobilePsiPromise, {
			auditId,
			userType,
			sessionUserId: sessionUserId || null,
			sessionEmail: actor.email,
			userAgent,
		});

		console.log('[audit/scan][결과 조합] 최종 응답 JSON 조합 시작:', {
			url: report.url,
			auditId,
			elapsedMsSoFar: Date.now() - requestStartedAt,
		});
		const nextQuota = await withDeadline(quotaIncPromise, 2_000, 'incrementAuditUsage').catch((err) => {
			console.error('[audit/scan] incrementAuditUsage failed/timed out — using prior quota snapshot:', errorMessage(err));
			return quota;
		});
		const response = noStoreJson({
			...report,
			id: auditId,
			forceRefresh,
			quota: nextQuota,
			userId: sessionUserId,
			userType,
			diagnosedAt: diagnosedAt.toISOString(),
		});
		if (!nextQuota.unlimited) applyGuestAuditCookie(response, nextQuota.used);
		console.log('[audit/scan][결과 조합] 최종 응답 반환 (200 OK):', {
			url: report.url,
			auditId,
			totalElapsedMs: Date.now() - requestStartedAt,
		});
		return response;
	} catch (err) {
		const mapped = clientErrorPayload(err);
		console.error('[audit/scan] unhandled POST error — still returning 200 degraded report so the client never hangs:', {
			url: rawUrl || '(missing)',
			stage: mapped.stage,
			message: errorMessage(err),
			stack: errorStack(err),
			totalElapsedMs: Date.now() - requestStartedAt,
		});
		if (mapped.stage === 'url' || !rawUrl) {
			return noStoreJson({ error: mapped.error, stage: mapped.stage }, { status: mapped.status });
		}
		const fallback = completedReport || buildDegradedAuditReport(rawUrl, 'ko', err);
		return noStoreJson({
			...fallback,
			id: null,
			forceRefresh: true,
			partial: true,
		});
	}
}
