import type { AuditReport } from '@/lib/site-auditor';

/** Canonical localStorage key for the most recent live audit handoff. */
export const LATEST_AUDIT_PAYLOAD_KEY = 'latest_audit_payload';

export interface LatestAuditPayload {
	auditId: string | null;
	report: AuditReport;
	cmsType?: string;
	/** Defect / non-pass check count at save time */
	defectCount: number;
	score: number;
	maxScore: number;
	savedAt: string;
}

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

export function countAuditDefects(report: AuditReport): number {
	const checks = report.checklist?.length
		? report.checklist
		: report.categories?.flatMap((c) => c.checks) ?? [];
	return checks.filter((c) => {
		if (c.status) return c.status !== 'pass';
		return !c.passed;
	}).length;
}

export function buildLatestAuditPayload(
	report: AuditReport,
	opts?: { auditId?: string | null; cmsType?: string },
): LatestAuditPayload {
	return {
		auditId: opts?.auditId ?? null,
		report,
		cmsType: opts?.cmsType,
		defectCount: countAuditDefects(report),
		score: Math.round(report.score),
		maxScore: report.maxScore,
		savedAt: new Date().toISOString(),
	};
}

/** Persist the live audit JSON for /admin/solve hydration and project archiving. */
export function saveLatestAuditPayload(
	report: AuditReport,
	opts?: { auditId?: string | null; cmsType?: string },
): LatestAuditPayload | null {
	if (!isBrowser() || !report?.url) return null;
	const body = buildLatestAuditPayload(report, opts);
	try {
		window.localStorage.setItem(LATEST_AUDIT_PAYLOAD_KEY, JSON.stringify(body));
		window.dispatchEvent(new CustomEvent('redue:latest-audit', { detail: body }));
		return body;
	} catch {
		return body;
	}
}

export function loadLatestAuditPayload(): LatestAuditPayload | null {
	if (!isBrowser()) return null;
	try {
		const raw = window.localStorage.getItem(LATEST_AUDIT_PAYLOAD_KEY);
		if (!raw) return null;
		const data = JSON.parse(raw) as LatestAuditPayload;
		if (!data?.report?.url) return null;
		return data;
	} catch {
		return null;
	}
}

export function clearLatestAuditPayload(): void {
	if (!isBrowser()) return;
	try {
		window.localStorage.removeItem(LATEST_AUDIT_PAYLOAD_KEY);
	} catch {
		// ignore
	}
}
