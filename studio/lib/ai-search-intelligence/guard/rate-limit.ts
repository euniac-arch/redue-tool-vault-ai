import { AsiServiceError } from '@/lib/ai-search-intelligence/api/errors';
import { ASI_GUARD } from '@/lib/ai-search-intelligence/guard/limits';

type Bucket = number[];

const WINDOWS = new Map<string, Bucket>();

function prune(bucket: Bucket, now: number, windowMs: number): Bucket {
	return bucket.filter((ts) => now - ts < windowMs);
}

export function clearAsiRateLimits() {
	WINDOWS.clear();
}

export function takeAsiRateLimit(
	key: string,
	limit: number,
	windowMs: number,
	now = Date.now(),
): { ok: true; remaining: number } | { ok: false; retryAfterSec: number } {
	const next = prune(WINDOWS.get(key) ?? [], now, windowMs);
	if (next.length >= limit) {
		const oldest = next[0] ?? now;
		WINDOWS.set(key, next);
		return { ok: false, retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)) };
	}
	next.push(now);
	WINDOWS.set(key, next);
	return { ok: true, remaining: Math.max(0, limit - next.length) };
}

export function consumeAsiHttpRateLimit(clientKey: string, now = Date.now()) {
	const result = takeAsiRateLimit(`http:${clientKey}`, ASI_GUARD.httpPerMinute, 60_000, now);
	if (!result.ok) throw new AsiServiceError('rate_limit');
	return result;
}

export function consumeAsiProviderRateLimit(clientKey: string, now = Date.now()) {
	const minute = 60_000;
	const day = 24 * 60 * 60 * 1000;
	const date = new Date(now).toISOString().slice(0, 10);
	const checks = [
		takeAsiRateLimit(`provider:${clientKey}`, ASI_GUARD.providerPerMinute, minute, now),
		takeAsiRateLimit('provider:global', ASI_GUARD.providerGlobalPerMinute, minute, now),
		takeAsiRateLimit(`daily:${clientKey}:${date}`, ASI_GUARD.providerPerDay, day, now),
	];
	if (checks.some((item) => !item.ok)) throw new AsiServiceError('rate_limit');
	return checks[0];
}
