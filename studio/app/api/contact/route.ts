import fs from 'node:fs';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { ensureWritableDirSync, writableDataPath, writeJsonFileSync } from '@/lib/server/writable-data-dir';

export const runtime = 'nodejs';

const INQUIRY_TYPES = new Set(['all', 'geo', 'seo', 'schema', 'audit', 'general']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function leadsFilePath() {
	return writableDataPath('contact-leads.json');
}

function readContactLeads(): Record<string, unknown>[] {
	try {
		return JSON.parse(fs.readFileSync(leadsFilePath(), 'utf8')) as Record<string, unknown>[];
	} catch {
		return [];
	}
}

function appendContactLead(lead: Record<string, unknown>): void {
	ensureWritableDirSync(writableDataPath());
	const list = readContactLeads();
	list.unshift(lead);
	writeJsonFileSync(leadsFilePath(), list);
}

export async function GET() {
	const session = await getServerSession(authOptions);
	const email = session?.user?.email?.toLowerCase() || '';
	const userId = session?.user?.id || '';
	if (!email && !userId) {
		return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
	}

	const inquiries = readContactLeads().filter((lead) => {
		const leadEmail = String(lead.email || '').toLowerCase();
		const leadUserId = String(lead.userId || '');
		return (email && leadEmail === email) || (userId && leadUserId === userId);
	});

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

	const name = String(body.name ?? session?.user?.name ?? '').trim();
	const company = String(body.company ?? '').trim();
	const email = String(body.email ?? session?.user?.email ?? '').trim();
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
		userId: session?.user?.id || null,
		name,
		company: company || null,
		email,
		phone: phone || null,
		inquiryType,
		serviceType: serviceType || null,
		title: title || null,
		message,
		pageUrl: pageUrl || null,
		status: 'pending',
		adminReply: null,
		repliedAt: null,
		createdAt: new Date().toISOString(),
	};

	appendContactLead(lead);

	return NextResponse.json({ ok: true, lead }, { status: 201 });
}
