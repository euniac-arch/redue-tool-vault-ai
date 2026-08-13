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
		items: [{ href: '/admin', label: '통합 현황 대시보드', icon: '📊', exact: true }],
	},
	{
		id: 'diagnosis',
		label: '진단 & 프로젝트 관리',
		icon: '🔍',
		items: [
			{ href: '/admin/projects', label: '전체 프로젝트 관리', icon: '📂' },
			{ href: '/admin/scan', label: '실시간 URL 진단 실행', icon: '⚡' },
			{ href: '/admin/history', label: '진단 이력 및 리포트 조회', icon: '📑' },
		],
	},
	{
		id: 'solve',
		label: '해결 워크스페이스',
		icon: '🛠️',
		items: [
			{ href: '/admin/solve', label: '전문가 해결 워크스페이스', icon: '🔧', preserveId: true },
			{ href: '/admin/self-healing', label: 'AI Self-Healing 관리', icon: '🤖', preserveId: true },
			{ href: '/admin/code-library', label: 'CMS별 주입 코드 라이브러리', icon: '📜' },
			{ href: '/admin/naver-blog', label: '네이버 블로그 AI 포스팅', icon: '📝' },
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
		id: 'members',
		label: '회원 및 이용 관리',
		icon: '👥',
		items: [
			{ href: '/admin/users', label: '회원 목록 및 권한 관리', icon: '👤' },
			{ href: '/admin/subscriptions', label: '결제 및 구독 플랜 관리', icon: '💳' },
			{ href: '/admin/usage', label: 'API 사용량 및 쿼터 관리', icon: '🎫' },
		],
	},
	{
		id: 'settings',
		label: '시스템 환경설정',
		icon: '⚙️',
		items: [
			{ href: '/admin/settings/api', label: 'API Key & Firebase 설정', icon: '🔑' },
			{ href: '/admin/settings/notices', label: '공지사항 및 시스템 알림', icon: '📢' },
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
