import { NextResponse } from 'next/server';
import { getLiveCaseStudies } from '@/lib/case-studies/live-case-studies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/case-studies — public "도입 사례" feed sourced from projects the
 * admin explicitly opted in via `is_case_study` in `/admin/projects`.
 * Returns full `CaseStudyData` objects so the portfolio page can render every
 * card through `CaseStudyCard`. Scores are taken from live audit reports.
 */
export async function GET() {
	const items = await getLiveCaseStudies();

	return NextResponse.json(
		{ items, timestamp: new Date().toISOString() },
		{ headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache' } },
	);
}
