import { loadEnvConfig } from '@next/env';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { runHybridScan } from '@/lib/crawling/hybrid-scan';
import { upsertTargetSiteContactInfo } from '@/lib/crawling/target-sites';
import { assertPublicHttpUrl, UnsafeAuditUrlError } from '@/lib/ssrf-guard';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Ensure monorepo-root `.env` / `.env.local` keys are visible in studio. */
loadEnvConfig(path.join(process.cwd(), '..'));
loadEnvConfig(process.cwd());

type ScanBody = {
	targetUrl?: string;
	url?: string;
	category?: string;
	region?: string;
};

function normalizeTargetUrl(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed) return '';
	return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * POST /api/crawling/scan
 *
 * Hybrid collect pipeline:
 * 0) URL protocol auto-fix (missing http/https → https://)
 * 1) Cheerio — arraybuffer + EUC-KR/CP949/UTF-8 decode, SSL ignore,
 *    title / meta / viewport + CMS (JSP/ASP/그누보드/아임웹/카페24/WP/Next…)
 * 2) Google PageSpeed Insights v5 — TTFB, viewport, is-crawlable, SEO score
 *    Key resolve: PAGESPEED_API_KEY → VITE_GOOGLE_MAP_API_KEY → NEXT_PUBLIC_GOOGLE_PAGESPEED_API_KEY
 *    Missing key → anonymous PSI call (rate-limit sensitive) with Cheerio fallback on failure.
 *
 * Body: { targetUrl, category?, region? }
 */
export async function POST(req: NextRequest) {
	let body: ScanBody;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const rawUrl =
		(typeof body.targetUrl === 'string' && body.targetUrl) ||
		(typeof body.url === 'string' && body.url) ||
		'';
	const targetUrl = normalizeTargetUrl(rawUrl);

	if (!targetUrl) {
		return NextResponse.json({ error: 'URL이 필요합니다.' }, { status: 400 });
	}

	const category = typeof body.category === 'string' ? body.category.trim() : undefined;
	const region = typeof body.region === 'string' ? body.region.trim() : undefined;

	try {
		const safeUrl = await assertPublicHttpUrl(targetUrl);
		const data = await runHybridScan({
			targetUrl: safeUrl.toString(),
			category,
			region,
		});

		try {
			const contact = await upsertTargetSiteContactInfo(safeUrl.toString(), {
				targetRegion: region,
			});
			if (contact?.ok) {
				console.log('📧 [crawling/scan contact]:', {
					domain: contact.domain,
					email: contact.email,
					contactFormUrl: contact.contactFormUrl,
					phoneNumber: contact.phoneNumber,
					kakaoChannelUrl: contact.kakaoChannelUrl,
					instagramUrl: contact.instagramUrl,
				});
			}
		} catch (contactError) {
			console.warn(
				'[crawling/scan] contact extract skipped:',
				contactError instanceof Error ? contactError.message : contactError,
			);
		}

		return NextResponse.json({
			success: true,
			data,
		});
	} catch (error: unknown) {
		if (error instanceof UnsafeAuditUrlError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}

		const message = error instanceof Error ? error.message : 'Unknown error';
		console.error('[crawling/scan]', message);
		return NextResponse.json(
			{
				error: '사이트 수집 중 오류가 발생했습니다.',
				details: message,
			},
			{ status: 500 },
		);
	}
}
