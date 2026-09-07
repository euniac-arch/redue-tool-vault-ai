import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { sendContactInquiryMail } from '@/lib/contact-mail';
import { appendContactLead, listContactLeadsForUser } from '@/lib/server/contact-leads';

export const runtime = 'nodejs';

const INQUIRY_TYPES = new Set(['all', 'geo', 'seo', 'schema', 'audit', 'general']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
	const session = await getServerSession(authOptions);
	const email = session?.user?.email?.toLowerCase() || '';
	const userId = session?.user?.id || '';
	if (!email && !userId) {
		return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
	}

	const inquiries = listContactLeadsForUser(userId, email);
	return NextResponse.json({ inquiries });
}

export async function POST(request: Request) {
	const session = await getServerSession(authOptions).catch(() => null);
	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
	}

	const sessionUserId = session?.user?.id?.trim() || null;
	const sessionEmail = session?.user?.email?.trim() || '';
	const name = String(body.name ?? session?.user?.name ?? '').trim();
	const company = String(body.company ?? '').trim();
	const email = String(body.email ?? sessionEmail).trim();
	const phone = String(body.phone ?? '').trim();
	const inquiryType = String(body.inquiryType ?? body.type ?? '').trim();
	const title = String(body.title ?? '').trim();
	const message = String(body.message ?? body.content ?? '').trim();
	const pageUrl = String(body.pageUrl ?? body.url ?? '').trim();
	const serviceType = String(body.serviceType ?? '').trim();

	if (!name || !email || !message || !INQUIRY_TYPES.has(inquiryType)) {
		return NextResponse.json(
			{ error: '담당자명, 이메일, 문의 유형, 문의 내용은 필수입니다.' },
			{ status: 400 },
		);
	}
	if (!EMAIL_RE.test(email)) {
		return NextResponse.json({ error: '올바른 이메일 형식이 아닙니다.' }, { status: 400 });
	}

	const lead = {
		id: `contact_${Date.now().toString(36)}`,
		userId: sessionUserId,
		name,
		company: company || null,
		email,
		phone: phone || null,
		inquiryType,
		serviceType: serviceType || null,
		title: title || null,
		message,
		pageUrl: pageUrl || null,
		status: 'pending' as const,
		adminReply: null,
		repliedAt: null,
		createdAt: new Date().toISOString(),
		updatedAt: null,
	};

	appendContactLead(lead);

	// 저장 성공과 메일 발송을 분리합니다. SMTP 지연/오류가 있어도 접수 완료(201)를 유지합니다.
	try {
		await sendContactInquiryMail({
			name,
			company,
			email,
			phone,
			inquiryType,
			title,
			message,
			pageUrl,
			serviceType,
			createdAt: lead.createdAt,
		});
	} catch (error) {
		console.error('[contact-mail] 관리자 메일 발송 실패:', error);
	}

	return NextResponse.json({ ok: true, lead }, { status: 201 });
}
