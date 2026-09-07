export const CONTACT_INQUIRY_STATUSES = ['pending', 'confirmed', 'consulting', 'completed'] as const;

export type ContactInquiryStatus = (typeof CONTACT_INQUIRY_STATUSES)[number];

export type InquiryFilterStatus = 'all' | 'pending' | 'completed';

export type ContactInquiry = {
	id: string;
	userId: string | null;
	name: string;
	company: string | null;
	email: string;
	phone: string | null;
	inquiryType: string;
	serviceType: string | null;
	title: string | null;
	message: string;
	pageUrl: string | null;
	status: ContactInquiryStatus;
	adminReply: string | null;
	repliedAt: string | null;
	createdAt: string;
	updatedAt: string | null;
};

export type InquiryListQuery = {
	q?: string;
	status?: InquiryFilterStatus;
	page?: number;
	pageSize?: number;
};

export type InquiryListResult = {
	items: ContactInquiry[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
	summary: InquirySummary;
};

export type InquirySummary = {
	total: number;
	pending: number;
	active: number;
	completed: number;
};

export const INQUIRY_PAGE_SIZE = 10;

export const INQUIRY_STATUS_LABEL: Record<ContactInquiryStatus, string> = {
	pending: '대기',
	confirmed: '확인',
	consulting: '상담중',
	completed: '완료',
};

export const INQUIRY_STATUS_OPTIONS: { value: ContactInquiryStatus; label: string }[] = [
	{ value: 'pending', label: '미확인' },
	{ value: 'confirmed', label: '확인 완료' },
	{ value: 'consulting', label: '상담 진행 중' },
	{ value: 'completed', label: '답변완료' },
];

export const INQUIRY_TYPE_LABEL: Record<string, string> = {
	geo: 'GEO 최적화 작업',
	seo: 'SEO 개선 작업',
	schema: '스키마 / 구조화 데이터',
	audit: '정밀 진단 컨설팅',
	general: '기타 문의',
	all: '전체 문의',
};

export function isContactInquiryStatus(value: string): value is ContactInquiryStatus {
	return (CONTACT_INQUIRY_STATUSES as readonly string[]).includes(value);
}

export function normalizeInquiryStatus(value: unknown): ContactInquiryStatus {
	const raw = String(value || '').trim();
	if (raw === 'confirmed' || raw === 'reviewed') return 'confirmed';
	if (raw === 'consulting' || raw === 'in_progress') return 'consulting';
	if (raw === 'completed') return 'completed';
	return 'pending';
}

export function inquiryTypeLabel(inquiryType: string, serviceType?: string | null): string {
	if (serviceType?.trim()) return serviceType.trim();
	return INQUIRY_TYPE_LABEL[inquiryType] || inquiryType || '기타 문의';
}

export function formatInquiryNumber(id: string): string {
	const suffix = id.replace(/^contact_/i, '').trim();
	return suffix ? `INQ-${suffix.toUpperCase()}` : id;
}

export function formatInquiryDateTime(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value || '—';
	return date.toLocaleString('ko-KR', {
		timeZone: 'Asia/Seoul',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	});
}

export function displayOrDash(value: string | null | undefined): string {
	const trimmed = value?.trim() || '';
	return trimmed || '—';
}

export function applicantLabel(inquiry: Pick<ContactInquiry, 'name' | 'company'>): string {
	const company = inquiry.company?.trim() || '';
	const name = inquiry.name.trim() || '문의자';
	return company ? `${name} · ${company}` : name;
}

export function matchesInquiryQuery(inquiry: ContactInquiry, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	const haystack = [inquiry.name, inquiry.company, inquiry.email, inquiry.phone, inquiry.id]
		.map((value) => String(value || '').toLowerCase())
		.join(' ');
	return haystack.includes(q);
}

export function matchesInquiryStatus(inquiry: ContactInquiry, status: InquiryFilterStatus): boolean {
	if (status === 'all') return true;
	if (status === 'pending') return inquiry.status === 'pending';
	return inquiry.status === 'completed';
}

export function summarizeInquiries(items: ContactInquiry[]): InquirySummary {
	return items.reduce<InquirySummary>(
		(acc, item) => {
			acc.total += 1;
			if (item.status === 'pending') acc.pending += 1;
			else if (item.status === 'completed') acc.completed += 1;
			else acc.active += 1;
			return acc;
		},
		{ total: 0, pending: 0, active: 0, completed: 0 },
	);
}

export function queryInquiries(items: ContactInquiry[], query: InquiryListQuery): InquiryListResult {
	const q = query.q || '';
	const status: InquiryFilterStatus = query.status || 'all';
	const pageSize = Math.min(50, Math.max(1, query.pageSize || INQUIRY_PAGE_SIZE));
	const filtered = items.filter((item) => matchesInquiryQuery(item, q) && matchesInquiryStatus(item, status));
	const total = filtered.length;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const page = Math.min(totalPages, Math.max(1, query.page || 1));
	const start = (page - 1) * pageSize;
	return {
		items: filtered.slice(start, start + pageSize),
		total,
		page,
		pageSize,
		totalPages,
		summary: summarizeInquiries(items),
	};
}

function asNullableString(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed || null;
}

export function normalizeContactInquiry(value: unknown): ContactInquiry | null {
	if (!value || typeof value !== 'object') return null;
	const row = value as Record<string, unknown>;
	const id = typeof row.id === 'string' || typeof row.id === 'number' ? String(row.id).trim() : '';
	const name = typeof row.name === 'string' ? row.name.trim() : '';
	const email = typeof row.email === 'string' ? row.email.trim() : '';
	const message =
		typeof row.message === 'string'
			? row.message
			: typeof row.content === 'string'
				? row.content
				: '';
	if (!id || (!name && !email && !message.trim())) return null;
	return {
		id,
		userId: asNullableString(row.userId),
		name: name || '문의자',
		company: asNullableString(row.company),
		email,
		phone: asNullableString(row.phone) || asNullableString(row.contactPhone),
		inquiryType: typeof row.inquiryType === 'string' ? row.inquiryType : 'general',
		serviceType: asNullableString(row.serviceType),
		title: asNullableString(row.title),
		message,
		pageUrl: asNullableString(row.pageUrl) || asNullableString(row.url),
		status: normalizeInquiryStatus(row.status),
		adminReply: asNullableString(row.adminReply),
		repliedAt: asNullableString(row.repliedAt),
		createdAt: typeof row.createdAt === 'string' && row.createdAt.trim() ? row.createdAt : new Date().toISOString(),
		updatedAt: asNullableString(row.updatedAt),
	};
}
