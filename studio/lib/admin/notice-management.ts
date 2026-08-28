/**
 * Admin "공지사항 및 시스템 알림 관리" — types, mock data, and pure helpers.
 *
 * Mirrors the shape the future `Notice` table will return once the real
 * CMS/notice API is wired up (see `studio/lib/admin/notice-service.ts` for
 * the swap point).
 */

export type NoticeType = 'notice' | 'system' | 'event';
export type NoticeTarget = 'all' | 'user' | 'admin';
export type NoticeStatus = 'published' | 'draft' | 'archived';
export type NoticeSortKey = 'createdAt' | 'title';
export type SortDirection = 'asc' | 'desc';

export type Notice = {
	id: string;
	type: NoticeType;
	title: string;
	content: string;
	target: NoticeTarget;
	isPinned: boolean;
	isPopup: boolean;
	status: NoticeStatus;
	/** `YYYY-MM-DD HH:mm` */
	createdAt: string;
};

export type NoticeFilters = {
	query: string;
	type: 'all' | NoticeType;
	status: 'all' | NoticeStatus;
};

export type NoticeDraft = Omit<Notice, 'id' | 'createdAt'>;

export const PAGE_SIZE = 8;

export const MOCK_NOTICES: Notice[] = [
	{
		id: 'NTC-2031',
		type: 'system',
		title: '8/24(월) 02:00~04:00 정기 서버 점검 안내',
		content:
			'서비스 안정화를 위한 정기 점검이 진행됩니다. 점검 시간 동안 진단 실행 및 로그인 서비스가 일시 중단됩니다.',
		target: 'all',
		isPinned: true,
		isPopup: true,
		status: 'published',
		createdAt: '2026-08-22 18:20',
	},
	{
		id: 'NTC-2030',
		type: 'notice',
		title: 'GEO 정밀진단 리포트 v2 업데이트 안내',
		content:
			'AI 검색 노출 시뮬레이터와 스키마 완전성 체크리스트가 추가되었습니다. 기존 진단 결과는 재실행 시 반영됩니다.',
		target: 'user',
		isPinned: true,
		isPopup: false,
		status: 'published',
		createdAt: '2026-08-21 10:05',
	},
	{
		id: 'NTC-2029',
		type: 'event',
		title: '[이벤트] 무료 진단 크레딧 2배 지급 프로모션',
		content: '8/20~8/31 기간 중 신규 가입 시 무료 진단 크레딧을 2배로 지급합니다.',
		target: 'user',
		isPinned: false,
		isPopup: true,
		status: 'published',
		createdAt: '2026-08-20 09:00',
	},
	{
		id: 'NTC-2028',
		type: 'notice',
		title: '개인정보 처리방침 및 이용약관 개정 안내',
		content: '2026년 9월 1일부터 개정된 개인정보 처리방침이 적용됩니다. 주요 변경사항을 확인해주세요.',
		target: 'all',
		isPinned: false,
		isPopup: false,
		status: 'published',
		createdAt: '2026-08-19 14:40',
	},
	{
		id: 'NTC-2027',
		type: 'system',
		title: 'API 사용량 쿼터 정책 변경 사전 공지 (관리자 전용)',
		content: 'Pro 플랜의 월간 API 쿼터가 조정될 예정입니다. 요금제 페이지 업데이트 전 내부 검토가 필요합니다.',
		target: 'admin',
		isPinned: false,
		isPopup: false,
		status: 'draft',
		createdAt: '2026-08-18 17:12',
	},
	{
		id: 'NTC-2026',
		type: 'notice',
		title: '네이버 블로그 AI 포스팅 기능 베타 오픈',
		content: '네이버 블로그 자동 포스팅 기능이 베타로 오픈되었습니다. 워크스페이스 메뉴에서 확인하세요.',
		target: 'user',
		isPinned: false,
		isPopup: false,
		status: 'draft',
		createdAt: '2026-08-17 11:30',
	},
	{
		id: 'NTC-2025',
		type: 'event',
		title: '[종료] 여름 시즌 Enterprise 플랜 할인 프로모션',
		content: '여름 시즌 프로모션이 종료되었습니다. 참여해주신 고객님께 감사드립니다.',
		target: 'all',
		isPinned: false,
		isPopup: false,
		status: 'archived',
		createdAt: '2026-07-25 08:00',
	},
	{
		id: 'NTC-2024',
		type: 'system',
		title: '7월 장애 복구 완료 및 재발 방지 조치 안내',
		content: '7/18 발생한 크롤링 지연 이슈가 복구되었으며, 재발 방지를 위한 큐 이중화가 적용되었습니다.',
		target: 'all',
		isPinned: false,
		isPopup: false,
		status: 'archived',
		createdAt: '2026-07-19 15:50',
	},
	{
		id: 'NTC-2023',
		type: 'notice',
		title: '고객센터 운영시간 안내 (평일 10:00~18:00)',
		content: '고객센터 운영시간이 평일 오전 10시부터 오후 6시까지로 변경되었습니다.',
		target: 'user',
		isPinned: false,
		isPopup: false,
		status: 'published',
		createdAt: '2026-07-10 09:20',
	},
];

export function cloneNotices(source: Notice[] = MOCK_NOTICES): Notice[] {
	return source.map((notice) => ({ ...notice }));
}

export function filterNotices(notices: Notice[], filters: NoticeFilters): Notice[] {
	const q = filters.query.trim().toLowerCase();
	return notices.filter((notice) => {
		if (filters.type !== 'all' && notice.type !== filters.type) return false;
		if (filters.status !== 'all' && notice.status !== filters.status) return false;
		if (!q) return true;
		return notice.title.toLowerCase().includes(q) || notice.content.toLowerCase().includes(q);
	});
}

export function sortNotices(notices: Notice[], sortKey: NoticeSortKey, direction: SortDirection): Notice[] {
	const sign = direction === 'asc' ? 1 : -1;
	return [...notices].sort((a, b) => {
		if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
		if (sortKey === 'title') return a.title.localeCompare(b.title) * sign;
		return a.createdAt.localeCompare(b.createdAt) * sign;
	});
}

export function paginateNotices<T>(items: T[], page: number, pageSize = PAGE_SIZE): T[] {
	const safePage = Math.max(1, page);
	const start = (safePage - 1) * pageSize;
	return items.slice(start, start + pageSize);
}

export function formatDateTime(value: string): string {
	const normalized = value.includes('T') ? value : value.replace(' ', 'T');
	const date = new Date(normalized);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString('ko-KR', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	});
}

export function nowAsCreatedAt(): string {
	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export const DEFAULT_NOTICE_DRAFT: NoticeDraft = {
	type: 'notice',
	title: '',
	content: '',
	target: 'all',
	isPinned: false,
	isPopup: false,
	status: 'draft',
};
