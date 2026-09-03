export const WORK_INQUIRY_STORAGE_KEY = 'redue_mypage_work_inquiries';

export const WORK_INQUIRY_SERVICE_TYPES = [
	'SEO & GEO 최적화',
	'웹 퍼블리싱 & 리액트 전환',
	'AI 솔루션 커스텀',
	'기타 작업 의뢰',
] as const;

export type WorkInquiryServiceType = (typeof WORK_INQUIRY_SERVICE_TYPES)[number];
export type WorkInquiryStatus = 'pending' | 'consulting' | 'in_progress' | 'completed';

export type WorkInquiry = {
	id: string;
	serviceType: string;
	title: string;
	createdAt: string;
	status: WorkInquiryStatus;
	content: string;
	adminReply: string | null;
	repliedAt: string | null;
	contactPhone?: string;
};

export const WORK_INQUIRY_STATUS: Record<
	WorkInquiryStatus,
	{ label: string; className: string }
> = {
	pending: {
		label: '접수 대기',
		className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
	},
	consulting: {
		label: '상담/견적 확인 중',
		className:
			'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
	},
	in_progress: {
		label: '작업 진행 중',
		className:
			'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
	},
	completed: {
		label: '작업 완료',
		className:
			'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
	},
};

export const SERVICE_TYPE_TO_INQUIRY_TYPE: Record<string, 'geo' | 'seo' | 'schema' | 'audit' | 'general'> = {
	'SEO & GEO 최적화': 'geo',
	'웹 퍼블리싱 & 리액트 전환': 'general',
	'AI 솔루션 커스텀': 'general',
	'기타 작업 의뢰': 'general',
};

const INQUIRY_TYPE_LABEL: Record<string, string> = {
	geo: 'SEO & GEO 최적화',
	seo: 'SEO 개선 작업',
	schema: '스키마 / 구조화 데이터',
	audit: '정밀 진단 컨설팅',
	general: '기타 작업 의뢰',
	all: '전체 문의',
};

export function isWorkInquiryStatus(value: string): value is WorkInquiryStatus {
	return value === 'pending' || value === 'consulting' || value === 'in_progress' || value === 'completed';
}

export function formatInquiryDate(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value.slice(0, 10);
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Seoul',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(date);
}

export function normalizeWorkInquiry(value: unknown): WorkInquiry | null {
	if (!value || typeof value !== 'object') return null;
	const row = value as Record<string, unknown>;
	const id = typeof row.id === 'string' || typeof row.id === 'number' ? String(row.id) : '';
	const title = typeof row.title === 'string' ? row.title.trim() : '';
	const content =
		typeof row.content === 'string'
			? row.content.trim()
			: typeof row.message === 'string'
				? row.message.trim()
				: '';
	if (!id || (!title && !content)) return null;
	const rawStatus = String(row.status || '');
	const status = isWorkInquiryStatus(rawStatus) ? rawStatus : 'pending';
	const serviceType =
		typeof row.serviceType === 'string' && row.serviceType.trim()
			? row.serviceType.trim()
			: INQUIRY_TYPE_LABEL[String(row.inquiryType || '')] || '기타 작업 의뢰';
	return {
		id,
		serviceType,
		title: title || content.slice(0, 48) || '작업 문의',
		createdAt: formatInquiryDate(typeof row.createdAt === 'string' ? row.createdAt : ''),
		status,
		content: content || title,
		adminReply: typeof row.adminReply === 'string' && row.adminReply.trim() ? row.adminReply : null,
		repliedAt: typeof row.repliedAt === 'string' && row.repliedAt.trim() ? row.repliedAt : null,
		contactPhone: typeof row.contactPhone === 'string' ? row.contactPhone : typeof row.phone === 'string' ? row.phone : '',
	};
}

export function mergeWorkInquiries(primary: WorkInquiry[], secondary: WorkInquiry[]): WorkInquiry[] {
	const byId = new Map<string, WorkInquiry>();
	for (const item of [...primary, ...secondary]) {
		if (!byId.has(item.id)) byId.set(item.id, item);
	}
	return [...byId.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

export function readWorkInquiries(): WorkInquiry[] {
	if (!isBrowser()) return [];
	try {
		const raw = window.localStorage.getItem(WORK_INQUIRY_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.map(normalizeWorkInquiry).filter((item): item is WorkInquiry => Boolean(item));
	} catch {
		return [];
	}
}

export function writeWorkInquiries(items: WorkInquiry[]): WorkInquiry[] {
	if (isBrowser()) {
		try {
			window.localStorage.setItem(WORK_INQUIRY_STORAGE_KEY, JSON.stringify(items));
		} catch {
			/* private mode / quota */
		}
	}
	return items;
}
