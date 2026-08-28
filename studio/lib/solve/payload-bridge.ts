import type { AuditReport } from '@/lib/site-auditor';
import { loadLatestAuditPayload } from '@/lib/audit/latest-audit-payload';

export const SOLVE_PAYLOAD_STORAGE_KEY = 'redue_solve_audit_payload';

export interface SolveTransferPayload {
	auditId: string | null;
	report: AuditReport;
	cmsType?: string;
	savedAt: string;
}

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

/** Read and optionally clear the stashed session payload. */
export function takeSolvePayload(opts?: { clear?: boolean }): SolveTransferPayload | null {
	if (!isBrowser()) return null;
	try {
		const raw = sessionStorage.getItem(SOLVE_PAYLOAD_STORAGE_KEY);
		if (!raw) return null;
		if (opts?.clear !== false) {
			sessionStorage.removeItem(SOLVE_PAYLOAD_STORAGE_KEY);
		}
		const data = JSON.parse(raw) as SolveTransferPayload;
		if (!data?.report?.url) return null;
		return data;
	} catch {
		return null;
	}
}

export function peekSolvePayload(): SolveTransferPayload | null {
	return takeSolvePayload({ clear: false });
}

/**
 * Resolve the best available client-side audit for /admin/solve hydration:
 * 1) leftover session transfer, if present
 * 2) durable localStorage `latest_audit_payload`
 */
export function resolveClientSolveTransfer(opts?: {
	clearSession?: boolean;
}): SolveTransferPayload | null {
	const fromSession = takeSolvePayload({ clear: opts?.clearSession !== false });
	if (fromSession?.report?.url) return fromSession;

	const latest = loadLatestAuditPayload();
	if (!latest?.report?.url) return null;
	return {
		auditId: latest.auditId,
		report: latest.report,
		cmsType: latest.cmsType,
		savedAt: latest.savedAt,
	};
}
