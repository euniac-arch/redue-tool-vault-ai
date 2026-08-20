export const FREE_AUDIT_LIMIT = 3;
export const SEO_AUDIT_COUNT_KEY = 'seo_audit_count';
export const SEO_AUDIT_COOKIE = 'seo_audit_count';
export const AUDIT_LIMIT_CODE = 'AUDIT_LIMIT_REACHED';
export const AUDIT_QUOTA_TIMEZONE = 'Asia/Seoul';

export type GuestDailyAuditCount = {
	date: string;
	count: number;
};

export type AuditQuotaSnapshot = {
	used: number;
	remaining: number;
	limit: number;
	date: string;
	unlimited: boolean;
	devMode: boolean;
	exhausted: boolean;
};

/** Local `next dev` is unlimited. Vercel / production keeps the daily 3-scan cap. */
export function isDevUnlimitedAuditQuota(): boolean {
	const flag = (process.env.NEXT_PUBLIC_FREE_AUDIT_UNLIMITED || '').trim().toLowerCase();
	if (flag === '1' || flag === 'true') return true;
	if (flag === '0' || flag === 'false') return false;
	return process.env.NODE_ENV === 'development' && !process.env.VERCEL;
}

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
	devMode = false,
): AuditQuotaSnapshot {
	if (unlimited || devMode) {
		return {
			used: usedRaw,
			remaining: Number.POSITIVE_INFINITY,
			limit: FREE_AUDIT_LIMIT,
			date,
			unlimited: true,
			devMode,
			exhausted: false,
		};
	}
	const used = Math.max(0, Math.min(FREE_AUDIT_LIMIT, Math.floor(usedRaw) || 0));
	const remaining = Math.max(0, FREE_AUDIT_LIMIT - used);
	return { used, remaining, limit: FREE_AUDIT_LIMIT, date, unlimited: false, devMode: false, exhausted: remaining <= 0 };
}

export function emptyDailyCount(date = todayStamp()): GuestDailyAuditCount {
	return { date, count: 0 };
}

export function parseGuestDailyCount(raw: string | null | undefined, date = todayStamp()): GuestDailyAuditCount {
	if (!raw) return emptyDailyCount(date);
	try {
		const parsed = JSON.parse(raw) as Partial<GuestDailyAuditCount>;
		if (parsed && typeof parsed === 'object' && typeof parsed.date === 'string') {
			const count = Math.max(0, Math.floor(Number(parsed.count) || 0));
			if (parsed.date !== date) return emptyDailyCount(date);
			return { date, count: Math.min(FREE_AUDIT_LIMIT, count) };
		}
	} catch {
		// legacy lifetime integer — start a fresh daily window
	}
	return emptyDailyCount(date);
}

export function serializeGuestDailyCount(value: GuestDailyAuditCount): string {
	return JSON.stringify({ date: value.date, count: value.count });
}

export function readGuestAuditCount(): number {
	return readGuestDailyCount().count;
}

export function readGuestDailyCount(): GuestDailyAuditCount {
	if (typeof window === 'undefined') return emptyDailyCount();
	try {
		const today = todayStamp();
		const next = parseGuestDailyCount(window.localStorage.getItem(SEO_AUDIT_COUNT_KEY), today);
		if (next.date === today) {
			window.localStorage.setItem(SEO_AUDIT_COUNT_KEY, serializeGuestDailyCount(next));
		}
		return next;
	} catch {
		return emptyDailyCount();
	}
}

export function writeGuestAuditCount(used: number, date = todayStamp()): void {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(
			SEO_AUDIT_COUNT_KEY,
			serializeGuestDailyCount({ date, count: Math.max(0, Math.floor(used) || 0) }),
		);
	} catch {
		// private mode / quota
	}
}

export function incrementGuestAuditCount(): number {
	const today = todayStamp();
	const current = readGuestDailyCount();
	const next = Math.min(FREE_AUDIT_LIMIT, (current.date === today ? current.count : 0) + 1);
	writeGuestAuditCount(next, today);
	return next;
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
