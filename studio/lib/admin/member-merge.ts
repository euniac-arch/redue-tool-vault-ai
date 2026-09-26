import type { AdminMember, AuthProvider, MemberFilters, MemberSortKey, SortDirection } from '@/lib/admin/user-management';

export type ListedDurableUser = {
	id: string;
	email: string;
	name: string | null;
	phone: string | null;
	role: string;
	planId: string;
	creditsRemaining: number;
	status: string;
	memo: string;
	image: string | null;
	provider: AuthProvider;
	createdAt: string;
	lastLoginAt: string | null;
};

const PLAN_BY_ID: Record<string, AdminMember['plan']> = {
	starter: 'Free',
	speed: 'Pro',
	pro: 'Pro',
	agency: 'Enterprise',
	enterprise: 'Enterprise',
	topup: 'Free',
};

function formatDateTime(value: Date | null | undefined): string {
	if (!value || Number.isNaN(value.getTime())) return '-';
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function normalizeRole(role: string | null | undefined): AdminMember['role'] {
	return (role || '').toLowerCase() === 'admin' ? 'admin' : 'user';
}

function normalizeStatus(status: string | null | undefined): AdminMember['status'] {
	if (status === 'suspended' || status === 'withdrawn') return status;
	return 'active';
}

function membershipToPlanIds(plan: AdminMember['plan']): string[] {
	if (plan === 'Free') return ['starter', 'topup'];
	if (plan === 'Pro') return ['pro', 'speed'];
	return ['agency', 'enterprise'];
}

function creditsTotalForPlan(planId: string, remaining: number): number {
	if (planId === 'agency' || planId === 'enterprise') return Math.max(remaining, 50);
	if (planId === 'pro' || planId === 'speed') return Math.max(remaining, 10);
	return Math.max(remaining, 5);
}

export function memberFromDurableUser(user: ListedDurableUser): AdminMember {
	return {
		id: user.id,
		email: user.email || '',
		name: user.name?.trim() || user.email || '회원',
		profileImage: user.image || '',
		provider: user.provider,
		role: normalizeRole(user.role),
		plan: PLAN_BY_ID[(user.planId || '').toLowerCase()] ?? 'Free',
		credits_remaining: user.creditsRemaining,
		credits_total: creditsTotalForPlan(user.planId, user.creditsRemaining),
		domains_count: 0,
		recent_domain: '-',
		last_audit_score: null,
		last_login_at: formatDateTime(user.lastLoginAt ? new Date(user.lastLoginAt) : null),
		created_at: formatDateTime(new Date(user.createdAt)),
		status: normalizeStatus(user.status),
		memo: user.memo || '',
		signup_ip: '-',
		last_login_ip: '-',
		audit_history: [],
	};
}

export function durableUserMatchesFilters(user: ListedDurableUser, filters: MemberFilters): boolean {
	if (filters.plan !== 'all' && !membershipToPlanIds(filters.plan).includes((user.planId || '').toLowerCase())) {
		return false;
	}
	if (filters.status !== 'all' && normalizeStatus(user.status) !== filters.status) return false;
	if (filters.provider !== 'all' && user.provider !== filters.provider) return false;
	const q = filters.query.trim().toLowerCase();
	if (!q) return true;
	return [user.email, user.name || '', user.id, user.phone || ''].some((value) => value.toLowerCase().includes(q));
}

/** Earlier rows win when the same id or email appears again. */
export function mergeAdminMembers(primary: AdminMember[], extra: AdminMember[]): AdminMember[] {
	const seen = new Set<string>();
	const merged: AdminMember[] = [];
	for (const member of [...primary, ...extra]) {
		const emailKey = member.email.trim().toLowerCase();
		if (seen.has(member.id) || (emailKey && seen.has(`email:${emailKey}`))) continue;
		seen.add(member.id);
		if (emailKey) seen.add(`email:${emailKey}`);
		merged.push(member);
	}
	return merged;
}

export function sortAdminMembers(items: AdminMember[], sortKey: MemberSortKey, sortDir: SortDirection): AdminMember[] {
	const sign = sortDir === 'asc' ? 1 : -1;
	return [...items].sort((a, b) => {
		if (sortKey === 'credits_remaining' && a.credits_remaining !== b.credits_remaining) {
			return (a.credits_remaining - b.credits_remaining) * sign;
		}
		if (sortKey === 'last_audit_score') {
			const aScore = a.last_audit_score ?? Number.NEGATIVE_INFINITY;
			const bScore = b.last_audit_score ?? Number.NEGATIVE_INFINITY;
			if (aScore !== bScore) return (aScore - bScore) * sign;
		}
		if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -sign : sign;
		return a.id.localeCompare(b.id);
	});
}
