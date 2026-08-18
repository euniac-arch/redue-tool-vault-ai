import { countCheckVerdicts, normalizeChecklistItems } from '@/lib/audit/onpage-diagnostic';
import type { AuditReport } from '@/lib/site-auditor';

/** Canonical localStorage key for the most recent live audit handoff. */
export const LATEST_AUDIT_PAYLOAD_KEY = 'latest_audit_payload';

export interface LatestAuditPayload {
	auditId: string | null;
	report: AuditReport;
	cmsType?: string;
	/** Fail-only defect count at save time (warnings are excluded). */
	defectCount: number;
	score: number;
	maxScore: number;
	savedAt: string;
}

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

/** Fail-only count from the same remapped checklist the 5-category cards use. */
export function countAuditVerdicts(report: AuditReport): { defectCount: number; warningCount: number } {
	const remapped = normalizeChecklistItems(report);
	if (remapped.length) return countCheckVerdicts(remapped);
	const checks = report.checklist?.length
		? report.checklist
		: report.categories?.flatMap((c) => c.checks) ?? [];
	return countCheckVerdicts(checks);
}

/** Fail rows only — warnings stay in `countAuditWarnings`. */
export function countAuditDefects(report: AuditReport): number {
	return countAuditVerdicts(report).defectCount;
}

export function countAuditWarnings(report: AuditReport): number {
	return countAuditVerdicts(report).warningCount;
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
		score: Number.isFinite(report.score) ? Math.round(Number(report.score) * 10) / 10 : 0,
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
