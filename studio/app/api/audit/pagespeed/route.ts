import { loadEnvConfig } from '@next/env';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import {
	parsePageSpeedPayload,
	type PageSpeedSnapshot,
} from '@/lib/audit/pagespeed';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Ensure monorepo-root `.env` (PAGESPEED_API_KEY) is visible even if only set outside studio/. */
loadEnvConfig(path.join(process.cwd(), '..'));
loadEnvConfig(process.cwd());

/** Google PageSpeed Insights API v5 — official camelCase path (lowercase can 404). */
const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

const PSI_CATEGORIES = [
	'performance',
	'accessibility',
	'best-practices',
	'seo',
] as const;

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

/**
 * Prefer PAGESPEED_API_KEY, then VITE_GOOGLE_MAP_API_KEY / public aliases.
 * Also reads monorepo-root `.env` via next.config.mjs loadEnvConfig.
 */
function resolvePageSpeedApiKey(): string {
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

/**
 * Build PSI v5 URL.
 * targetUrl MUST go through encodeURIComponent so `:` / `/` never break the query (404).
 * Format:
 *   .../runPagespeed?url=${encodedUrl}&strategy=mobile&category=...&key=${apiKey}
 */
function buildPageSpeedEndpoint(
	targetUrl: string,
	strategy: 'mobile' | 'desktop',
	apiKey: string,
): string {
	const encodedUrl = encodeURIComponent(targetUrl);
	const categories = PSI_CATEGORIES.map((c) => `category=${c}`).join('&');
	return `${PSI_ENDPOINT}?url=${encodedUrl}&strategy=${strategy}&${categories}&key=${encodeURIComponent(apiKey)}`;
}

/**
 * POST /api/audit/pagespeed
 * Body: { url: string, strategy?: 'mobile' | 'desktop' }
 *
 * Fetches Google PageSpeed Insights v5 (Lighthouse) and returns a typed snapshot
 * for Executive Summary scoreboard + Tab 2 precision panel.
 */
export async function POST(req: NextRequest) {
	let body: { url?: string; strategy?: string };
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const url = normalizeUrl(typeof body.url === 'string' ? body.url : '');
	if (!url) {
		return NextResponse.json({ error: 'Valid url is required' }, { status: 400 });
	}

	/** Default: desktop (PC) lab data — matches audit UI default tab. */
	const strategy: 'mobile' | 'desktop' =
		body.strategy === 'mobile' ? 'mobile' : 'desktop';

	const apiKey = resolvePageSpeedApiKey();
	if (!apiKey) {
		console.error('[PageSpeed] PAGESPEED_API_KEY is missing from process.env');
		return NextResponse.json(
			{
				error: 'PAGESPEED_API_KEY가 .env 파일에 설정되지 않았습니다.',
				code: 'MISSING_API_KEY',
			},
			{ status: 503 },
		);
	}

	const endpoint = buildPageSpeedEndpoint(url, strategy, apiKey);

	try {
		const res = await fetch(endpoint, {
			method: 'GET',
			headers: { Accept: 'application/json' },
			cache: 'no-store',
			signal: AbortSignal.timeout(55_000),
		});

		if (!res.ok) {
			const errText = await res.text();
			console.error(`[PageSpeed API Error ${res.status}]`, errText);

			let message = `PageSpeed API 호출 실패 (${res.status})`;
			try {
				const errJson = JSON.parse(errText) as {
					error?: { message?: string };
				};
				if (typeof errJson?.error?.message === 'string' && errJson.error.message) {
					message = errJson.error.message;
				}
			} catch {
				if (errText.trim()) message = errText.slice(0, 400);
			}

			return NextResponse.json(
				{
					error: message,
					code: res.status === 429 ? 'RATE_LIMITED' : 'PSI_ERROR',
				},
				{ status: res.status === 429 ? 429 : 502 },
			);
		}

		const payload = await res.json();
		const snapshot: PageSpeedSnapshot = parsePageSpeedPayload(payload, { url, strategy });
		return NextResponse.json(snapshot);
	} catch (err) {
		console.error('Failed to fetch PageSpeed data:', err);
		const message = err instanceof Error ? err.message : 'PageSpeed fetch failed';
		const timedOut = /abort|timeout/i.test(message);
		return NextResponse.json(
			{
				error: timedOut
					? 'PageSpeed Insights timed out. Retry in a moment.'
					: message,
				code: timedOut ? 'TIMEOUT' : 'FETCH_ERROR',
			},
			{ status: 504 },
		);
	}
}
