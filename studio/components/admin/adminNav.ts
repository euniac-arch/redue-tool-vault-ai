export type AdminNavItem = {
	href: string;
	label: string;
	icon: string;
	exact?: boolean;
	/** Keep `?id=` / `?auditId=` when navigating to this route */
	preserveId?: boolean;
};

export type AdminNavGroup = {
	id: string;
	label: string;
	icon: string;
	items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
	{
		id: 'dashboard',
		label: '대시보드',
		icon: '📌',
		items: [
			{ href: '/admin', label: '통합 현황 대시보드', icon: '📊', exact: true },
			{ href: '/admin/analytics', label: '웹 분석', icon: '📈' },
		],
	},
	{
		id: 'diagnosis',
		label: '진단 & 프로젝트 관리',
		icon: '🔍',
		items: [
			{ href: '/admin/projects', label: '전체 프로젝트 관리', icon: '📂' },
			{ href: '/admin/diagnostics/live', label: '실시간 URL 진단 실행', icon: '⚡' },
			{ href: '/admin/diagnostics', label: '진단 이력 및 리포트 조회', icon: '📑', exact: true },
		],
	},
	{
		id: 'solve',
		label: '해결 워크스페이스',
		icon: '🛠️',
		items: [
			{ href: '/admin/solve', label: '전문가 해결 워크스페이스', icon: '🔧', preserveId: true },
			{ href: '/admin/self-healing', label: 'AI Self-Healing 관리', icon: '🤖', preserveId: true },
			{ href: '/admin/schema-library', label: 'CMS별 주입 코드 라이브러리', icon: '📜' },
			{ href: '/admin/naver-blog', label: '네이버 블로그 AI 포스팅', icon: '📝' },
			{ href: '/admin/guides', label: '맞춤형 실행 가이드', icon: '📘' },
		],
	},
	{
		id: 'crawling',
		label: '사이트 크롤링 관리',
		icon: '🕷️',
		items: [
			{ href: '/admin/crawling/setup', label: '크롤링 실행 / 설정', icon: '⚙️' },
			{ href: '/admin/crawling/list', label: '수집된 데이터 리스트', icon: '📋' },
		],
	},
	{
		id: 'insights',
		label: '인사이트 & 리서치',
		icon: '🌐',
		items: [
			{ href: '/admin/geo-insights', label: 'AI GEO & 스키마 뉴스', icon: '📰' },
			{ href: '/admin/ai-tools', label: '글로벌 AI 도구 디렉토리', icon: '🧰' },
		],
	},
	{
		id: 'members',
		label: '회원 및 이용 관리',
		icon: '👥',
		items: [
			{ href: '/admin/users', label: '회원 관리', icon: '👤' },
			{ href: '/admin/inquiries', label: '작업 문의 관리', icon: '📩' },
			{ href: '/admin/subscriptions', label: '결제 및 구독 플랜 관리', icon: '💳' },
			{ href: '/admin/usage', label: 'API 사용량 및 쿼터 관리', icon: '🎫' },
		],
	},
	{
		id: 'settings',
		label: '시스템 환경설정',
		icon: '⚙️',
		items: [
			{ href: '/admin/api-settings', label: 'API Key & Firebase 연동 설정', icon: '🔑' },
			{ href: '/admin/notices', label: '공지사항 및 시스템 알림', icon: '📢' },
			{ href: '/admin/system-logs', label: '시스템 운영 및 작업 내역', icon: '🗂️' },
			{ href: '/admin/settings/logs', label: '보안 및 접속 로그', icon: '🛡️' },
		],
	},
];

export function buildAdminHref(
	base: string,
	preserveId: boolean | undefined,
	auditId: string | null,
): string {
	if (!preserveId || !auditId) return base;
	const sep = base.includes('?') ? '&' : '?';
	return `${base}${sep}id=${encodeURIComponent(auditId)}`;
}

export function isAdminNavActive(pathname: string, item: AdminNavItem): boolean {
	if (item.exact) return pathname === item.href;
	return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
