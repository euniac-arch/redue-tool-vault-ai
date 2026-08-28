import { NextResponse } from 'next/server';
import { collectLiveGeoNewsFeed } from '@/lib/admin/geo-news-service';
import type { GeoNewsCategory, GeoNewsFilters } from '@/lib/admin/geo-news-management';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseFilters(searchParams: URLSearchParams): GeoNewsFilters {
	const region = searchParams.get('region') || 'all';
	const category = searchParams.get('category') || 'all';
	return {
		query: searchParams.get('q') ?? '',
		region: region === 'KR' || region === 'GLOBAL' ? region : 'all',
		category: isCategory(category) ? category : 'all',
	};
}

function isCategory(value: string): value is GeoNewsCategory {
	return value === 'GEO' || value === 'Schema Markup' || value === 'Search Engine' || value === 'AI Model';
}

/** GET /api/admin/geo-insights — live feed (official SEO RSS + Google News + Naver News). */
export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const result = await collectLiveGeoNewsFeed({ filters: parseFilters(searchParams) });
		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : '뉴스 피드를 불러오지 못했습니다.';
		return NextResponse.json({ error: message }, { status: 502 });
	}
}
