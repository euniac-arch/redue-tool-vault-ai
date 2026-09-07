import { mergeWorkInquiries, normalizeWorkInquiry, type WorkInquiry } from '@/lib/mypage/work-inquiries';

export async function fetchUserInquiries(): Promise<WorkInquiry[]> {
	const res = await fetch('/api/user/inquiries', { cache: 'no-store', credentials: 'same-origin' });
	if (res.status === 401) {
		if (typeof window !== 'undefined') {
			window.location.assign('/login?callbackUrl=/mypage?tab=inquiries');
		}
		throw new Error('로그인이 필요합니다.');
	}
	const body = (await res.json().catch(() => ({}))) as { inquiries?: unknown; error?: string };
	if (!res.ok) {
		throw new Error(typeof body.error === 'string' ? body.error : '문의 내역을 불러오지 못했습니다.');
	}
	const rows = Array.isArray(body.inquiries) ? body.inquiries : [];
	return rows.map(normalizeWorkInquiry).filter((item): item is WorkInquiry => Boolean(item));
}

export async function createUserInquiry(payload: {
	name: string;
	email: string;
	phone?: string;
	inquiryType: string;
	serviceType?: string;
	title?: string;
	message: string;
	pageUrl?: string;
}): Promise<WorkInquiry> {
	const res = await fetch('/api/contact', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'same-origin',
		body: JSON.stringify({
			name: payload.name,
			email: payload.email,
			phone: payload.phone || '',
			inquiryType: payload.inquiryType,
			serviceType: payload.serviceType || '',
			title: payload.title || '',
			message: payload.message,
			pageUrl: payload.pageUrl || '',
		}),
	});
	const body = (await res.json().catch(() => ({}))) as { lead?: unknown; error?: string };
	if (!res.ok) {
		throw new Error(typeof body.error === 'string' ? body.error : '문의를 접수하지 못했습니다.');
	}
	const created = normalizeWorkInquiry(body.lead);
	if (!created) {
		throw new Error('문의는 접수되었으나 내역을 표시하지 못했습니다. 잠시 후 새로고침해 주세요.');
	}
	return created;
}

export function mergeUserInquiries(primary: WorkInquiry[], secondary: WorkInquiry[]): WorkInquiry[] {
	return mergeWorkInquiries(primary, secondary);
}
