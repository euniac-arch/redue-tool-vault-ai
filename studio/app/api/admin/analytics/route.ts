import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { isValidDateKey, seoulDateKey, shiftDateKey } from '@/lib/analytics/detect';
import { readAnalyticsRange } from '@/lib/analytics/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const url = new URL(request.url);
	const today = seoulDateKey();
	const defaultStart = shiftDateKey(today, -6);

	const startParam = url.searchParams.get('start') || '';
	const endParam = url.searchParams.get('end') || '';

	let start = isValidDateKey(startParam) ? startParam : defaultStart;
	let end = isValidDateKey(endParam) ? endParam : today;
	if (start > end) [start, end] = [end, start];

	const days = await readAnalyticsRange(start, end);
	return NextResponse.json({ start, end, days });
}
