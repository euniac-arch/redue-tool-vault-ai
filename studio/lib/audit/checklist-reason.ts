import type { AuditCheckStatus } from '@/lib/site-auditor';

export type ChecklistReasonKind = 'pass' | 'warn' | 'fail';

const PASS_REASON_RE = /통과|충족|합격|meets the|passed|not required|필수 항목이 아니|N\/A —/i;
const PENALTY_REASON_RE =
	/감점|불리|미흡|없으면|누락|떨어뜨립|악화|차단|분산|치명적|불가능|약화|깨져|의존|fail|missing|without /i;

export function resolveCheckStatus(
	status: AuditCheckStatus | undefined,
	passed?: boolean,
): AuditCheckStatus {
	return status ?? (passed ? 'pass' : 'fail');
}

export function checklistReasonKind(
	status: AuditCheckStatus | undefined,
	passed?: boolean,
): ChecklistReasonKind {
	const resolved = resolveCheckStatus(status, passed);
	if (resolved === 'pass') return 'pass';
	if (resolved === 'warning') return 'warn';
	return 'fail';
}

/** True when stored `why` is already a pass rationale, not a leftover penalty line. */
export function isPassReasonText(why: string | undefined): boolean {
	if (!why?.trim()) return false;
	if (PENALTY_REASON_RE.test(why) && !PASS_REASON_RE.test(why)) return false;
	return PASS_REASON_RE.test(why);
}

/**
 * Pass items must never show leftover “why you lost points” copy from stored reports.
 * Warn/Fail keep the stored defect/caution reason.
 */
export function resolveChecklistReasonText(
	status: AuditCheckStatus | undefined,
	passed: boolean | undefined,
	storedWhy: string | undefined,
	passFallback: string,
): string | undefined {
	const kind = checklistReasonKind(status, passed);
	if (kind === 'pass') {
		return isPassReasonText(storedWhy) ? storedWhy : passFallback;
	}
	return storedWhy;
}
