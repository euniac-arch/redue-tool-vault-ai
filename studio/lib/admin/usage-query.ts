import 'server-only';

import { GUEST_MAX_COUNT, USER_FREE_CREDITS } from '@/lib/audit/free-audit-quota';
import {
	computeQuotaStatus,
	computeUsagePercentage,
	type ApiQuotaCallStats,
	type ApiQuotaSnapshot,
	type ApiQuotaUsage,
	type ProductUsageRow,
} from '@/lib/admin/api-quota';
import { AI_SEARCH_DAILY_LIMIT } from '@/lib/insights/insights-ai-usage';
import { prisma } from '@/lib/prisma';

const YOUTUBE_DAILY_MONITOR_LIMIT = 50;

function seoulDateKey(daysAgo = 0): string {
	const now = new Date();
	const seoul = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
	seoul.setDate(seoul.getDate() - daysAgo);
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Seoul',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(seoul);
}

function dayRange(daysAgo = 0): { start: Date; end: Date } {
	const now = new Date();
	const seoul = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
	seoul.setDate(seoul.getDate() - daysAgo);
	seoul.setHours(0, 0, 0, 0);
	const start = new Date(seoul);
	const end = new Date(seoul);
	end.setDate(end.getDate() + 1);
	return { start, end };
}

function monthStart(): Date {
	const { start } = dayRange(0);
	start.setDate(1);
	return start;
}

function quotaRow(
	serviceName: ApiQuotaUsage['serviceName'],
	dailyUsage: number,
	dailyLimit: number,
	monthlyUsage: number,
	monthlyLimit: number,
	lastCalledAt: Date | null,
): ApiQuotaUsage {
	const usagePercentage = Math.max(
		computeUsagePercentage(dailyUsage, dailyLimit),
		computeUsagePercentage(monthlyUsage, monthlyLimit),
	);
	return {
		serviceName,
		dailyUsage,
		dailyLimit,
		monthlyUsage,
		monthlyLimit,
		usagePercentage,
		status: computeQuotaStatus(usagePercentage),
		lastCalledAt: (lastCalledAt ?? new Date()).toISOString(),
	};
}

export async function buildApiQuotaSnapshot(): Promise<ApiQuotaSnapshot> {
	const today = seoulDateKey(0);
	const { start: todayStart, end: todayEnd } = dayRange(0);
	const monthFrom = monthStart();

	const [
		googleToday,
		googleMonth,
		kakaoToday,
		kakaoMonth,
		geminiToday,
		geminiMonth,
		auditToday,
		auditMonth,
		productRows,
		recentAudit,
		recentUsage,
	] = await Promise.all([
		prisma.account.count({ where: { provider: 'google', user: { createdAt: { gte: todayStart, lt: todayEnd } } } }),
		prisma.account.count({ where: { provider: 'google', user: { createdAt: { gte: monthFrom } } } }),
		prisma.account.count({ where: { provider: 'kakao', user: { createdAt: { gte: todayStart, lt: todayEnd } } } }),
		prisma.account.count({ where: { provider: 'kakao', user: { createdAt: { gte: monthFrom } } } }),
		prisma.dailyApiUsage.aggregate({
			_sum: { count: true },
			where: { dateKey: today, service: 'ai_research' },
		}),
		prisma.dailyApiUsage.aggregate({
			_sum: { count: true },
			where: { service: 'ai_research', dateKey: { gte: seoulDateKey(31) } },
		}),
		prisma.auditLead.count({ where: { createdAt: { gte: todayStart, lt: todayEnd } } }),
		prisma.auditLead.count({ where: { createdAt: { gte: monthFrom } } }),
		prisma.dailyApiUsage.findMany({ where: { dateKey: today } }),
		prisma.auditLead.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
		prisma.apiUsageLog.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
	]);

	const sumProduct = (service: string, actorType?: string) =>
		productRows
			.filter((row) => row.service === service && (!actorType || row.actorType === actorType))
			.reduce((sum, row) => sum + row.count, 0);

	const productUsage: ProductUsageRow[] = [
		{
			service: 'ai_research',
			label: 'AI 리서치',
			memberDaily: sumProduct('ai_research', 'member'),
			guestDaily: sumProduct('ai_research', 'guest'),
			memberLimit: AI_SEARCH_DAILY_LIMIT,
			guestLimit: 0,
			memberRemaining: Math.max(0, AI_SEARCH_DAILY_LIMIT - sumProduct('ai_research', 'member')),
			guestRemaining: 0,
		},
		{
			service: 'youtube_search',
			label: '유튜브 검색',
			memberDaily: sumProduct('youtube_search', 'member'),
			guestDaily: sumProduct('youtube_search', 'guest'),
			memberLimit: YOUTUBE_DAILY_MONITOR_LIMIT,
			guestLimit: YOUTUBE_DAILY_MONITOR_LIMIT,
			memberRemaining: Math.max(0, YOUTUBE_DAILY_MONITOR_LIMIT - sumProduct('youtube_search', 'member')),
			guestRemaining: Math.max(0, YOUTUBE_DAILY_MONITOR_LIMIT - sumProduct('youtube_search', 'guest')),
		},
		{
			service: 'audit',
			label: '진단 API',
			memberDaily: sumProduct('audit', 'member') || auditToday,
			guestDaily: sumProduct('audit', 'guest'),
			memberLimit: USER_FREE_CREDITS,
			guestLimit: GUEST_MAX_COUNT,
			memberRemaining: Math.max(0, USER_FREE_CREDITS - (sumProduct('audit', 'member') || auditToday)),
			guestRemaining: Math.max(0, GUEST_MAX_COUNT - sumProduct('audit', 'guest')),
		},
	];

	const lastInfra = recentUsage?.createdAt ?? recentAudit?.createdAt ?? new Date();
	const quotas: ApiQuotaUsage[] = [
		quotaRow('Google OAuth', googleToday, 10_000, googleMonth, 300_000, lastInfra),
		quotaRow('Kakao Login', kakaoToday, 5_000, kakaoMonth, 150_000, lastInfra),
		quotaRow(
			'Gemini API',
			geminiToday._sum.count ?? 0,
			2_000,
			geminiMonth._sum.count ?? 0,
			60_000,
			lastInfra,
		),
		quotaRow('Translation API', auditToday, 50_000, auditMonth, 1_500_000, recentAudit?.createdAt ?? lastInfra),
	];

	const weekKeys = Array.from({ length: 7 }, (_, idx) => seoulDateKey(6 - idx));
	const weekRows = await prisma.dailyApiUsage.findMany({
		where: { dateKey: { in: weekKeys } },
	});
	const weekAudit = await prisma.auditLead.findMany({
		where: { createdAt: { gte: dayRange(6).start } },
		select: { createdAt: true },
	});

	const callStats: ApiQuotaCallStats[] = quotas.map((quota) => {
		const daily = weekKeys.map((key) => {
			const [y, m, d] = key.split('-').map(Number);
			const calls =
				quota.serviceName === 'Translation API'
					? weekAudit.filter((lead) => {
							const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(lead.createdAt);
							return stamp === key;
						}).length
					: weekRows
							.filter((row) => {
								if (row.dateKey !== key) return false;
								if (quota.serviceName === 'Gemini API') return row.service === 'ai_research';
								return false;
							})
							.reduce((sum, row) => sum + row.count, 0);
			return { date: `${m}/${d}`, calls };
		});
		const hourlyTotal = quota.dailyUsage;
		const hourly = Array.from({ length: 12 }, (_, idx) => {
			const hour = new Date(Date.now() - (11 - idx) * 60 * 60 * 1000).getHours();
			return { hour: `${String(hour).padStart(2, '0')}:00`, calls: Math.round(hourlyTotal / 12) };
		});
		return { serviceName: quota.serviceName, hourly, daily };
	});

	return {
		quotas,
		callStats,
		productUsage,
		generatedAt: new Date().toISOString(),
	};
}
