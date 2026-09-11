/**
 * Minimal in-memory sliding-window limiter for the public `/api/analytics/collect`
 * endpoint. Deliberately self-contained (no coupling to the ASI guard module)
 * since analytics ingest has very different traffic shape/limits.
 *
 * Note: like every in-memory limiter in this codebase, this resets per
 * server instance/cold-start — good enough to blunt abusive bursts, not a
 * substitute for edge/WAF rate limiting.
 */

type Bucket = number[];

const WINDOWS = new Map<string, Bucket>();

/** Keeps the map from growing unbounded when many distinct IPs hit the endpoint. */
const MAX_TRACKED_KEYS = 20_000;

function prune(bucket: Bucket, now: number, windowMs: number): Bucket {
	return bucket.filter((ts) => now - ts < windowMs);
}

function sweepIfNeeded(now: number, windowMs: number) {
	if (WINDOWS.size <= MAX_TRACKED_KEYS) return;
	for (const [key, bucket] of WINDOWS) {
		const next = prune(bucket, now, windowMs);
		if (next.length === 0) WINDOWS.delete(key);
		else WINDOWS.set(key, next);
	}
}

/** Returns `true` if the call is allowed under the window, `false` if the caller should be throttled. */
export function takeAnalyticsRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
	sweepIfNeeded(now, windowMs);
	const bucket = prune(WINDOWS.get(key) ?? [], now, windowMs);
	if (bucket.length >= limit) {
		WINDOWS.set(key, bucket);
		return false;
	}
	bucket.push(now);
	WINDOWS.set(key, bucket);
	return true;
}

export function clearAnalyticsRateLimits() {
	WINDOWS.clear();
}
