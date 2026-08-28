import { loadEnvConfig } from '@next/env';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import {
	PageSpeedFetchError,
	estimatePageSpeedSnapshot,
	fetchPageSpeedDeduped,
	resolvePageSpeedApiKey,
} from '@/lib/audit/pagespeed-fetch';
import type { PageSpeedSnapshot } from '@/lib/audit/pagespeed';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/** Ensure monorepo-root `.env` (PAGESPEED_API_KEY) is visible even if only set outside studio/. */
loadEnvConfig(path.join(process.cwd(), '..'));
loadEnvConfig(process.cwd());

function normalizeUrl(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	try {
		const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
		const u = new URL(withProtocol);
		if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
		return u.toString();
	} catch {
		return null;
	}
}

const NO_STORE_HEADERS = {
	'Cache-Control': 'no-store, no-cache, must-revalidate',
	Pragma: 'no-cache',
};

/**
 * POST /api/audit/pagespeed
 * Body: { url, strategy?, forceRefresh?, onPagePerformanceScore100?, responseTimeMs? }
 *
 * Standalone Lighthouse read. Since `/api/audit/scan` no longer awaits Track 3, this is
 * now the *primary* path every fresh scan uses to progressively fill Track 3 in — plus the
 * fallback for reports that predate the embedded Track 3 read, and for manual re-checks.
 * Shares the in-memory PSI cache + in-flight dedup with the scan route's background warm-up
 * via `fetchPageSpeedDeduped`, so the two never fire the same Lighthouse read twice.
 */
export async function POST(req: NextRequest) {
	let body: {
		url?: string;
		strategy?: string;
		forceRefresh?: boolean;
		/** On-page performance heuristic (0-100) — improves the fallback estimate's accuracy. */
		onPagePerformanceScore100?: number;
		responseTimeMs?: number;
	};
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const normalizedUrl = normalizeUrl(typeof body.url === 'string' ? body.url : '');
	if (!normalizedUrl) {
		return NextResponse.json({ error: 'Valid url is required' }, { status: 400 });
	}
	// Re-bound as its own `string`-typed const so the nested closures below (which TS
	// can't narrow through) don't see the original `string | null` return type.
	const url: string = normalizedUrl;

	/** Default: desktop (PC) lab data — matches audit UI default tab. */
	const strategy: 'mobile' | 'desktop' = body.strategy === 'mobile' ? 'mobile' : 'desktop';
	/** Track 3 부분 재진단 — 15분 서버 캐시를 건너뛰고 Lighthouse를 강제로 다시 실행. */
	const forceRefresh = body.forceRefresh === true;
	const hints = {
		onPagePerformanceScore100:
			typeof body.onPagePerformanceScore100 === 'number' ? body.onPagePerformanceScore100 : null,
		responseTimeMs: typeof body.responseTimeMs === 'number' ? body.responseTimeMs : null,
	};

	function respondWithError(err: unknown) {
		if (err instanceof PageSpeedFetchError) {
			return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
		}
		console.error('Failed to fetch PageSpeed data:', err);
		const message = err instanceof Error ? err.message : 'PageSpeed fetch failed';
		const timedOut = /abort|timeout/i.test(message);
		return NextResponse.json(
			{
				error: timedOut ? 'PageSpeed Insights timed out. Retry in a moment.' : message,
				code: timedOut ? 'TIMEOUT' : 'FETCH_ERROR',
			},
			{ status: 504 },
		);
	}

	/**
	 * On-page estimate fallback — only for the silent, non-`forceRefresh` progressive-load
	 * path (mirrors the old scan-embedded behavior: the result screen always ends up with a
	 * plausible Track 3 number instead of a permanent spinner). A manual "Track 3 재진단"
	 * (`forceRefresh: true`) instead surfaces the real error so the user can retry.
	 */
	function fallbackOrError(err: unknown) {
		if (forceRefresh) return respondWithError(err);
		console.warn('[PageSpeed] live read failed on initial load — using on-page estimate', {
			url,
			strategy,
			error: err instanceof Error ? err.message : String(err),
		});
		return NextResponse.json(estimatePageSpeedSnapshot(url, strategy, hints), {
			headers: NO_STORE_HEADERS,
		});
	}

	const apiKey = resolvePageSpeedApiKey();
	if (!apiKey) {
		console.error('[PageSpeed] PAGESPEED_API_KEY is missing from process.env');
		return fallbackOrError(new PageSpeedFetchError('PAGESPEED_API_KEY가 .env 파일에 설정되지 않았습니다.', 'MISSING_API_KEY', 503));
	}

	try {
		const snapshot: PageSpeedSnapshot = await fetchPageSpeedDeduped(url, strategy, { apiKey, forceRefresh });
		return NextResponse.json(snapshot, { headers: NO_STORE_HEADERS });
	} catch (err) {
		return fallbackOrError(err);
	}
}
