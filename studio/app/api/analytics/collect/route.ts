import { NextResponse } from 'next/server';
import { extractRequestMeta } from '@/lib/security-log-meta';
import { classifyReferrer, detectBrowser, detectDevice, detectOs, isLikelyBot, seoulDateKey } from '@/lib/analytics/detect';
import { takeAnalyticsRateLimit } from '@/lib/analytics/rate-limit';
import { recordAnalyticsEvent } from '@/lib/analytics/store';
import type { AnalyticsCollectPayload } from '@/lib/analytics/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Generous per-IP budget: a real user navigating a lot won't hit this; scripted abuse will. */
const RATE_LIMIT_PER_MINUTE = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_PATH_LEN = 300;
const MAX_STR_LEN = 200;

function truncate(value: unknown, max: number): string {
	if (typeof value !== 'string') return '';
	return value.slice(0, max);
}

async function readPayload(request: Request): Promise<AnalyticsCollectPayload | null> {
	try {
		const text = await request.text();
		if (!text) return null;
		const parsed = JSON.parse(text) as unknown;
		if (!parsed || typeof parsed !== 'object') return null;
		return parsed as AnalyticsCollectPayload;
	} catch {
		return null;
	}
}

export async function POST(request: Request) {
	const meta = extractRequestMeta(request);

	// 1) Rate-limit first — cheapest check, protects everything below it.
	if (!takeAnalyticsRateLimit(`analytics-collect:${meta.ipAddress}`, RATE_LIMIT_PER_MINUTE, RATE_LIMIT_WINDOW_MS)) {
		return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
	}

	// 2) Bot/crawler filtering — GPTBot, Googlebot, curl, headless browsers, etc. never count as visitors.
	if (isLikelyBot(meta.userAgent)) {
		return NextResponse.json({ ok: true, skipped: 'bot' }, { status: 202 });
	}

	const payload = await readPayload(request);
	if (!payload || typeof payload.path !== 'string' || !payload.path.trim()) {
		return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
	}

	const path = truncate(payload.path, MAX_PATH_LEN) || '/';
	// Never track admin backoffice traffic or the collector itself.
	if (path.startsWith('/admin') || path.startsWith('/api/')) {
		return NextResponse.json({ ok: true, skipped: 'excluded_path' }, { status: 202 });
	}

	// Prefer the request header UA (can't be spoofed by the tracker payload); fall back to client-reported value.
	const userAgent = meta.userAgent || truncate(payload.userAgent, MAX_STR_LEN);
	if (isLikelyBot(userAgent)) {
		return NextResponse.json({ ok: true, skipped: 'bot' }, { status: 202 });
	}

	const referrer = truncate(payload.referrer, MAX_STR_LEN);
	const utmSource = truncate(payload.utmSource, 80);
	const visitorId = truncate(payload.visitorId, 120) || `anon:${meta.ipAddress}`;

	try {
		await recordAnalyticsEvent({
			date: seoulDateKey(),
			visitorId,
			path,
			referrerLabel: classifyReferrer(referrer, utmSource),
			device: detectDevice(userAgent),
			browser: detectBrowser(userAgent),
			os: detectOs(userAgent),
		});
	} catch (error) {
		console.error('[analytics] collect failed:', error);
		return NextResponse.json({ ok: false, error: 'record_failed' }, { status: 500 });
	}

	return NextResponse.json({ ok: true }, { status: 202 });
}
