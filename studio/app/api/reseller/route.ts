import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import {
	loadResellerProfile,
	saveResellerProfile,
	type ResellerClient,
} from '@/lib/reseller-store';

export const runtime = 'nodejs';

async function requireUserId(): Promise<string | null> {
	const session = await getServerSession(authOptions);
	return session?.user?.id ?? null;
}

export async function GET() {
	const userId = await requireUserId();
	if (!userId) {
		return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
	}
	const profile = loadResellerProfile(userId);
	return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
	const userId = await requireUserId();
	if (!userId) {
		return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
	}

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
	}

	const action = String(body.action ?? '');
	const profile = loadResellerProfile(userId);

	if (action === 'updateBranding') {
		profile.partnerName = String(body.partnerName ?? profile.partnerName).trim() || profile.partnerName;
		profile.customDomain = String(body.customDomain ?? profile.customDomain).trim() || profile.customDomain;
		profile.brandColor = String(body.brandColor ?? profile.brandColor).trim() || profile.brandColor;
		if (body.logoDataUrl === null) {
			profile.logoDataUrl = null;
		} else if (typeof body.logoDataUrl === 'string') {
			profile.logoDataUrl = body.logoDataUrl;
		}
		saveResellerProfile(profile);
		return NextResponse.json({ profile });
	}

	if (action === 'addClient') {
		const name = String(body.name ?? '').trim();
		const email = String(body.email ?? '').trim();
		const creditsAllocated = Math.max(0, Number(body.creditsAllocated) || 0);
		if (!name || !email) {
			return NextResponse.json({ error: '고객사명과 이메일은 필수입니다.' }, { status: 400 });
		}
		if (creditsAllocated > profile.creditPool) {
			return NextResponse.json({ error: '크레딧 풀이 부족합니다.' }, { status: 400 });
		}
		const client: ResellerClient = {
			id: `cli_${Date.now().toString(36)}`,
			name,
			email,
			creditsAllocated,
			createdAt: new Date().toISOString(),
		};
		profile.clients.unshift(client);
		profile.creditPool -= creditsAllocated;
		saveResellerProfile(profile);
		return NextResponse.json({ profile });
	}

	if (action === 'allocateBulk') {
		const creditsPerClient = Math.max(0, Number(body.creditsPerClient) || 0);
		const totalNeeded = creditsPerClient * profile.clients.length;
		if (profile.clients.length === 0) {
			return NextResponse.json({ error: '하위 고객사가 없습니다.' }, { status: 400 });
		}
		if (totalNeeded > profile.creditPool) {
			return NextResponse.json(
				{ error: `크레딧 풀이 부족합니다. 필요 ${totalNeeded} / 보유 ${profile.creditPool}` },
				{ status: 400 }
			);
		}
		profile.clients = profile.clients.map((client) => ({
			...client,
			creditsAllocated: client.creditsAllocated + creditsPerClient,
		}));
		profile.creditPool -= totalNeeded;
		saveResellerProfile(profile);
		return NextResponse.json({ profile });
	}

	return NextResponse.json({ error: '알 수 없는 action입니다.' }, { status: 400 });
}
