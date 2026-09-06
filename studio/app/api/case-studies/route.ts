import { NextResponse } from 'next/server';
import { getLiveCaseStudies } from '@/lib/case-studies/live-case-studies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/case-studies — public "도입 사례" feed. No auth cookie required.
 * Only admin-opted-in projects (`isCaseStudy`) are returned so guests and
 * members see the same approved cards on `/` and `/portfolio`.
 */
export async function GET() {
	const items = await getLiveCaseStudies();

	return NextResponse.json(
		{ items, timestamp: new Date().toISOString() },
		{ headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache' } },
	);
}
