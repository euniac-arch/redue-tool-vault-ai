/**
 * Server-only Google PageSpeed Insights (Lighthouse) client — shared by the
 * standalone `/api/audit/pagespeed` route and the `/api/audit/scan` orchestrator
 * so both a) hit the same short-lived in-memory cache and b) never duplicate the
 * PSI request/parsing logic.
 *
 * The scan orchestrator awaits Track 3 alongside Track 1/2 so the result page
 * never has to fetch PageSpeed itself after mount — see `fetchPageSpeedWithTimeout`.
 */
import {
	emptyPageSpeedSnapshot,
	lcpTier,
	parsePageSpeedPayload,
	scoreTier,
	tbtTier,
	clsTier,
	type PageSpeedSnapshot,
	type PsiCategoryScore,
	type PsiCoreVital,
} from '@/lib/audit/pagespeed';

export type PsiStrategy = 'mobile' | 'desktop';

/** Google PageSpeed Insights API v5 — official camelCase path (lowercase can 404). */
const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

const PSI_CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'] as const;

/**
 * Bound on how long the scan orchestrator will `await` a live Lighthouse read
 * before falling back to an on-page estimate. Real Google PSI/Lighthouse runs
 * routinely take 8–15s, but this is NOT symmetric between strategies — measured
 * directly against a real page, `mobile` landed in ~16s while `desktop` for the
 * SAME page took ~24s (Google's desktop Lighthouse workers are frequently the
 * slower of the two). A single 14–20s cap was therefore cutting off desktop
 * specifically far more often than mobile, which is exactly why desktop kept
 * showing the on-page estimate (and its suspiciously flat, near-100 category
 * scores) while mobile came back with real, varied numbers.
 *
 * `mobile` keeps the shorter bound; `desktop` gets extra headroom via
 * `PSI_ORCHESTRATOR_DESKTOP_TIMEOUT_MS`. Both run concurrently in the scan
 * orchestrator (`Promise.all`), so raising either does not add to the other —
 * total wait is bounded by the slower of the two, not their sum. The real read
 * (if it lands after its timeout anyway) still warms the shared cache for the
 * next request on the same URL/strategy.
 */
export const PSI_ORCHESTRATOR_TIMEOUT_MS = 30_000;
/** Desktop-specific bound — measured consistently slower than mobile on Google's PSI infra. */
export const PSI_ORCHESTRATOR_DESKTOP_TIMEOUT_MS = 42_000;

const PSI_CACHE_TTL_MS = 15 * 60 * 1000;
const PSI_CACHE_MAX_ENTRIES = 300;

interface PsiCacheEntry {
	snapshot: PageSpeedSnapshot;
	expiresAt: number;
}

const psiMemoryCache = new Map<string, PsiCacheEntry>();
/** Bumped on every live fetch so a timed-out background write cannot clobber a newer run. */
const psiFetchGeneration = new Map<string, number>();
/**
 * In-flight Lighthouse reads keyed by `psiCacheKey`, shared across every caller in this
 * process — `/api/audit/scan`'s background cache-warm and `/api/audit/pagespeed`'s
 * client-triggered fetch for the very same url+strategy land inside the same request
 * window (scan fires first, the client follows a second or two later), so without this
 * they'd otherwise both hit Google PSI concurrently and double-spend quota.
 */
const psiInflightFetches = new Map<string, Promise<PageSpeedSnapshot>>();

/** Query param appended to the *target* URL so Google PSI cannot reuse a prior Lighthouse run. */
export const PSI_CACHE_BUSTER_PARAM = '_psi_cb';

export function psiCacheKey(targetUrl: string, strategy: PsiStrategy): string {
	return `${strategy}:${targetUrl}`;
}

export function readPsiCache(key: string): PageSpeedSnapshot | null {
	const entry = psiMemoryCache.get(key);
	if (!entry) return null;
	if (entry.expiresAt <= Date.now()) {
		psiMemoryCache.delete(key);
		return null;
	}
	return entry.snapshot;
}

export function deletePsiCache(key: string): void {
	psiMemoryCache.delete(key);
}

export function deletePsiCacheForUrl(targetUrl: string): void {
	deletePsiCache(psiCacheKey(targetUrl, 'mobile'));
	deletePsiCache(psiCacheKey(targetUrl, 'desktop'));
}

/** Only successful reads are cached — `unavailableReason` snapshots are retried on next request. */
export function writePsiCache(key: string, snapshot: PageSpeedSnapshot): void {
	if (snapshot.unavailableReason || snapshot.estimated) return;
	if (psiMemoryCache.size >= PSI_CACHE_MAX_ENTRIES) {
		const now = Date.now();
		for (const [k, v] of psiMemoryCache) {
			if (v.expiresAt <= now) psiMemoryCache.delete(k);
		}
		if (psiMemoryCache.size >= PSI_CACHE_MAX_ENTRIES) {
			const oldestKey = psiMemoryCache.keys().next().value;
			if (oldestKey) psiMemoryCache.delete(oldestKey);
		}
	}
	psiMemoryCache.set(key, { snapshot, expiresAt: Date.now() + PSI_CACHE_TTL_MS });
}

function bumpPsiGeneration(key: string): number {
	const next = (psiFetchGeneration.get(key) ?? 0) + 1;
	psiFetchGeneration.set(key, next);
	return next;
}

function isCurrentPsiGeneration(key: string, generation: number): boolean {
	return psiFetchGeneration.get(key) === generation;
}

/**
 * Append a unique timestamp query so Google PSI cannot reuse a prior Lighthouse
 * run for the same URL. The snapshot's `url` stays the original (un-busted) URL.
 */
export function withPsiCacheBuster(requestUrl: string, token: string | number = Date.now()): string {
	const stamp = String(token);
	try {
		const targetUrl = new URL(requestUrl);
		targetUrl.searchParams.set(PSI_CACHE_BUSTER_PARAM, stamp);
		return targetUrl.toString();
	} catch {
		const stripped = requestUrl.replace(new RegExp(`[?&]${PSI_CACHE_BUSTER_PARAM}=[^&]*`, 'g'), '');
		const sep = stripped.includes('?') ? '&' : '?';
		return `${stripped}${sep}${PSI_CACHE_BUSTER_PARAM}=${encodeURIComponent(stamp)}`;
	}
}

/**
 * Prefer PAGESPEED_API_KEY, then VITE_GOOGLE_MAP_API_KEY / public aliases.
 * Also reads monorepo-root `.env` via next.config.mjs loadEnvConfig.
 */
export function resolvePageSpeedApiKey(): string {
	return (
		process.env.PAGESPEED_API_KEY?.trim() ||
		process.env.VITE_GOOGLE_MAP_API_KEY?.trim() ||
		process.env.NEXT_PUBLIC_GOOGLE_PAGESPEED_API_KEY?.trim() ||
		process.env.GOOGLE_PAGESPEED_API_KEY?.trim() ||
		process.env.GOOGLE_API_KEY?.trim() ||
		process.env.NEXT_PUBLIC_PAGESPEED_API_KEY?.trim() ||
		''
	);
}

/** Which env var actually supplied the key — for diagnostics only, never logs the value itself. */
function resolvePageSpeedApiKeySource(): string | null {
	const candidates: Array<[string, string | undefined]> = [
		['PAGESPEED_API_KEY', process.env.PAGESPEED_API_KEY],
		['VITE_GOOGLE_MAP_API_KEY', process.env.VITE_GOOGLE_MAP_API_KEY],
		['NEXT_PUBLIC_GOOGLE_PAGESPEED_API_KEY', process.env.NEXT_PUBLIC_GOOGLE_PAGESPEED_API_KEY],
		['GOOGLE_PAGESPEED_API_KEY', process.env.GOOGLE_PAGESPEED_API_KEY],
		['GOOGLE_API_KEY', process.env.GOOGLE_API_KEY],
		['NEXT_PUBLIC_PAGESPEED_API_KEY', process.env.NEXT_PUBLIC_PAGESPEED_API_KEY],
	];
	const hit = candidates.find(([, v]) => v?.trim());
	return hit?.[0] ?? null;
}

/**
 * Build PSI v5 URL.
 * targetUrl MUST go through encodeURIComponent so `:` / `/` never break the query (404).
 */
function buildPageSpeedEndpoint(targetUrl: string, strategy: PsiStrategy, apiKey: string): string {
	const encodedUrl = encodeURIComponent(targetUrl);
	const categories = PSI_CATEGORIES.map((c) => `category=${c}`).join('&');
	return `${PSI_ENDPOINT}?url=${encodedUrl}&strategy=${strategy}&${categories}&key=${encodeURIComponent(apiKey)}`;
}

export class PageSpeedFetchError extends Error {
	code: string;
	status: number;
	constructor(message: string, code: string, status: number) {
		super(message);
		this.name = 'PageSpeedFetchError';
		this.code = code;
		this.status = status;
	}
}

/**
 * Fetch + parse a single Google PSI v5 (Lighthouse) read. Throws `PageSpeedFetchError`
 * on hard failures; returns an `emptyPageSpeedSnapshot` (never throws) when Lighthouse
 * itself reports it could not paint the page (bot wall / blank render / NO_FCP).
 *
 * The URL sent to Google is cache-busted (`_psi_cb`); the returned snapshot always
 * records the original (un-busted) URL.
 */
export async function fetchPageSpeedSnapshot(
	url: string,
	strategy: PsiStrategy,
	opts?: { apiKey?: string; timeoutMs?: number },
): Promise<PageSpeedSnapshot> {
	const apiKey = opts?.apiKey || resolvePageSpeedApiKey();
	if (!apiKey) {
		// Without a key, calls either get rejected outright or silently fall onto Google's
		// shared no-key quota (1 req/s, easily exhausted) — surface this loudly since it's
		// the #1 reason Track 3 quietly falls back to the on-page estimate every time.
		console.error(
			'[PageSpeed] No API key resolved from env — real Lighthouse reads cannot run. ' +
				'Set PAGESPEED_API_KEY (or GOOGLE_PAGESPEED_API_KEY / GOOGLE_API_KEY) in .env.',
			{ url, strategy },
		);
		throw new PageSpeedFetchError('PAGESPEED_API_KEY가 .env 파일에 설정되지 않았습니다.', 'MISSING_API_KEY', 503);
	}

	const keySource = resolvePageSpeedApiKeySource();
	const startedAt = Date.now();
	const measuredUrl = withPsiCacheBuster(url);
	const endpoint = buildPageSpeedEndpoint(measuredUrl, strategy, apiKey);
	const res = await fetch(endpoint, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
		},
		cache: 'no-store',
		signal: AbortSignal.timeout(opts?.timeoutMs ?? 55_000),
	});
	const elapsedMs = Date.now() - startedAt;

	if (!res.ok) {
		const errText = await res.text();

		let message = `PageSpeed API 호출 실패 (${res.status})`;
		let reason = '';
		try {
			const errJson = JSON.parse(errText) as {
				error?: { message?: string; errors?: Array<{ reason?: string; message?: string }> };
			};
			if (typeof errJson?.error?.message === 'string' && errJson.error.message) {
				message = errJson.error.message;
			}
			reason = errJson?.error?.errors?.[0]?.reason || '';
		} catch {
			if (errText.trim()) message = errText.slice(0, 400);
		}

		// Status-specific diagnostic so a glance at the server console tells you exactly
		// why Track 3 didn't come back real: bad key, quota, malformed request, or Google's
		// own transient failure — as opposed to a generic "PageSpeed fetch failed".
		const statusHint =
			res.status === 400
				? 'BAD_REQUEST — check the target URL is a valid absolute http(s) URL and reachable from the server.'
				: res.status === 403
					? 'FORBIDDEN — API key invalid/restricted, or the PageSpeed Insights API is not enabled for this key/project.'
					: res.status === 429
						? 'RATE_LIMITED — PageSpeed Insights quota exceeded for this key (or no-key shared quota if the key failed to resolve).'
						: res.status >= 500
							? 'SERVER_ERROR — Google PSI/Lighthouse had a transient failure; usually resolves on retry.'
							: 'UNEXPECTED_STATUS';
		console.error(`[PageSpeed API Error ${res.status}] ${statusHint}`, {
			url,
			measuredUrl,
			strategy,
			keySource,
			elapsedMs,
			reason,
			message,
		});

		const lighthouseUserError =
			reason === 'lighthouseUserError' ||
			/NO_FCP|did not paint|ERRORED_DOCUMENT_REQUEST|FAILED_DOCUMENT_REQUEST/i.test(message);
		if (lighthouseUserError) {
			return emptyPageSpeedSnapshot(url, strategy, {
				code: /NO_FCP/i.test(message) ? 'NO_FCP' : 'LIGHTHOUSE_USER_ERROR',
				message:
					'페이지가 첫 콘텐츠를 그리지 못해 PageSpeed 측정이 불가합니다. 빈 화면·지연 렌더링·봇 차단을 확인한 뒤 다시 시도하세요.',
			});
		}

		throw new PageSpeedFetchError(message, res.status === 429 ? 'RATE_LIMITED' : 'PSI_ERROR', res.status === 429 ? 429 : 502);
	}

	console.log(`[PageSpeed API OK 200] real Lighthouse read landed`, {
		url,
		measuredUrl,
		strategy,
		keySource,
		elapsedMs,
	});

	const payload = await res.json();
	return parsePageSpeedPayload(payload, { url, strategy });
}

export interface PsiRaceResult {
	snapshot: PageSpeedSnapshot | null;
	/** True when the timeout fired before the real Lighthouse read resolved. */
	timedOut: boolean;
	error?: string;
}

export type FetchPageSpeedTimeoutOpts = {
	timeoutMs?: number;
	/** Skip the 15-minute in-memory cache and require a live Google PSI/Lighthouse run. */
	forceRefresh?: boolean;
};

/**
 * Cache + in-flight-dedup aware Lighthouse read. Every caller in this process (the scan
 * orchestrator's background cache-warm, the standalone `/api/audit/pagespeed` route, and
 * a manual Track 3 refresh) goes through this single choke point, so two callers racing
 * for the same `url+strategy` share one live Google PSI request instead of firing twice.
 */
export function fetchPageSpeedDeduped(
	url: string,
	strategy: PsiStrategy,
	opts?: { apiKey?: string; forceRefresh?: boolean },
): Promise<PageSpeedSnapshot> {
	const cacheKey = psiCacheKey(url, strategy);
	const forceRefresh = opts?.forceRefresh === true;

	if (!forceRefresh) {
		const cached = readPsiCache(cacheKey);
		if (cached) {
			console.log('[PageSpeed] memory cache HIT — skipping live Lighthouse', { url, strategy });
			return Promise.resolve(cached);
		}
	} else {
		deletePsiCache(cacheKey);
	}

	const existing = psiInflightFetches.get(cacheKey);
	if (existing) {
		console.log('[PageSpeed] reusing in-flight Lighthouse read for the same url+strategy', {
			url,
			strategy,
		});
		return existing;
	}

	const generation = bumpPsiGeneration(cacheKey);
	const promise = fetchPageSpeedSnapshot(url, strategy, { apiKey: opts?.apiKey })
		.then((snapshot) => {
			if (isCurrentPsiGeneration(cacheKey, generation)) {
				writePsiCache(cacheKey, snapshot);
			}
			return snapshot;
		})
		.finally(() => {
			// Only the request that registered this generation's promise clears it —
			// a `forceRefresh` that bumped the generation again in the meantime already
			// owns its own in-flight entry.
			if (isCurrentPsiGeneration(cacheKey, generation)) {
				psiInflightFetches.delete(cacheKey);
			}
		});

	psiInflightFetches.set(cacheKey, promise);
	return promise;
}

/**
 * Race a live PSI read against `timeoutMs`. The real request is never aborted —
 * it keeps running in the background (shared via `fetchPageSpeedDeduped`, so a
 * caller elsewhere for the same url+strategy piggybacks on it instead of firing a
 * second Lighthouse run). A later `forceRefresh` bumps the generation so a
 * stale background write cannot overwrite a newer live measurement.
 */
export async function fetchPageSpeedWithTimeout(
	url: string,
	strategy: PsiStrategy,
	timeoutMsOrOpts?: number | FetchPageSpeedTimeoutOpts,
): Promise<PsiRaceResult> {
	const opts = typeof timeoutMsOrOpts === 'number' ? { timeoutMs: timeoutMsOrOpts } : (timeoutMsOrOpts ?? {});
	const timeoutMs =
		opts.timeoutMs ??
		(strategy === 'desktop' ? PSI_ORCHESTRATOR_DESKTOP_TIMEOUT_MS : PSI_ORCHESTRATOR_TIMEOUT_MS);
	const forceRefresh = opts.forceRefresh === true;

	if (forceRefresh) {
		console.log('[PageSpeed] forceRefresh — memory cache bypassed, live Lighthouse required', {
			url,
			strategy,
		});
	}

	const raceStartedAt = Date.now();
	const real = fetchPageSpeedDeduped(url, strategy, { forceRefresh })
		.then((snapshot) => ({ ok: true as const, snapshot }))
		.catch((err) => ({ ok: false as const, error: err instanceof Error ? err.message : 'PageSpeed fetch failed' }));

	const timeout = new Promise<'TIMEOUT'>((resolve) => {
		setTimeout(() => resolve('TIMEOUT'), timeoutMs);
	});

	const winner = await Promise.race([real, timeout]);
	const raceElapsedMs = Date.now() - raceStartedAt;

	if (winner === 'TIMEOUT') {
		// The real read is still running in the background (see doc comment above) and
		// will warm the cache once it lands — log this so a slow-but-successful read can
		// be told apart from a read that never came back at all.
		console.warn(
			`[PageSpeed] orchestrator timeout (${timeoutMs}ms) fired before the real ${strategy} read resolved — falling back to on-page estimate. The real read keeps running in the background.`,
			{ url, strategy, timeoutMs },
		);
		return { snapshot: null, timedOut: true };
	}
	if (!winner.ok) {
		console.error(`[PageSpeed] real ${strategy} read rejected before the timeout — using on-page estimate`, {
			url,
			strategy,
			raceElapsedMs,
			error: winner.error,
		});
		return { snapshot: null, timedOut: false, error: winner.error };
	}
	console.log(`[PageSpeed] real ${strategy} read resolved within the orchestrator window`, {
		url,
		strategy,
		raceElapsedMs,
		estimated: Boolean(winner.snapshot.estimated),
		unavailableReason: winner.snapshot.unavailableReason ?? null,
	});
	return { snapshot: winner.snapshot, timedOut: false };
}

/** Tiny deterministic string hash — NOT for security, only to spread heuristic scores apart. */
function smallHash(input: string): number {
	let h = 0;
	for (let i = 0; i < input.length; i++) {
		h = (h * 31 + input.charCodeAt(i)) >>> 0;
	}
	return h;
}

/** Deterministic jitter in `[-spread, spread]` — same input always yields the same value. */
function jitter(seed: string, spread: number): number {
	return (smallHash(seed) % (spread * 2 + 1)) - spread;
}

/**
 * Best-effort stand-in for a real Lighthouse read, built from on-page performance
 * heuristics already computed by Track 1 (`auditSite`). Used only when the real
 * PSI/Lighthouse call did not resolve within `PSI_ORCHESTRATOR_TIMEOUT_MS` /
 * `PSI_ORCHESTRATOR_DESKTOP_TIMEOUT_MS` — keeps the result screen fully populated
 * (no spinners, no "N/A") instead of blocking on a Lighthouse run that can
 * legitimately take 15–40s.
 *
 * Each category gets its own base offset + small deterministic jitter (seeded by
 * url+strategy+category, so re-rendering the same report doesn't reshuffle
 * numbers) instead of one shared value — a previous version clamped
 * accessibility/best-practices/seo to the exact same number, which for
 * high-`basePerf` sites meant all three landed on an identical, suspiciously
 * flat 100 and looked like a hardcoded dummy rather than an estimate.
 */
export function estimatePageSpeedSnapshot(
	url: string,
	strategy: PsiStrategy,
	hints: { onPagePerformanceScore100?: number | null; responseTimeMs?: number | null } = {},
): PageSpeedSnapshot {
	const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
	const basePerf = hints.onPagePerformanceScore100 ?? 58;
	// Real Lighthouse mobile runs (throttled network/CPU) consistently score lower than desktop.
	const perfScore = clamp(strategy === 'mobile' ? basePerf - 14 : basePerf - 2);
	const accessibilityScore = clamp(basePerf + 3 + jitter(`${url}|${strategy}|a11y`, 6));
	const bestPracticesScore = clamp(basePerf + 7 + jitter(`${url}|${strategy}|bp`, 6));
	const seoScore = clamp(basePerf + 11 + jitter(`${url}|${strategy}|seo`, 5));

	const categories: PsiCategoryScore[] = [
		{ id: 'performance', score: perfScore, tier: scoreTier(perfScore) },
		{ id: 'accessibility', score: accessibilityScore, tier: scoreTier(accessibilityScore) },
		{ id: 'best-practices', score: bestPracticesScore, tier: scoreTier(bestPracticesScore) },
		{ id: 'seo', score: seoScore, tier: scoreTier(seoScore) },
	];

	const respMs = hints.responseTimeMs ?? 450;
	const respPenaltySec = Math.min(1.2, Math.max(0, (respMs - 400) / 800));
	const lcpSec = Math.round(((strategy === 'mobile' ? 3.2 : 2.0) + respPenaltySec) * 100) / 100;
	const fcpSec = Math.round(lcpSec * 0.55 * 100) / 100;
	const tbtMs = strategy === 'mobile' ? 280 : 140;
	const clsVal = strategy === 'mobile' ? 0.09 : 0.05;

	const vitals: PsiCoreVital[] = [
		{ id: 'lcp', value: lcpSec, displayValue: `${lcpSec.toFixed(1)}\u00a0s`, tier: lcpTier(lcpSec), goodThreshold: 2.5 },
		{ id: 'fcp', value: fcpSec, displayValue: `${fcpSec.toFixed(1)}\u00a0s`, tier: lcpTier(fcpSec), goodThreshold: 1.8 },
		{ id: 'tbt', value: tbtMs, displayValue: `${tbtMs}\u00a0ms`, tier: tbtTier(tbtMs), goodThreshold: 200 },
		{ id: 'cls', value: clsVal, displayValue: String(clsVal), tier: clsTier(clsVal), goodThreshold: 0.1 },
	];

	return {
		url,
		strategy,
		fetchedAt: new Date().toISOString(),
		categories,
		vitals,
		renderBlocking: [],
		images: [],
		fonts: [],
		cacheResources: [],
		cacheTotalWastedBytes: null,
		lcpElement: null,
		scriptExecution: [],
		mainThreadWork: [],
		hasWarnings: categories.some((c) => c.tier !== 'good') || vitals.some((v) => v.tier !== 'good'),
		lighthouseVersion: null,
		viewport: null,
		estimated: true,
	};
}
