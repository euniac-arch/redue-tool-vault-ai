import 'server-only';

import { Prisma } from '@prisma/client';
import {
	type AdminMember,
	type AuthProvider,
	type MemberFilters,
	type MemberRole,
	type MemberSortKey,
	type MemberStatus,
	type MembershipPlan,
	type SortDirection,
	type UserKpiSummary,
} from '@/lib/admin/user-management';
import { prisma } from '@/lib/prisma';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import {
	durableUserMatchesFilters,
	memberFromDurableUser,
	mergeAdminMembers,
	sortAdminMembers,
} from '@/lib/admin/member-merge';
import {
	findDurableUserById,
	listDurableUsers,
	type DurableAppUser,
} from '@/lib/server/app-users';

const PLAN_BY_ID: Record<string, MembershipPlan> = {
	starter: 'Free',
	speed: 'Pro',
	pro: 'Pro',
	agency: 'Enterprise',
	enterprise: 'Enterprise',
	topup: 'Free',
};

export function mapPlanIdToMembership(planId: string | null | undefined): MembershipPlan {
	return PLAN_BY_ID[(planId || '').toLowerCase()] ?? 'Free';
}

export function membershipToPlanIds(plan: MembershipPlan): string[] {
	if (plan === 'Free') return ['starter', 'topup'];
	if (plan === 'Pro') return ['pro', 'speed'];
	return ['agency', 'enterprise'];
}

function formatDateTime(value: Date | null | undefined): string {
	if (!value) return '-';
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function normalizeRole(role: string | null | undefined): MemberRole {
	return (role || '').toLowerCase() === 'admin' ? 'admin' : 'user';
}

function normalizeStatus(status: string | null | undefined): MemberStatus {
	if (status === 'suspended' || status === 'withdrawn') return status;
	return 'active';
}

function providerFromAccounts(accounts: { provider: string }[], hasPassword: boolean): AuthProvider {
	const providers = new Set(accounts.map((account) => account.provider.toLowerCase()));
	if (providers.has('kakao')) return 'kakao';
	if (providers.has('google')) return 'google';
	if (providers.has('naver')) return 'naver';
	if (hasPassword || providers.has('credentials')) return 'email';
	return 'email';
}

function creditsTotalForPlan(planId: string, remaining: number): number {
	if (planId === 'agency' || planId === 'enterprise') return Math.max(remaining, 50);
	if (planId === 'pro' || planId === 'speed') return Math.max(remaining, 10);
	return Math.max(remaining, 5);
}

type UserWithRelations = Prisma.UserGetPayload<{
	include: {
		accounts: { select: { provider: true } };
		auditReports: {
			select: { id: true; domain: true; createdAt: true; score: true; reportJson: true };
			orderBy: { createdAt: 'desc' };
			take: 8;
		};
	};
}>;

function scoreFromReportJson(reportJson: string, fallback: number): { tech: number; geo: number } {
	try {
		const parsed = JSON.parse(reportJson) as {
			track1?: { score?: number };
			track2?: { score?: number };
			seoScore?: number;
			geoScore?: number;
		};
		return {
			tech: Number(parsed.track1?.score ?? parsed.seoScore ?? fallback) || fallback,
			geo: Number(parsed.track2?.score ?? parsed.geoScore ?? fallback) || fallback,
		};
	} catch {
		return { tech: fallback, geo: fallback };
	}
}

export function toAdminMember(user: UserWithRelations): AdminMember {
	const latest = user.auditReports[0] ?? null;
	const domains = [...new Set(user.auditReports.map((row) => row.domain).filter(Boolean))];
	return {
		id: user.id,
		email: user.email || '',
		name: user.name?.trim() || user.email || '회원',
		profileImage: user.image || '',
		provider: providerFromAccounts(user.accounts, Boolean(user.passwordHash)),
		role: normalizeRole(user.role),
		plan: mapPlanIdToMembership(user.planId),
		credits_remaining: user.creditsRemaining,
		credits_total: creditsTotalForPlan(user.planId, user.creditsRemaining),
		domains_count: domains.length,
		recent_domain: latest?.domain || '-',
		last_audit_score: latest?.score ?? null,
		last_login_at: formatDateTime(user.lastLoginAt),
		created_at: formatDateTime(user.createdAt),
		status: normalizeStatus(user.status),
		memo: user.memo || '',
		signup_ip: '-',
		last_login_ip: '-',
		audit_history: user.auditReports.map((row) => {
			const scores = scoreFromReportJson(row.reportJson, row.score);
			return {
				id: row.id,
				domain: row.domain,
				auditedAt: formatDateTime(row.createdAt),
				overallScore: row.score,
				track1TechScore: scores.tech,
				track2GeoScore: scores.geo,
			};
		}),
	};
}

const USER_INCLUDE = {
	accounts: { select: { provider: true } },
	auditReports: {
		select: { id: true, domain: true, createdAt: true, score: true, reportJson: true },
		orderBy: { createdAt: 'desc' as const },
		take: 8,
	},
};

export async function findAdminMember(id: string): Promise<AdminMember | null> {
	const user = await prisma.user.findUnique({ where: { id }, include: USER_INCLUDE });
	if (user) return toAdminMember(user);
	if (!isFirebaseAdminConfigured()) return null;
	const durable = await findDurableUserById(id);
	return durable ? memberFromDurableUser(durable) : null;
}

function seoulDayRange(daysAgo = 0): { start: Date; end: Date } {
	const now = new Date();
	const seoul = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
	seoul.setDate(seoul.getDate() - daysAgo);
	seoul.setHours(0, 0, 0, 0);
	const start = new Date(seoul);
	const end = new Date(seoul);
	end.setDate(end.getDate() + 1);
	return { start, end };
}

export async function buildUserKpi(): Promise<UserKpiSummary> {
	const thisMonthStart = new Date();
	thisMonthStart.setDate(1);
	thisMonthStart.setHours(0, 0, 0, 0);
	const lastMonthStart = new Date(thisMonthStart);
	lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
	const { start: todayStart, end: todayEnd } = seoulDayRange(0);

	const [totalMembers, lastMonthMembers, todayUsers, todayAudits, paidActiveUsers] = await Promise.all([
		prisma.user.count({ where: { status: { not: 'withdrawn' } } }),
		prisma.user.count({
			where: { createdAt: { lt: thisMonthStart, gte: lastMonthStart }, status: { not: 'withdrawn' } },
		}),
		prisma.user.findMany({
			where: { createdAt: { gte: todayStart, lt: todayEnd } },
			select: { passwordHash: true, accounts: { select: { provider: true } } },
		}),
		prisma.auditLead.count({ where: { createdAt: { gte: todayStart, lt: todayEnd } } }),
		prisma.user.count({
			where: {
				status: 'active',
				planId: { in: ['pro', 'agency', 'enterprise', 'speed'] },
			},
		}),
	]);

	const todaySignupsByProvider = { email: 0, kakao: 0, google: 0 };
	for (const user of todayUsers) {
		const providers = new Set(user.accounts.map((account) => account.provider.toLowerCase()));
		if (providers.has('kakao')) todaySignupsByProvider.kakao += 1;
		else if (providers.has('google')) todaySignupsByProvider.google += 1;
		else todaySignupsByProvider.email += 1;
	}

	const lastMonthTotal = lastMonthMembers;
	const durableExtras = await durableUsersMissingFromPrisma();
	const extraActive = durableExtras.filter((user) => user.status !== 'withdrawn');
	const extraToday = extraActive.filter((user) => {
		const created = new Date(user.createdAt);
		return created >= todayStart && created < todayEnd;
	});
	const total = totalMembers + extraActive.length;
	const totalMembersDeltaPct =
		lastMonthTotal > 0 ? Math.round(((total - lastMonthTotal) / lastMonthTotal) * 100) : total > 0 ? 100 : 0;

	for (const user of extraToday) {
		if (user.provider === 'kakao') todaySignupsByProvider.kakao += 1;
		else if (user.provider === 'google') todaySignupsByProvider.google += 1;
		else todaySignupsByProvider.email += 1;
	}

	return {
		totalMembers: total,
		totalMembersDeltaPct,
		todaySignups: todayUsers.length + extraToday.length,
		todaySignupsByProvider,
		todayAudits,
		paidActiveUsers:
			paidActiveUsers +
			extraActive.filter((user) => ['pro', 'agency', 'enterprise', 'speed'].includes(user.planId)).length,
	};
}

export async function queryAdminMembers(input: {
	filters: MemberFilters;
	sortKey: MemberSortKey;
	sortDir: SortDirection;
	page: number;
	pageSize: number;
}): Promise<{ items: AdminMember[]; total: number; page: number; pageSize: number; totalPages: number }> {
	const q = input.filters.query.trim();
	const where: Prisma.UserWhereInput = {};

	if (input.filters.plan !== 'all') {
		where.planId = { in: membershipToPlanIds(input.filters.plan) };
	}
	if (input.filters.status !== 'all') {
		where.status = input.filters.status;
	}
	if (input.filters.provider !== 'all') {
		if (input.filters.provider === 'email') {
			where.OR = [{ accounts: { none: {} } }, { accounts: { some: { provider: 'credentials' } } }];
		} else {
			where.accounts = { some: { provider: input.filters.provider } };
		}
	}
	if (q) {
		where.AND = [
			...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
			{
				OR: [
					{ email: { contains: q } },
					{ name: { contains: q } },
					{ id: { contains: q } },
					{ auditReports: { some: { domain: { contains: q } } } },
				],
			},
		];
	}

	const orderBy: Prisma.UserOrderByWithRelationInput =
		input.sortKey === 'credits_remaining'
			? { creditsRemaining: input.sortDir }
			: { createdAt: input.sortDir };

	const prismaUsers = await prisma.user.findMany({
		where,
		include: USER_INCLUDE,
		orderBy,
	});
	let items = prismaUsers.map(toAdminMember);

	if (isFirebaseAdminConfigured()) {
		try {
			const known = await prisma.user.findMany({ select: { id: true, email: true } });
			const knownIds = new Set(known.map((user) => user.id));
			const knownEmails = new Set(known.map((user) => (user.email || '').trim().toLowerCase()).filter(Boolean));
			const extras = (await listDurableUsers())
				.filter((user) => !knownIds.has(user.id) && !knownEmails.has(user.email.toLowerCase()))
				.filter((user) => durableUserMatchesFilters(user, input.filters))
				.map(memberFromDurableUser);
			items = mergeAdminMembers(items, extras);
		} catch (error) {
			console.error('[admin/users] shared member list failed', error);
		}
	}

	items = sortAdminMembers(items, input.sortKey, input.sortDir);

	const total = items.length;
	const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
	const page = Math.min(Math.max(1, input.page), totalPages);
	const start = (page - 1) * input.pageSize;
	return {
		items: items.slice(start, start + input.pageSize),
		total,
		page,
		pageSize: input.pageSize,
		totalPages,
	};
}

async function durableUsersMissingFromPrisma(): Promise<DurableAppUser[]> {
	if (!isFirebaseAdminConfigured()) return [];
	try {
		const known = await prisma.user.findMany({ select: { id: true, email: true } });
		const knownIds = new Set(known.map((user) => user.id));
		const knownEmails = new Set(known.map((user) => (user.email || '').trim().toLowerCase()).filter(Boolean));
		return (await listDurableUsers()).filter(
			(user) => !knownIds.has(user.id) && !knownEmails.has(user.email.toLowerCase()),
		);
	} catch (error) {
		console.error('[admin/users] shared member kpi failed', error);
		return [];
	}
}
