import { NextResponse } from 'next/server';
import { getAuditTrackingHistory, saveRoundSnapshot } from '@/lib/firebase/audit-tracking';
import { isTrackingRound, type RoundSnapshot } from '@/lib/audit/round-tracking-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/audit/tracking?domain=example.com
 * 도메인의 1~4회차 경량 점수 추이 히스토리를 조회한다. Firestore 미설정 시
 * `history: null`을 반환 — 호출부는 로컬(localStorage) 캐시로 안전하게 폴백한다.
 */
export async function GET(req: Request) {
	const url = new URL(req.url);
	const domain = url.searchParams.get('domain')?.trim() || '';
	if (!domain) {
		return NextResponse.json({ error: 'domain 쿼리 파라미터가 필요합니다.' }, { status: 400 });
	}

	try {
		const history = await getAuditTrackingHistory(domain);
		return NextResponse.json({ history });
	} catch (err) {
		console.error('[api/audit/tracking] GET failed:', err);
		return NextResponse.json({ history: null, error: '히스토리 조회에 실패했습니다.' }, { status: 200 });
	}
}

interface SaveRequestBody {
	domain?: string;
	round?: number;
	snapshot?: RoundSnapshot;
}

/**
 * POST /api/audit/tracking
 * body: { domain, round, snapshot: RoundSnapshot }
 * 관리자가 "확정/박제" 클릭 시 호출되는 경량(수백 바이트~2KB) 원격 저장 경로 —
 * `audit_tracking` 컬렉션에 `setDoc(..., { merge: true })`로 영구 반영한다.
 * 페이로드가 작아 용량 초과로 실패할 가능성이 거의 없으므로, 이 경로가 실제
 * 실패하는 경우는 "Firebase 미설정" 또는 "네트워크 문제"뿐이다.
 */
export async function POST(req: Request) {
	let body: SaveRequestBody;
	try {
		body = (await req.json()) as SaveRequestBody;
	} catch {
		return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
	}

	const domain = body.domain?.trim() || '';
	const snapshot = body.snapshot;
	if (!domain || !snapshot || !isTrackingRound(body.round)) {
		return NextResponse.json({ error: 'domain / round / snapshot이 필요합니다.' }, { status: 400 });
	}

	try {
		const history = await saveRoundSnapshot(domain, body.round, snapshot);
		return NextResponse.json({ history });
	} catch (err) {
		console.error('[api/audit/tracking] POST failed:', err);
		return NextResponse.json({ error: '서버 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
	}
}
