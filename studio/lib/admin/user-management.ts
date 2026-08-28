export type AuthProvider = 'email' | 'kakao' | 'google' | 'naver';
export type MembershipPlan = 'Free' | 'Pro' | 'Enterprise';
export type MemberRole = 'user' | 'admin';
/** active(정상) / suspended(정지) / withdrawn(탈퇴). */
export type MemberStatus = 'active' | 'suspended' | 'withdrawn';
export type MemberSortKey = 'created_at' | 'credits_remaining' | 'last_audit_score';
export type SortDirection = 'asc' | 'desc';

export type AuditHistoryRow = {
	id: string;
	domain: string;
	auditedAt: string;
	overallScore: number;
	track1TechScore: number;
	track2GeoScore: number;
};

/**
 * Admin-facing member record. Mirrors the shape the real backend will
 * eventually return from `GET /api/admin/users` once Kakao/Google OAuth is
 * wired to Prisma (see `studio/lib/admin/users-service.ts` for the swap
 * point). `name` / `profileImage` / `role` / `status` map 1:1 to the future
 * `User` table columns backing social login.
 */
export type AdminMember = {
	id: string;
	email: string;
	name: string;
	/** Empty string means "no avatar" — UI should fall back to a default avatar. */
	profileImage: string;
	provider: AuthProvider;
	role: MemberRole;
	plan: MembershipPlan;
	credits_remaining: number;
	credits_total: number;
	domains_count: number;
	recent_domain: string;
	last_audit_score: number | null;
	/** `YYYY-MM-DD HH:mm` */
	last_login_at: string;
	/** `YYYY-MM-DD HH:mm` */
	created_at: string;
	status: MemberStatus;
	memo: string;
	signup_ip: string;
	last_login_ip: string;
	audit_history: AuditHistoryRow[];
};

export type MemberFilters = {
	query: string;
	plan: 'all' | MembershipPlan;
	provider: 'all' | AuthProvider;
	status: 'all' | MemberStatus;
};

export const DEFAULT_AVATAR_URL = '';

export function resolveAvatarUrl(member: Pick<AdminMember, 'profileImage'>): string {
	return member.profileImage || DEFAULT_AVATAR_URL;
}

export type UserKpiSummary = {
	totalMembers: number;
	totalMembersDeltaPct: number;
	todaySignups: number;
	todaySignupsByProvider: { email: number; kakao: number; google: number };
	todayAudits: number;
	paidActiveUsers: number;
};

export const PAGE_SIZE = 10;

export const USER_KPI_MOCK: UserKpiSummary = {
	totalMembers: 1240,
	totalMembersDeltaPct: 12,
	todaySignups: 18,
	todaySignupsByProvider: { email: 10, kakao: 6, google: 2 },
	todayAudits: 142,
	paidActiveUsers: 184,
};

export const MOCK_ADMIN_MEMBERS: AdminMember[] = [
	{
		id: 'USR-1024',
		email: 'dr.bae@nineoneclinic.com',
		name: '배준혁',
		profileImage: 'https://i.pravatar.cc/100?img=12',
		provider: 'email',
		role: 'user',
		plan: 'Pro',
		credits_remaining: 42,
		credits_total: 50,
		domains_count: 2,
		recent_domain: 'nineoneclinic.com',
		last_audit_score: 78,
		last_login_at: '2026-08-22 15:30:12',
		created_at: '2026-08-10 09:14',
		status: 'active',
		memo: '대구 메리어트 나인원의원 운영 계정 / 스키마 v2 적용 완료',
		signup_ip: '211.216.48.12',
		last_login_ip: '211.216.48.19',
		audit_history: [
			{
				id: 'AUD-91024-3',
				domain: 'nineoneclinic.com',
				auditedAt: '2026-08-22 14:08:21',
				overallScore: 78,
				track1TechScore: 81,
				track2GeoScore: 74,
			},
			{
				id: 'AUD-91024-2',
				domain: 'nineoneclinic.com',
				auditedAt: '2026-08-18 11:22:03',
				overallScore: 71,
				track1TechScore: 76,
				track2GeoScore: 66,
			},
			{
				id: 'AUD-91024-1',
				domain: 'marriott-nineone.co.kr',
				auditedAt: '2026-08-12 09:40:55',
				overallScore: 64,
				track1TechScore: 70,
				track2GeoScore: 58,
			},
		],
	},
	{
		id: 'USR-1025',
		email: 'seo_master@kakao.com',
		name: '박서준',
		profileImage: 'https://i.pravatar.cc/100?img=33',
		provider: 'kakao',
		role: 'user',
		plan: 'Enterprise',
		credits_remaining: 185,
		credits_total: 300,
		domains_count: 8,
		recent_domain: 'gentle-amc.co.kr',
		last_audit_score: 86,
		last_login_at: '2026-08-22 16:45:00',
		created_at: '2026-08-12 10:02',
		status: 'active',
		memo: '병원 전문 마케팅 대행사 계정',
		signup_ip: '121.167.22.40',
		last_login_ip: '121.167.22.88',
		audit_history: [
			{
				id: 'AUD-91025-4',
				domain: 'gentle-amc.co.kr',
				auditedAt: '2026-08-22 16:12:40',
				overallScore: 86,
				track1TechScore: 88,
				track2GeoScore: 84,
			},
			{
				id: 'AUD-91025-3',
				domain: 'seoul-eye.clinic',
				auditedAt: '2026-08-21 10:04:11',
				overallScore: 82,
				track1TechScore: 85,
				track2GeoScore: 79,
			},
			{
				id: 'AUD-91025-2',
				domain: 'banobagi-partner.kr',
				auditedAt: '2026-08-19 18:31:07',
				overallScore: 79,
				track1TechScore: 80,
				track2GeoScore: 77,
			},
		],
	},
	{
		id: 'USR-1026',
		email: 'growth_hacker@gmail.com',
		name: '최다인',
		profileImage: 'https://i.pravatar.cc/100?img=47',
		provider: 'google',
		role: 'user',
		plan: 'Free',
		credits_remaining: 1,
		credits_total: 5,
		domains_count: 1,
		recent_domain: 'startup-studio.io',
		last_audit_score: 52,
		last_login_at: '2026-08-21 09:12:40',
		created_at: '2026-08-18 21:40',
		status: 'active',
		memo: '무료 플랜 소진 후 Pro 전환 대기',
		signup_ip: '35.216.88.14',
		last_login_ip: '35.216.88.14',
		audit_history: [
			{
				id: 'AUD-91026-1',
				domain: 'startup-studio.io',
				auditedAt: '2026-08-21 09:04:18',
				overallScore: 52,
				track1TechScore: 61,
				track2GeoScore: 41,
			},
		],
	},
	{
		id: 'USR-1027',
		email: 'abuser_bot@tempmail.com',
		name: '익명 사용자',
		profileImage: '',
		provider: 'email',
		role: 'user',
		plan: 'Free',
		credits_remaining: 0,
		credits_total: 5,
		domains_count: 0,
		recent_domain: '-',
		last_audit_score: null,
		last_login_at: '2026-08-19 23:01:11',
		created_at: '2026-08-19 22:58',
		status: 'suspended',
		memo: '다중 IP 진단 어뷰징 감지로 계정 일시 정지',
		signup_ip: '185.220.101.44',
		last_login_ip: '45.134.140.22',
		audit_history: [],
	},
	{
		id: 'USR-1028',
		email: 'clinic_admin@seoul-plastic.com',
		name: '김도현',
		profileImage: 'https://i.pravatar.cc/100?img=15',
		provider: 'email',
		role: 'user',
		plan: 'Pro',
		credits_remaining: 27,
		credits_total: 50,
		domains_count: 3,
		recent_domain: 'seoul-plastic.com',
		last_audit_score: 73,
		last_login_at: '2026-08-22 11:08:33',
		created_at: '2026-08-08 13:26',
		status: 'active',
		memo: '강남 성형외과 그룹 본원 계정',
		signup_ip: '211.45.12.90',
		last_login_ip: '211.45.12.91',
		audit_history: [
			{
				id: 'AUD-91028-2',
				domain: 'seoul-plastic.com',
				auditedAt: '2026-08-22 10:51:02',
				overallScore: 73,
				track1TechScore: 75,
				track2GeoScore: 70,
			},
			{
				id: 'AUD-91028-1',
				domain: 'gangnam-ps.kr',
				auditedAt: '2026-08-14 16:20:44',
				overallScore: 68,
				track1TechScore: 72,
				track2GeoScore: 63,
			},
		],
	},
	{
		id: 'USR-1029',
		email: 'agency.lead@naver.com',
		name: '이하늘',
		profileImage: 'https://i.pravatar.cc/100?img=25',
		provider: 'naver',
		role: 'user',
		plan: 'Enterprise',
		credits_remaining: 240,
		credits_total: 300,
		domains_count: 12,
		recent_domain: 'medi-growth.kr',
		last_audit_score: 91,
		last_login_at: '2026-08-22 17:02:18',
		created_at: '2026-07-29 08:47',
		status: 'active',
		memo: '메디컬 퍼포먼스 대행사 — 월간 리포트 자동 발송',
		signup_ip: '1.233.88.19',
		last_login_ip: '1.233.88.41',
		audit_history: [
			{
				id: 'AUD-91029-2',
				domain: 'medi-growth.kr',
				auditedAt: '2026-08-22 16:50:09',
				overallScore: 91,
				track1TechScore: 93,
				track2GeoScore: 89,
			},
			{
				id: 'AUD-91029-1',
				domain: 'yeouido-imc.com',
				auditedAt: '2026-08-20 13:11:27',
				overallScore: 87,
				track1TechScore: 90,
				track2GeoScore: 83,
			},
		],
	},
	{
		id: 'USR-1030',
		email: 'intern@startup-studio.io',
		name: '정유진',
		profileImage: 'https://i.pravatar.cc/100?img=41',
		provider: 'google',
		role: 'user',
		plan: 'Free',
		credits_remaining: 3,
		credits_total: 5,
		domains_count: 1,
		recent_domain: 'startup-studio.io',
		last_audit_score: 48,
		last_login_at: '2026-08-20 19:44:02',
		created_at: '2026-08-20 19:02',
		status: 'active',
		memo: '성장해커 서브 계정 — 크레딧 공유 여부 확인 필요',
		signup_ip: '35.216.88.22',
		last_login_ip: '35.216.88.22',
		audit_history: [
			{
				id: 'AUD-91030-1',
				domain: 'startup-studio.io',
				auditedAt: '2026-08-20 19:40:11',
				overallScore: 48,
				track1TechScore: 55,
				track2GeoScore: 39,
			},
		],
	},
	{
		id: 'USR-1031',
		email: 'billing@gentle-amc.co.kr',
		name: '한소희',
		profileImage: 'https://i.pravatar.cc/100?img=29',
		provider: 'email',
		role: 'user',
		plan: 'Pro',
		credits_remaining: 9,
		credits_total: 50,
		domains_count: 2,
		recent_domain: 'gentle-amc.co.kr',
		last_audit_score: 81,
		last_login_at: '2026-08-21 14:26:55',
		created_at: '2026-08-05 11:19',
		status: 'active',
		memo: '엔터프라이즈 하위 결제 담당 — Pro 유지',
		signup_ip: '210.101.44.8',
		last_login_ip: '210.101.44.8',
		audit_history: [
			{
				id: 'AUD-91031-1',
				domain: 'gentle-amc.co.kr',
				auditedAt: '2026-08-21 14:18:40',
				overallScore: 81,
				track1TechScore: 84,
				track2GeoScore: 77,
			},
		],
	},
	{
		id: 'USR-1032',
		email: 'paused.user@outlook.com',
		name: '오민석',
		profileImage: 'https://i.pravatar.cc/100?img=52',
		provider: 'email',
		role: 'user',
		plan: 'Free',
		credits_remaining: 0,
		credits_total: 5,
		domains_count: 1,
		recent_domain: 'paused-lab.net',
		last_audit_score: 44,
		last_login_at: '2026-08-11 08:03:19',
		created_at: '2026-08-02 09:55',
		status: 'suspended',
		memo: '결제 실패 후 미응답 — 수동 정지',
		signup_ip: '39.7.18.201',
		last_login_ip: '39.7.18.201',
		audit_history: [
			{
				id: 'AUD-91032-1',
				domain: 'paused-lab.net',
				auditedAt: '2026-08-11 07:55:02',
				overallScore: 44,
				track1TechScore: 50,
				track2GeoScore: 36,
			},
		],
	},
	{
		id: 'USR-1033',
		email: 'geo.ops@redue.ai',
		name: 'REDUE Ops',
		profileImage: 'https://i.pravatar.cc/100?img=68',
		provider: 'google',
		role: 'admin',
		plan: 'Enterprise',
		credits_remaining: 298,
		credits_total: 300,
		domains_count: 4,
		recent_domain: 'redue.ai',
		last_audit_score: 94,
		last_login_at: '2026-08-22 13:15:47',
		created_at: '2026-07-15 07:30',
		status: 'active',
		memo: '내부 QA / GEO 엔진 스테이징 계정',
		signup_ip: '13.125.44.10',
		last_login_ip: '13.125.44.10',
		audit_history: [
			{
				id: 'AUD-91033-2',
				domain: 'redue.ai',
				auditedAt: '2026-08-22 13:10:05',
				overallScore: 94,
				track1TechScore: 96,
				track2GeoScore: 92,
			},
			{
				id: 'AUD-91033-1',
				domain: 'studio.redue.ai',
				auditedAt: '2026-08-16 09:00:00',
				overallScore: 90,
				track1TechScore: 92,
				track2GeoScore: 88,
			},
		],
	},
	{
		id: 'USR-1034',
		email: 'content@nineoneclinic.com',
		name: '윤서연',
		profileImage: 'https://i.pravatar.cc/100?img=44',
		provider: 'email',
		role: 'user',
		plan: 'Pro',
		credits_remaining: 18,
		credits_total: 50,
		domains_count: 1,
		recent_domain: 'nineoneclinic.com',
		last_audit_score: 76,
		last_login_at: '2026-08-21 21:09:30',
		created_at: '2026-08-11 16:03',
		status: 'active',
		memo: '원장 계정 하위 콘텐츠 담당',
		signup_ip: '211.216.48.20',
		last_login_ip: '211.216.48.20',
		audit_history: [
			{
				id: 'AUD-91034-1',
				domain: 'nineoneclinic.com',
				auditedAt: '2026-08-21 20:58:14',
				overallScore: 76,
				track1TechScore: 79,
				track2GeoScore: 72,
			},
		],
	},
	{
		id: 'USR-1035',
		email: 'trial@temp-agency.kr',
		name: '강태오',
		profileImage: '',
		provider: 'kakao',
		role: 'user',
		plan: 'Free',
		credits_remaining: 4,
		credits_total: 5,
		domains_count: 1,
		recent_domain: 'temp-agency.kr',
		last_audit_score: 59,
		last_login_at: '2026-08-22 08:22:01',
		created_at: '2026-08-21 22:11',
		status: 'active',
		memo: '체험 유입 — 온보딩 콜 예정',
		signup_ip: '175.223.44.66',
		last_login_ip: '175.223.44.66',
		audit_history: [
			{
				id: 'AUD-91035-1',
				domain: 'temp-agency.kr',
				auditedAt: '2026-08-22 08:16:40',
				overallScore: 59,
				track1TechScore: 64,
				track2GeoScore: 53,
			},
		],
	},
	{
		id: 'USR-1036',
		email: 'left.member@gmail.com',
		name: '조은비',
		profileImage: 'https://i.pravatar.cc/100?img=5',
		provider: 'google',
		role: 'user',
		plan: 'Free',
		credits_remaining: 0,
		credits_total: 5,
		domains_count: 0,
		recent_domain: '-',
		last_audit_score: null,
		last_login_at: '2026-08-05 10:12:40',
		created_at: '2026-07-20 14:33',
		status: 'withdrawn',
		memo: '본인 요청으로 회원 탈퇴 처리 완료',
		signup_ip: '182.220.14.71',
		last_login_ip: '182.220.14.71',
		audit_history: [],
	},
];

export function cloneMembers(source: AdminMember[] = MOCK_ADMIN_MEMBERS): AdminMember[] {
	return source.map((member) => ({
		...member,
		audit_history: member.audit_history.map((row) => ({ ...row })),
	}));
}

export function filterMembers(members: AdminMember[], filters: MemberFilters): AdminMember[] {
	const q = filters.query.trim().toLowerCase();
	return members.filter((member) => {
		if (filters.plan !== 'all' && member.plan !== filters.plan) return false;
		if (filters.provider !== 'all' && member.provider !== filters.provider) return false;
		if (filters.status !== 'all' && member.status !== filters.status) return false;
		if (!q) return true;
		return (
			member.email.toLowerCase().includes(q) ||
			member.name.toLowerCase().includes(q) ||
			member.recent_domain.toLowerCase().includes(q) ||
			member.id.toLowerCase().includes(q)
		);
	});
}

function scoreValue(score: number | null): number {
	return score ?? Number.NEGATIVE_INFINITY;
}

export function sortMembers(
	members: AdminMember[],
	sortKey: MemberSortKey,
	direction: SortDirection,
): AdminMember[] {
	const sign = direction === 'asc' ? 1 : -1;
	return [...members].sort((a, b) => {
		if (sortKey === 'created_at') {
			return a.created_at.localeCompare(b.created_at) * sign;
		}
		if (sortKey === 'credits_remaining') {
			return (a.credits_remaining - b.credits_remaining) * sign;
		}
		const aScore = scoreValue(a.last_audit_score);
		const bScore = scoreValue(b.last_audit_score);
		if (aScore === bScore) return a.id.localeCompare(b.id);
		return (aScore - bScore) * sign;
	});
}

export function paginateMembers<T>(items: T[], page: number, pageSize = PAGE_SIZE): T[] {
	const safePage = Math.max(1, page);
	const start = (safePage - 1) * pageSize;
	return items.slice(start, start + pageSize);
}

export function applyCreditDelta(member: AdminMember, delta: number): AdminMember {
	const nextRemaining = Math.max(0, member.credits_remaining + delta);
	const nextTotal = Math.max(member.credits_total, nextRemaining);
	return { ...member, credits_remaining: nextRemaining, credits_total: nextTotal };
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

export function formatDate(value: string): string {
	const [datePart] = value.split(' ');
	const date = new Date(`${datePart}T00:00:00`);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function creditRatio(member: AdminMember): number {
	if (member.credits_total <= 0) return 0;
	return Math.min(100, Math.round((member.credits_remaining / member.credits_total) * 100));
}

export function scoreTone(score: number | null): 'empty' | 'low' | 'mid' | 'high' {
	if (score == null) return 'empty';
	if (score >= 80) return 'high';
	if (score >= 60) return 'mid';
	return 'low';
}

export const PAGE_SIZE_OPTIONS = [10, 20] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
