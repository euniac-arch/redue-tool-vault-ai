import { NextResponse } from 'next/server';
import { appendEnterpriseLead } from '@/lib/reseller-store';

export const runtime = 'nodejs';

const SITE_COUNTS = new Set(['50+', '100+']);

export async function POST(request: Request) {
	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
	}

	const companyName = String(body.companyName ?? '').trim();
	const contactName = String(body.contactName ?? '').trim();
	const title = String(body.title ?? '').trim();
	const email = String(body.email ?? '').trim();
	const phone = String(body.phone ?? '').trim();
	const siteCount = String(body.siteCount ?? '').trim();

	if (!companyName || !contactName || !email || !phone || !SITE_COUNTS.has(siteCount)) {
		return NextResponse.json(
			{ error: '기업명, 담당자, 이메일, 연락처, 관리 사이트 수는 필수입니다.' },
			{ status: 400 }
		);
	}

	const lead = {
		id: `ent_${Date.now().toString(36)}`,
		companyName,
		contactName,
		title: title || null,
		email,
		phone,
		siteCount,
		createdAt: new Date().toISOString(),
	};

	appendEnterpriseLead(lead);

	return NextResponse.json({ ok: true, lead });
}
