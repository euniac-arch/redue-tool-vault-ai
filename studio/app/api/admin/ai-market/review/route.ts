import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getSeedMarketBundle } from '@/lib/ai-hub/market-observation-refresh';
import { decideMarketReview, marketPersistenceAvailable, readPendingReview } from '@/lib/ai-hub/market-observation-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
	const admin = await requireAdmin();
	if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 });
	const approvalEnabled = marketPersistenceAvailable();
	if (!approvalEnabled) {
		return NextResponse.json({ approvalEnabled: false, pending: null });
	}
	const pending = await readPendingReview();
	return NextResponse.json({ approvalEnabled: true, pending });
}

export async function POST(request: Request) {
	const admin = await requireAdmin();
	if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 });
	if (!marketPersistenceAvailable()) {
		return NextResponse.json({ error: 'Firestore가 없어 승인 기능을 사용할 수 없습니다.', approvalEnabled: false }, { status: 503 });
	}
	const body = (await request.json().catch(() => null)) as { action?: string } | null;
	const action = body?.action === 'approve' || body?.action === 'reject' ? body.action : null;
	if (!action) return NextResponse.json({ error: 'approve 또는 reject가 필요합니다.' }, { status: 400 });

	const result = await decideMarketReview({
		action,
		actor: { id: admin.id, email: admin.email, name: admin.name },
		seed: getSeedMarketBundle(),
	});
	if (!result.ok) {
		const status = result.reason === 'not_pending' ? 409 : result.reason === 'invalid_candidate' ? 422 : 503;
		return NextResponse.json({ error: result.reason, approvalEnabled: result.reason !== 'firestore_unconfigured' }, { status });
	}
	return NextResponse.json({ ok: true, action, bundle: result.bundle ?? null });
}
