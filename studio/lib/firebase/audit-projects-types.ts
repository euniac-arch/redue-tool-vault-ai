import type { CrawledPageMeta } from '@/lib/audit/crawl-page-metas';
import { countAuditDefects } from '@/lib/audit/latest-audit-payload';
import { preferProjectName, resolveProjectSiteName } from '@/lib/audit/project-site-name';
import type { AuditReport } from '@/lib/site-auditor';
import { toSolveCmsDisplay } from '@/lib/solve/types';

export const AUDIT_PROJECTS_COLLECTION = 'audit_projects';
/** Subcollection under each `audit_projects/{id}` doc holding the heavy per-subpage
 * crawl detail (see `splitAuditProjectPayload`) that is kept out of the main doc so
 * it never trips Firestore's 1MB-per-document limit on sites with 200+ subpages. */
export const AUDIT_PROJECT_PAGE_DETAILS_SUBCOLLECTION = 'pageDetails';
export const AUDIT_PROJECT_PAGE_DETAILS_DOC_ID = 'main';

/** Structured payload stored under `auditPayload` on each Firestore doc. */
export interface AuditProjectPayload {
	report: AuditReport;
	/** Failed / warning checks (defect list). */
	issues: Array<{
		id: string;
		label: string;
		status: string;
		categoryId?: string;
		evidence?: string;
		why?: string;
		impact?: string;
	}>;
	/** Full checklist (~23 items) with pass/fail/warning. */
	checklist: Array<{
		id: string;
		label: string;
		status: string;
		passed: boolean;
		categoryId?: string;
		evidence?: string;
	}>;
	/** H1 / Meta / Schema specs for solve + CMS code binding. */
	specs: {
		h1: { count: number; texts: string[] };
		meta: {
			pageTitle: string;
			metaDescription: string;
			titleLength: number;
			metaDescriptionLength: number;
		};
		schema: {
			coverage: number;
			types: string[];
			jsonLdBlockCount: number;
		};
	};
	cmsType?: string;
	/** Shared representative bind from 3-step footer → greeting → doctor search. */
	ceo_name?: string;
}

/** Diagnosing party captured at scan time. */
export type DiagnosisUserType = 'admin' | 'user' | 'guest';

/** Public "도입 사례 (Case Studies)" listing type: real client proof vs. an
 *  industry simulation model. Mirrors `CaseStudyKind` in `lib/case-study-types.ts`. */
export type CaseStudyType = 'verified' | 'simulation';

export interface AuditProjectDoc {
	id: string;
	url: string;
	/** Official Hangul/brand site name; hostname only as last-resort fallback. */
	siteName: string;
	score: number;
	issueCount: number;
	auditPayload: AuditProjectPayload;
	createdAt: string;
	/** Who ran this diagnosis: 'admin' | 'user' | 'guest'. Defaults to 'guest' for legacy docs. */
	userType: DiagnosisUserType;
	/** Signed-in user id, or null for guests. */
	userId: string | null;
	/** Optional: guest fingerprinting / abuse prevention. */
	userAgent?: string | null;
	/** Admin-controlled public "도입 사례" exposure toggle. Defaults to false for legacy docs. */
	isCaseStudy: boolean;
	/** "verified" | "simulation". Null while isCaseStudy is false. */
	caseStudyType: CaseStudyType | null;
	/** Admin-authored pre-optimization Before scores for case-study cards. */
	customBaseline?: {
		overall: number;
		seo?: number | null;
		performance?: number | null;
		schema?: number | null;
		geo?: number | null;
	} | null;
}

export interface AuditProjectCreateInput {
	url: string;
	siteName: string;
	score: number;
	issueCount: number;
	auditPayload: AuditProjectPayload;
	userType: DiagnosisUserType;
	userId: string | null;
	userAgent?: string | null;
}

function buildChecklist(report: AuditReport) {
	const fromCats =
		report.categories?.flatMap((cat) =>
			(cat.checks || []).map((c) => ({
				id: c.id,
				label: c.label,
				status: c.status || (c.passed ? 'pass' : 'fail'),
				passed: Boolean(c.passed || c.status === 'pass'),
				categoryId: cat.id,
				evidence: c.evidence,
			})),
		) ?? [];

	if (fromCats.length > 0) return fromCats;

	return (report.checklist || []).map((c) => ({
		id: c.id,
		label: c.label,
		status: c.status || (c.passed ? 'pass' : 'fail'),
		passed: Boolean(c.passed || c.status === 'pass'),
		evidence: c.evidence,
	}));
}

function buildIssues(report: AuditReport) {
	const out: AuditProjectPayload['issues'] = [];
	for (const cat of report.categories || []) {
		for (const check of cat.checks || []) {
			if (check.status === 'pass' || check.passed) continue;
			out.push({
				id: check.id,
				label: check.label,
				status: check.status || 'fail',
				categoryId: cat.id,
				evidence: check.evidence,
				why: check.why,
				impact: check.impact,
			});
		}
	}
	if (out.length === 0) {
		for (const check of report.checklist || []) {
			if (check.status === 'pass' || check.passed) continue;
			out.push({
				id: check.id,
				label: check.label,
				status: check.status || 'fail',
				evidence: check.evidence,
				why: check.why,
				impact: check.impact,
			});
		}
	}
	return out;
}

/** Build the Firestore `auditPayload` map from a live AuditReport. */
export function buildAuditProjectPayload(
	report: AuditReport,
	opts?: { cmsType?: string },
): AuditProjectPayload {
	return {
		report,
		issues: buildIssues(report),
		checklist: buildChecklist(report),
		specs: {
			h1: {
				count: report.metrics?.h1Count ?? report.metrics?.h1Texts?.length ?? 0,
				texts: report.metrics?.h1Texts ?? [],
			},
			meta: {
				pageTitle: report.metrics?.pageTitle || '',
				metaDescription: report.metrics?.metaDescription || '',
				titleLength: report.metrics?.titleLength ?? 0,
				metaDescriptionLength: report.metrics?.metaDescriptionLength ?? 0,
			},
			schema: {
				coverage: typeof report.schemaCoverage === 'number' ? report.schemaCoverage : 0,
				types: report.metrics?.schemaTypes ?? [],
				jsonLdBlockCount: report.metrics?.jsonLdBlockCount ?? 0,
			},
		},
		cmsType: opts?.cmsType || (report.cmsType ? toSolveCmsDisplay(report.cmsType) : undefined),
		ceo_name:
			report.siteMeta?.ceoName ||
			report.ceoName ||
			report.siteMeta?.representativeName ||
			'대표원장',
	};
}

export function buildAuditProjectCreateInput(
	report: AuditReport,
	opts?: {
		cmsType?: string;
		userType?: DiagnosisUserType;
		userId?: string | null;
		userAgent?: string | null;
	},
): AuditProjectCreateInput {
	const auditPayload = buildAuditProjectPayload(report, opts);
	return {
		url: report.url,
		siteName: resolveProjectSiteName(report),
		score: Math.round(report.score),
		issueCount: countAuditDefects(report),
		auditPayload,
		userType: opts?.userType || 'guest',
		userId: opts?.userId ?? null,
		userAgent: opts?.userAgent ?? null,
	};
}

export function createdAtToIso(value: unknown): string {
	if (!value) return new Date().toISOString();
	if (typeof value === 'string') return value;
	if (value instanceof Date) return value.toISOString();
	const ts = value as { toDate?: () => Date; seconds?: number };
	if (typeof ts?.toDate === 'function') return ts.toDate().toISOString();
	if (typeof ts.seconds === 'number') {
		return new Date(ts.seconds * 1000).toISOString();
	}
	return new Date().toISOString();
}

export function mapAuditProjectDoc(
	id: string,
	data: Record<string, unknown>,
): AuditProjectDoc | null {
	const auditPayload = data.auditPayload as AuditProjectPayload | undefined;
	const url =
		(typeof data.url === 'string' && data.url) ||
		(typeof auditPayload?.report?.url === 'string' && auditPayload.report.url) ||
		'';
	if (!url) return null;
	if (!auditPayload?.report?.url) return null;

	const rawUserType = typeof data.userType === 'string' ? data.userType.trim().toLowerCase() : '';
	const userType: DiagnosisUserType =
		rawUserType === 'admin' || rawUserType === 'user' || rawUserType === 'guest'
			? rawUserType
			: 'guest';

	const storedName = typeof data.siteName === 'string' ? data.siteName.trim() : '';
	const siteName = preferProjectName(
		storedName,
		resolveProjectSiteName(auditPayload.report),
		url,
	);

	const rawCaseStudyType = typeof data.caseStudyType === 'string' ? data.caseStudyType.trim() : '';
	const caseStudyType: CaseStudyType | null =
		rawCaseStudyType === 'verified' || rawCaseStudyType === 'simulation' ? rawCaseStudyType : null;

	return {
		id,
		url,
		siteName,
		score: typeof data.score === 'number' ? data.score : Math.round(auditPayload.report.score),
		issueCount:
			typeof data.issueCount === 'number'
				? data.issueCount
				: countAuditDefects(auditPayload.report),
		auditPayload,
		createdAt: createdAtToIso(data.createdAt),
		userType,
		userId: typeof data.userId === 'string' ? data.userId : null,
		userAgent: typeof data.userAgent === 'string' ? data.userAgent : null,
		isCaseStudy: Boolean(data.isCaseStudy) && caseStudyType != null,
		caseStudyType,
		customBaseline: parseStoredCustomBaseline(data.customBaseline ?? data.custom_baseline),
	};
}

function parseStoredCustomBaseline(
	raw: unknown,
): AuditProjectDoc['customBaseline'] {
	if (typeof raw === 'string') {
		try {
			raw = JSON.parse(raw);
		} catch {
			return null;
		}
	}
	if (!raw || typeof raw !== 'object') return null;
	const row = raw as Record<string, unknown>;
	const overall = typeof row.overall === 'number' && Number.isFinite(row.overall) ? Math.round(row.overall) : null;
	if (overall == null || overall < 0 || overall > 100) return null;
	const asScore = (value: unknown) =>
		typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
			? Math.round(value)
			: null;
	return {
		overall,
		seo: asScore(row.seo),
		performance: asScore(row.performance ?? row.cwv),
		schema: asScore(row.schema),
		geo: asScore(row.geo ?? row.eeat),
	};
}

/** Strip `undefined` so Firestore accepts the object. */
export function stripUndefinedDeep<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

/** Heavy per-subpage crawl detail, split out of the main `audit_projects` doc. */
export interface AuditProjectPageDetails {
	pageMetas: CrawledPageMeta[];
}

/** Hard ceilings so the `pageDetails` subcollection doc always stays well under
 *  Firestore's 1MB-per-document limit, even for sites with hundreds of subpages. */
const MAX_STORED_PAGE_METAS = 300;
const MAX_ITEMS_PER_PAGE_LIST = 25;
const MAX_HEADING_SKIP_EXAMPLES = 5;
const MAX_COLLECTED_URLS = 500;

/** Drop/cap the sub-arrays that make a single subpage crawl row heavy. `imageSrcs`
 *  is only needed transiently (sitewide alt-coverage math during the live crawl) —
 *  never read back from a persisted doc — so it is dropped entirely on write. */
function shrinkPageMeta(page: CrawledPageMeta): CrawledPageMeta {
	return {
		...page,
		imageAltIssues: page.imageAltIssues?.slice(0, MAX_ITEMS_PER_PAGE_LIST),
		missing_images: page.missing_images?.slice(0, MAX_ITEMS_PER_PAGE_LIST),
		renderBlockingScriptItems: page.renderBlockingScriptItems?.slice(0, MAX_ITEMS_PER_PAGE_LIST),
		headingSkipExamples: page.headingSkipExamples?.slice(0, MAX_HEADING_SKIP_EXAMPLES),
		imageSrcs: undefined,
	};
}

/** Pages with detected issues are what Solve / checklist evidence actually surfaces —
 *  keep those first when a site has more subpages than `MAX_STORED_PAGE_METAS`. */
function prioritizePageMetas(pages: CrawledPageMeta[]): CrawledPageMeta[] {
	const withIssues: CrawledPageMeta[] = [];
	const rest: CrawledPageMeta[] = [];
	for (const page of pages) {
		(page.missingAlt || page.headingSkipDetected ? withIssues : rest).push(page);
	}
	return [...withIssues, ...rest];
}

/**
 * Split a live `AuditProjectPayload` into:
 *  - `corePayload` — scores, metadata, checklist/findings/categories, top-level
 *    metrics — sized to fit comfortably inside the `audit_projects` 1MB document.
 *  - `pageDetails` — the heavy per-subpage crawl result (200+ pages on larger
 *    sites, each carrying alt/heading/script-issue arrays), stored instead in the
 *    `pageDetails` subcollection (see `AUDIT_PROJECT_PAGE_DETAILS_SUBCOLLECTION`).
 * Both sides are capped defensively so neither can ever exceed Firestore's
 * per-document size limit, regardless of how many subpages a site has.
 */
export function splitAuditProjectPayload(payload: AuditProjectPayload): {
	corePayload: AuditProjectPayload;
	pageDetails: AuditProjectPageDetails;
} {
	const rawPageMetas = payload.report.pageMetas || [];
	const pageMetas = prioritizePageMetas(rawPageMetas)
		.slice(0, MAX_STORED_PAGE_METAS)
		.map(shrinkPageMeta);

	const corePayload: AuditProjectPayload = {
		...payload,
		report: {
			...payload.report,
			// Detailed subpage crawl data lives in the `pageDetails` subcollection —
			// excluding it here is what keeps the main doc under Firestore's 1MB cap.
			pageMetas: [],
			collectedUrls: (payload.report.collectedUrls || []).slice(0, MAX_COLLECTED_URLS),
		},
	};

	return { corePayload, pageDetails: { pageMetas } };
}

/**
 * Re-attach subpage detail (see `splitAuditProjectPayload`) fetched from the
 * `pageDetails` subcollection back onto a mapped `AuditProjectDoc`, so downstream
 * consumers (Solve workspace, checklist evidence, etc.) see the same report shape
 * they always have — none of them need to know the data was split for storage.
 */
export function mergeAuditProjectPageDetails(
	doc: AuditProjectDoc,
	pageDetails: AuditProjectPageDetails | null | undefined,
): AuditProjectDoc {
	if (!pageDetails?.pageMetas?.length) return doc;
	return {
		...doc,
		auditPayload: {
			...doc.auditPayload,
			report: {
				...doc.auditPayload.report,
				pageMetas: pageDetails.pageMetas,
			},
		},
	};
}
