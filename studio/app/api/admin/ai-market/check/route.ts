import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { runAuthorizedMarketCheck } from '@/lib/ai-hub/market-observation-refresh';
import { cronHttpStatus } from '@/lib/ai-hub/ranking-refresh-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Administrator source check. The cron bearer is not accepted here. */
export async function POST() {
	const admin = await requireAdmin();
	if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 });
	const result = await runAuthorizedMarketCheck();
	return NextResponse.json(
		{
			ok: result.persistence.reason === 'saved' || result.persistence.reason === 'already_checked',
			ran: result.ran,
			persistence: result.persistence,
			periodStart: result.bundle.webTraffic.periodStart,
			periodEnd: result.bundle.webTraffic.periodEnd,
			checkStatus: result.bundle.checkStatus,
			checkNote: result.bundle.checkNote,
		},
		{ status: cronHttpStatus(result.persistence) },
	);
}
