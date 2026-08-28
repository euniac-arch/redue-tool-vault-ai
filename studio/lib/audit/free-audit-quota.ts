export const FREE_AUDIT_LIMIT = 3;
export const SEO_AUDIT_COUNT_KEY = 'seo_audit_count_v2';
export const SEO_AUDIT_COOKIE = 'seo_audit_count_v2';
const LEGACY_SEO_AUDIT_COUNT_KEY = 'seo_audit_count';
export const AUDIT_LIMIT_CODE = 'AUDIT_LIMIT_REACHED';
export const AUDIT_QUOTA_TIMEZONE = 'Asia/Seoul';

export type AuditQuotaSnapshot = {
	used: number;
	remaining: number;
	limit: number;
	date: string;
	unlimited: boolean;
	exhausted: boolean;
};

export function todayStamp(now = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: AUDIT_QUOTA_TIMEZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(now);
}

export function isUnlimitedAuditAccess(planId?: string | null, role?: string | null): boolean {
	if ((role || '').trim().toUpperCase() === 'ADMIN') return true;
	return planId === 'pro' || planId === 'agency';
}

export function buildAuditQuota(usedRaw: number, unlimited = false, date = todayStamp()): AuditQuotaSnapshot {
	if (unlimited) {
		return {
			used: usedRaw,
			remaining: Number.POSITIVE_INFINITY,
			limit: FREE_AUDIT_LIMIT,
			date,
			unlimited: true,
			exhausted: false,
		};
	}
	const used = Math.max(0, Math.min(FREE_AUDIT_LIMIT, Math.floor(usedRaw) || 0));
	const remaining = Math.max(0, FREE_AUDIT_LIMIT - used);
	return { used, remaining, limit: FREE_AUDIT_LIMIT, date, unlimited: false, exhausted: remaining <= 0 };
}

/**
 * Guest (logged-out visitor) audits are capped at `FREE_AUDIT_LIMIT` for the lifetime of the
 * browser/cookie — no daily reset. This is intentional: the cap exists to push anonymous
 * visitors toward creating an account, not to give them a fresh 3 scans every midnight.
 */
export function parseGuestAuditCount(raw: string | null | undefined): number {
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? Math.max(0, Math.min(FREE_AUDIT_LIMIT, Math.floor(parsed))) : 0;
}

export function serializeGuestAuditCount(count: number): string {
	return String(Math.max(0, Math.min(FREE_AUDIT_LIMIT, Math.floor(count) || 0)));
}

export function readGuestAuditCount(): number {
	if (typeof window === 'undefined') return 0;
	try {
		return parseGuestAuditCount(window.localStorage.getItem(SEO_AUDIT_COUNT_KEY));
	} catch {
		return 0;
	}
}

export function writeGuestAuditCount(used: number): void {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(SEO_AUDIT_COUNT_KEY, serializeGuestAuditCount(used));
		window.localStorage.removeItem(LEGACY_SEO_AUDIT_COUNT_KEY);
	} catch {
		// private mode / quota
	}
}

/** Clears the browser-side guest counter so a quota reset is visible immediately. */
export function resetGuestAuditCount(): void {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(SEO_AUDIT_COUNT_KEY, serializeGuestAuditCount(0));
		window.localStorage.removeItem(LEGACY_SEO_AUDIT_COUNT_KEY);
	} catch {
		// private mode / quota
	}
}

export function incrementGuestAuditCount(): number {
	const next = Math.min(FREE_AUDIT_LIMIT, readGuestAuditCount() + 1);
	writeGuestAuditCount(next);
	return next;
}

export function getGuestRemainingAudits(): number {
	return Math.max(0, FREE_AUDIT_LIMIT - readGuestAuditCount());
}

export class AuditLimitError extends Error {
	readonly code = AUDIT_LIMIT_CODE;
	readonly quota: AuditQuotaSnapshot;

	constructor(message: string, quota?: Partial<AuditQuotaSnapshot>) {
		super(message);
		this.name = 'AuditLimitError';
		this.quota = buildAuditQuota(quota?.used ?? FREE_AUDIT_LIMIT, quota?.unlimited === true, quota?.date);
	}
}

export function isAuditLimitError(err: unknown): err is AuditLimitError {
	return err instanceof AuditLimitError || (err instanceof Error && (err as { code?: string }).code === AUDIT_LIMIT_CODE);
}
