import { NextResponse } from 'next/server';
import { getPortfolioItems } from '@/lib/portfolio-data';

export const runtime = 'nodejs';

/**
 * GET /api/portfolio?category=AI%2F%EC%9B%B9%EC%86%94%EB%A3%A8%EC%85%98
 *
 * Exposes the REDUE AI SEO & GEO 포트폴리오 메인 데이터베이스 (currently an
 * in-memory array acting as the DB — see lib/portfolio-data.ts) so both the
 * `/portfolio` page and any external consumer can list registered,
 * schema-verified projects.
 */
export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const category = searchParams.get('category');

	return NextResponse.json({ items: getPortfolioItems(category) });
}
