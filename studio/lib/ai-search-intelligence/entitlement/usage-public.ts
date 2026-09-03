/** Client-safe monthly quota. No usageKey, provider internals, or persist I/O. */

export type PublicAsiAccountUsage = {
	queriesUsed: number;
	queriesLimit: number | null;
	remaining: number | null;
	estimated: true;
};

export const PUBLIC_ASI_ACCOUNT_USAGE_KEYS = ['estimated', 'queriesLimit', 'queriesUsed', 'remaining'] as const;

export const ASI_ACCOUNT_USAGE_EVENT = 'asi-account-usage';

export function asiQuotaRemaining(used: number, limit: number): number | null {
	if (!Number.isFinite(limit)) return null;
	return Math.max(0, Math.floor(limit - used));
}

export function toPublicAsiAccountUsage(input: { queriesUsed: number; queriesLimit: number }): PublicAsiAccountUsage {
	const unlimited = !Number.isFinite(input.queriesLimit);
	return {
		queriesUsed: input.queriesUsed,
		queriesLimit: unlimited ? null : input.queriesLimit,
		remaining: unlimited ? null : asiQuotaRemaining(input.queriesUsed, input.queriesLimit),
		estimated: true,
	};
}

export function isPublicAsiAccountUsage(value: unknown): value is PublicAsiAccountUsage {
	if (!value || typeof value !== 'object') return false;
	const row = value as PublicAsiAccountUsage;
	return (
		row.estimated === true &&
		typeof row.queriesUsed === 'number' &&
		(row.queriesLimit === null || typeof row.queriesLimit === 'number') &&
		(row.remaining === null || typeof row.remaining === 'number')
	);
}

export function publishAsiAccountUsage(usage: PublicAsiAccountUsage) {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent(ASI_ACCOUNT_USAGE_EVENT, { detail: usage }));
}
