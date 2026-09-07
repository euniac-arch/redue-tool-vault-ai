import 'server-only';

import { Prisma } from '@prisma/client';
import {
	normalizeSubscriptionPlanId,
	type FetchSubscriptionsResult,
	type SubscriptionFilters,
	type SubscriptionKpi,
	type SubscriptionPayment,
	type SubscriptionPlanId,
	type SubscriptionRow,
	SUBSCRIPTION_PLAN_LABEL,
} from '@/lib/admin/subscription-management';
import { prisma } from '@/lib/prisma';

function isoOrNull(value: Date | null | undefined): string | null {
	return value ? value.toISOString() : null;
}

function latestPaymentStatus(payments: { status: string }[]): SubscriptionRow['status'] {
	const latest = payments[0]?.status?.toUpperCase();
	if (latest === 'DONE' || latest === 'PENDING' || latest === 'CANCELED' || latest === 'FAILED') return latest;
	return 'NONE';
}

export async function buildSubscriptionKpi(): Promise<SubscriptionKpi> {
	const monthStart = new Date();
	monthStart.setDate(1);
	monthStart.setHours(0, 0, 0, 0);

	const [totalMembers, paidMembers, revenue] = await Promise.all([
		prisma.user.count({ where: { status: { not: 'withdrawn' } } }),
		prisma.user.count({
			where: {
				status: { not: 'withdrawn' },
				planId: { in: ['speed', 'pro', 'agency', 'enterprise'] },
			},
		}),
		prisma.payment.aggregate({
			_sum: { amount: true },
			where: { status: 'DONE', createdAt: { gte: monthStart } },
		}),
	]);

	return {
		totalMembers,
		freeMembers: Math.max(0, totalMembers - paidMembers),
		paidMembers,
		monthlyRevenueKrw: revenue._sum.amount ?? 0,
	};
}

export async function querySubscriptions(input: {
	filters: SubscriptionFilters;
	page: number;
	pageSize: number;
}): Promise<FetchSubscriptionsResult> {
	const q = input.filters.query.trim();
	const where: Prisma.UserWhereInput = {
		status: { not: 'withdrawn' },
		...(input.filters.plan !== 'all' ? { planId: input.filters.plan } : {}),
		...(q
			? {
					OR: [{ email: { contains: q } }, { name: { contains: q } }, { id: { contains: q } }],
				}
			: {}),
	};

	const [total, kpi] = await Promise.all([prisma.user.count({ where }), buildSubscriptionKpi()]);
	const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
	const page = Math.min(Math.max(1, input.page), totalPages);

	const users = await prisma.user.findMany({
		where,
		orderBy: { createdAt: 'desc' },
		skip: (page - 1) * input.pageSize,
		take: input.pageSize,
		select: {
			id: true,
			email: true,
			name: true,
			planId: true,
			creditsRemaining: true,
			planRenewsAt: true,
			payments: {
				orderBy: { createdAt: 'desc' },
				take: 8,
				select: {
					id: true,
					planId: true,
					amount: true,
					currency: true,
					provider: true,
					status: true,
					createdAt: true,
				},
			},
		},
	});

	const items: SubscriptionRow[] = users.map((user) => {
		const planId = normalizeSubscriptionPlanId(user.planId);
		const payments: SubscriptionPayment[] = user.payments.map((payment) => ({
			id: payment.id,
			planId: payment.planId,
			amount: payment.amount,
			currency: payment.currency,
			provider: payment.provider,
			status: payment.status,
			createdAt: payment.createdAt.toISOString(),
		}));
		const lastDone = user.payments.find((payment) => payment.status === 'DONE');
		return {
			id: user.id,
			email: user.email || '',
			name: user.name?.trim() || user.email || '회원',
			planId,
			planLabel: SUBSCRIPTION_PLAN_LABEL[planId],
			status: latestPaymentStatus(user.payments),
			creditsRemaining: user.creditsRemaining,
			lastPaidAt: isoOrNull(lastDone?.createdAt),
			planRenewsAt: isoOrNull(user.planRenewsAt),
			totalPaidKrw: user.payments
				.filter((payment) => payment.status === 'DONE')
				.reduce((sum, payment) => sum + payment.amount, 0),
			payments,
		};
	});

	return { items, total, page, pageSize: input.pageSize, totalPages, kpi };
}

export async function updateUserPlan(userId: string, planId: SubscriptionPlanId): Promise<SubscriptionRow | null> {
	const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
	if (!existing) return null;

	await prisma.user.update({
		where: { id: userId },
		data: {
			planId,
			planRenewsAt: planId === 'starter' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		},
	});

	const result = await querySubscriptions({
		filters: { query: userId, plan: 'all' },
		page: 1,
		pageSize: 1,
	});
	return result.items.find((item) => item.id === userId) ?? null;
}
