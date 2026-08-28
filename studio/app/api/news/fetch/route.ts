import { NextResponse } from 'next/server';
import { getInsightsNewsFeed } from '@/lib/insights/insights-news-service';
import { parseInsightsNewsTab } from '@/lib/insights/insights-news-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function parseTab(value: string | null) {
	return parseInsightsNewsTab(value);
}

function wantsRefresh(searchParams: URLSearchParams): boolean {
	const raw = (searchParams.get('refresh') || searchParams.get('force') || '').toLowerCase();
	return raw === '1' || raw === 'true';
}

/**
 * GET /api/news/fetch — global SEO / AI-search RSS with 5h Firestore cache.
 *
 * Query:
 *   tab=all|aeo_geo_search|gen_ai_llm|schema_entity|portal_seo
 *   refresh=1  — bypass TTL and re-fetch RSS
 */
export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const result = await getInsightsNewsFeed({
			tab: parseTab(searchParams.get('tab') || searchParams.get('category')),
			forceRefresh: wantsRefresh(searchParams),
		});
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : '뉴스 피드를 불러오지 못했습니다.';
		return NextResponse.json({ error: message }, { status: 502 });
	}
}
