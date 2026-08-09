import { USD_TO_KRW } from './llm-pricing';
import { prisma } from './prisma';
import type { DiagnosticReport } from './types';

function startOfMonth(): Date {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), 1);
}

export interface AdminOverview {
	totalMembers: number;
	monthlyRevenueKrw: number;
	monthlyApiCostUsd: number;
	monthlyApiCostKrw: number;
	netMarginPercent: number;
	usdToKrw: number;
}

/** 순수익률 = (이번 달 매출액 - 이번 달 API 비용을 원화로 환산한 값) / 매출액 * 100. */
export async function getAdminOverview(): Promise<AdminOverview> {
	const monthStart = startOfMonth();

	const [totalMembers, revenueAgg, apiCostAgg] = await Promise.all([
		prisma.user.count(),
		prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'DONE', createdAt: { gte: monthStart } } }),
		prisma.apiUsageLog.aggregate({ _sum: { costUsd: true }, where: { createdAt: { gte: monthStart } } }),
	]);

	const monthlyRevenueKrw = revenueAgg._sum.amount ?? 0;
	const monthlyApiCostUsd = apiCostAgg._sum.costUsd ?? 0;
	const monthlyApiCostKrw = monthlyApiCostUsd * USD_TO_KRW;
	const netMarginPercent = monthlyRevenueKrw > 0 ? ((monthlyRevenueKrw - monthlyApiCostKrw) / monthlyRevenueKrw) * 100 : 0;

	return { totalMembers, monthlyRevenueKrw, monthlyApiCostUsd, monthlyApiCostKrw, netMarginPercent, usdToKrw: USD_TO_KRW };
}

export interface AdminUserRow {
	id: string;
	email: string | null;
	name: string | null;
	role: string;
	planId: string;
	creditsRemaining: number;
	createdAt: Date;
	totalPaidKrw: number;
	totalApiCostUsd: number;
	marginKrw: number;
}

/** 유저별 마진율 = (유저 결제 금액) - (누적 API cost_usd * 환율). */
export async function getAdminUsersData(): Promise<AdminUserRow[]> {
	const users = await prisma.user.findMany({
		orderBy: { createdAt: 'desc' },
		select: {
			id: true,
			email: true,
			name: true,
			role: true,
			planId: true,
			creditsRemaining: true,
			createdAt: true,
			payments: { where: { status: 'DONE' }, select: { amount: true } },
			apiUsageLogs: { select: { costUsd: true } },
		},
	});

	return users.map((user) => {
		const totalPaidKrw = user.payments.reduce((sum, payment) => sum + payment.amount, 0);
		const totalApiCostUsd = user.apiUsageLogs.reduce((sum, log) => sum + log.costUsd, 0);
		return {
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
			planId: user.planId,
			creditsRemaining: user.creditsRemaining,
			createdAt: user.createdAt,
			totalPaidKrw,
			totalApiCostUsd,
			marginKrw: totalPaidKrw - totalApiCostUsd * USD_TO_KRW,
		};
	});
}

export interface AdminLogRow {
	id: string;
	userEmail: string | null;
	targetDomain: string;
	siteUrl: string | null;
	cmsType: string;
	durationMs: number | null;
	patchedAt: Date;
	score: number;
	maxScore: number;
	status: DiagnosticReport['status'];
	apiCostUsd: number;
	indexNowOk: boolean | null;
	googleOk: boolean | null;
}

export interface AdminAuditLeadRow {
	id: string;
	url: string;
	score: number;
	maxScore: number;
	statusLabel: string;
	createdAt: Date;
	userId: string | null;
}

/** Step 7's "영업 유인" surface — recent free-audit leads for sales follow-up. */
export async function getAdminAuditLeads(limit = 30): Promise<AdminAuditLeadRow[]> {
	const leads = await prisma.auditLead.findMany({
		orderBy: { createdAt: 'desc' },
		take: limit,
		select: { id: true, url: true, score: true, maxScore: true, statusLabel: true, createdAt: true, userId: true },
	});
	return leads;
}

export async function getAdminLogsData(limit = 50): Promise<AdminLogRow[]> {
	const history = await prisma.injectionHistory.findMany({
		orderBy: { patchedAt: 'desc' },
		take: limit,
		include: {
			user: { select: { email: true } },
			apiUsageLogs: { select: { costUsd: true } },
			indexingLogs: { select: { service: true, success: true } },
		},
	});

	return history.map((entry) => {
		let status: DiagnosticReport['status'] = 'FAIL';
		try {
			status = (JSON.parse(entry.diagnosticsJson) as DiagnosticReport).status;
		} catch {
			// keep default FAIL if diagnostics couldn't be parsed
		}

		return {
			id: entry.id,
			userEmail: entry.user.email,
			targetDomain: entry.targetDomain,
			siteUrl: entry.siteUrl,
			cmsType: entry.cmsType,
			durationMs: entry.durationMs,
			patchedAt: entry.patchedAt,
			score: entry.score,
			maxScore: entry.maxScore,
			status,
			apiCostUsd: entry.apiUsageLogs.reduce((sum, log) => sum + log.costUsd, 0),
			indexNowOk: entry.indexingLogs.find((log) => log.service === 'indexnow')?.success ?? null,
			googleOk: entry.indexingLogs.find((log) => log.service === 'google')?.success ?? null,
		};
	});
}
