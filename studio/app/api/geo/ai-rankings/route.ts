import { NextResponse } from 'next/server';
import { getDailyAIRankings } from '@/lib/geo/ai-rankings';

export const runtime = 'nodejs';

/**
 * GET /api/geo/ai-rankings
 *
 * Daily Korea AI-search traffic share (1 snapshot per KST calendar day,
 * aggregated at 00:00 KST). Optional `?date=YYYY-MM-DD` (also accepts
 * `YYYY.MM.DD`); omitted date uses today in KST.
 */

function noStoreJson(body: unknown, init?: { status?: number }) {
	return NextResponse.json(body, {
		status: init?.status,
		headers: {
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
		},
	});
}

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const dateParam = searchParams.get('date');
	const aiShareRates = getDailyAIRankings(dateParam);
	return noStoreJson({ aiShareRates, ...aiShareRates });
}
