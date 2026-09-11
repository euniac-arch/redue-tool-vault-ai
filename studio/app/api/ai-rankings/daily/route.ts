/**
 * GET /api/ai-rankings/daily
 *
 * Live global AI-tool ranking for the KST calendar day. First request of the
 * day (or `?refresh=1` / `?sync=1`) rebuilds ranks from the on-disk catalog
 * plus yesterday's snapshot and stores today's snapshot (in-memory, Firestore
 * `ai_rankings_daily`, and best-effort `/tmp` — never cwd `.data` on Vercel).
 * Subsequent hits reuse the in-process cache until 00:00 KST.
 *
 * Query:
 *   date=YYYY-MM-DD   optional historical day (KST)
 *   refresh=1|sync=1  force recompute + persist
 *   includeHidden=1   admin-only: include non-public catalog rows
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getDailyAiRankingsPayload } from '@/lib/ai-hub/daily-ai-rankings-service';
import { getKstDateKey, msUntilNextKstMidnight, parseDateKey } from '@/lib/ai-hub/live-ai-rankings';

export const runtime = 'nodejs';
// This handler is invoked with a `date`/`refresh` query string, but Next.js
// can still statically optimize (and therefore Vercel-cache) a GET Route
// Handler when it only sees `export const revalidate` without an explicit
// `dynamic` opt-out — on Vercel that froze every visitor onto whichever
// KST-day payload happened to be computed at build/first-hit time, so the
// "오늘자 순위 분석 보기" button kept reopening the same stale ranking no
// matter when it was clicked. Force real per-request execution here; the
// `Cache-Control` headers returned below already handle CDN-level caching
// until the next KST midnight, so no `revalidate` export is needed.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

function wantsRefresh(searchParams: URLSearchParams): boolean {
	const raw = (searchParams.get('refresh') || searchParams.get('sync') || searchParams.get('force') || '').toLowerCase();
	return raw === '1' || raw === 'true';
}

function cacheHeaders(forceRefresh: boolean): Record<string, string> {
	if (forceRefresh) {
		return {
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
		};
	}
	const seconds = Math.max(60, Math.floor(msUntilNextKstMidnight() / 1000));
	return {
		'Cache-Control': `public, s-maxage=${seconds}, stale-while-revalidate=3600`,
	};
}

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const includeHidden = searchParams.get('includeHidden') === '1' || searchParams.get('includeHidden') === 'true';
	if (includeHidden) {
		const admin = await requireAdmin();
		if (!admin) {
			return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
		}
	}

	try {
		const payload = await getDailyAiRankingsPayload({
			date: parseDateKey(searchParams.get('date')) ?? getKstDateKey(),
			forceRefresh: wantsRefresh(searchParams),
			includeHidden,
		});
		return NextResponse.json(payload, {
			headers: cacheHeaders(wantsRefresh(searchParams)),
		});
	} catch (error) {
		console.error('[ai-rankings/daily] failed:', error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : '일간 AI 순위를 불러오지 못했습니다.' },
			{ status: 502, headers: { 'Cache-Control': 'no-store' } },
		);
	}
}
