import { countAuditDefects } from '@/lib/audit/latest-audit-payload';
import type { AuditReport } from '@/lib/site-auditor';

export const AUDIT_PROJECTS_COLLECTION = 'audit_projects';

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
	/** Full checklist (~22 items) with pass/fail/warning. */
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
}

export interface AuditProjectDoc {
	id: string;
	url: string;
	score: number;
	issueCount: number;
	auditPayload: AuditProjectPayload;
	createdAt: string;
}

export interface AuditProjectCreateInput {
	url: string;
	score: number;
	issueCount: number;
	auditPayload: AuditProjectPayload;
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
		cmsType: opts?.cmsType,
	};
}

export function buildAuditProjectCreateInput(
	report: AuditReport,
	opts?: { cmsType?: string },
): AuditProjectCreateInput {
	const auditPayload = buildAuditProjectPayload(report, opts);
	return {
		url: report.url,
		score: Math.round(report.score),
		issueCount: countAuditDefects(report),
		auditPayload,
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
	const url = typeof data.url === 'string' ? data.url : '';
	if (!url) return null;
	const auditPayload = data.auditPayload as AuditProjectPayload | undefined;
	if (!auditPayload?.report?.url) return null;

	return {
		id,
		url,
		score: typeof data.score === 'number' ? data.score : Math.round(auditPayload.report.score),
		issueCount:
			typeof data.issueCount === 'number'
				? data.issueCount
				: countAuditDefects(auditPayload.report),
		auditPayload,
		createdAt: createdAtToIso(data.createdAt),
	};
}

/** Strip `undefined` so Firestore accepts the object. */
export function stripUndefinedDeep<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}
