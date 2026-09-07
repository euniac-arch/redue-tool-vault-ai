export const GUEST_MAX_COUNT = 2;
export const USER_FREE_CREDITS = 5;
/** @deprecated Prefer GUEST_MAX_COUNT (guest) or USER_FREE_CREDITS (member). */
export const FREE_AUDIT_LIMIT = GUEST_MAX_COUNT;
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

export function buildAuditQuota(
	usedRaw: number,
	unlimited = false,
	date = todayStamp(),
	limit = GUEST_MAX_COUNT,
): AuditQuotaSnapshot {
	const safeLimit = Math.max(0, Math.floor(limit) || 0);
	if (unlimited) {
		return {
			used: usedRaw,
			remaining: Number.POSITIVE_INFINITY,
			limit: safeLimit,
			date,
			unlimited: true,
			exhausted: false,
		};
	}
	const used = Math.max(0, Math.min(safeLimit, Math.floor(usedRaw) || 0));
	const remaining = Math.max(0, safeLimit - used);
	return { used, remaining, limit: safeLimit, date, unlimited: false, exhausted: remaining <= 0 };
}

/**
 * Guest (logged-out visitor) audits are capped at `GUEST_MAX_COUNT` for the lifetime of the
 * browser/cookie — no daily reset. This is intentional: the cap exists to push anonymous
 * visitors toward creating an account, not to give them a fresh 2 scans every midnight.
 */
export function parseGuestAuditCount(raw: string | null | undefined): number {
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? Math.max(0, Math.min(GUEST_MAX_COUNT, Math.floor(parsed))) : 0;
}

export function serializeGuestAuditCount(count: number): string {
	return String(Math.max(0, Math.min(GUEST_MAX_COUNT, Math.floor(count) || 0)));
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
	const next = Math.min(GUEST_MAX_COUNT, readGuestAuditCount() + 1);
	writeGuestAuditCount(next);
	return next;
}

export function getGuestRemainingAudits(): number {
	return Math.max(0, GUEST_MAX_COUNT - readGuestAuditCount());
}

export class AuditLimitError extends Error {
	readonly code = AUDIT_LIMIT_CODE;
	readonly quota: AuditQuotaSnapshot;

	constructor(message: string, quota?: Partial<AuditQuotaSnapshot>) {
		super(message);
		this.name = 'AuditLimitError';
		this.quota = buildAuditQuota(
			quota?.used ?? GUEST_MAX_COUNT,
			quota?.unlimited === true,
			quota?.date,
			quota?.limit ?? GUEST_MAX_COUNT,
		);
	}
}

export function isAuditLimitError(err: unknown): err is AuditLimitError {
	return err instanceof AuditLimitError || (err instanceof Error && (err as { code?: string }).code === AUDIT_LIMIT_CODE);
}
