import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const INQUIRY_TYPES = new Set(['geo', 'seo', 'schema', 'audit', 'general']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function appendContactLead(lead: Record<string, unknown>): void {
	const dataDir = path.join(process.cwd(), '.data');
	if (!fs.existsSync(dataDir)) {
		fs.mkdirSync(dataDir, { recursive: true });
	}
	const file = path.join(dataDir, 'contact-leads.json');
	let list: Record<string, unknown>[] = [];
	try {
		list = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>[];
	} catch {
		list = [];
	}
	list.unshift(lead);
	fs.writeFileSync(file, JSON.stringify(list, null, 2), 'utf8');
}

export async function POST(request: Request) {
	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
	}

	const name = String(body.name ?? '').trim();
	const company = String(body.company ?? '').trim();
	const email = String(body.email ?? '').trim();
	const phone = String(body.phone ?? '').trim();
	const inquiryType = String(body.inquiryType ?? body.type ?? '').trim();
	const message = String(body.message ?? '').trim();
	const pageUrl = String(body.pageUrl ?? body.url ?? '').trim();

	if (!name || !email || !message || !INQUIRY_TYPES.has(inquiryType)) {
		return NextResponse.json(
			{ error: '담당자명, 이메일, 문의 유형, 문의 내용은 필수입니다.' },
			{ status: 400 }
		);
	}
	if (!EMAIL_RE.test(email)) {
		return NextResponse.json({ error: '올바른 이메일 형식이 아닙니다.' }, { status: 400 });
	}

	const lead = {
		id: `contact_${Date.now().toString(36)}`,
		name,
		company: company || null,
		email,
		phone: phone || null,
		inquiryType,
		message,
		pageUrl: pageUrl || null,
		createdAt: new Date().toISOString(),
	};

	appendContactLead(lead);

	return NextResponse.json({ ok: true, lead }, { status: 201 });
}
