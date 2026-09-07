import 'server-only';

import {
	GUEST_EMAIL,
	isSecurityEventType,
	isSecurityLogStatus,
	type SecurityEventType,
	type SecurityLog,
	type SecurityLogFilters,
	type SecurityLogKpi,
	type SecurityLogStatus,
} from '@/lib/admin/security-log-management';
import { prisma } from '@/lib/prisma';
import { parseUserAgent } from '@/lib/security-log-meta';

function formatTimestamp(value: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

function seoulDayBounds(now = new Date()): { start: Date; end: Date } {
	const seoul = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
	seoul.setHours(0, 0, 0, 0);
	const start = new Date(seoul);
	const end = new Date(seoul);
	end.setDate(end.getDate() + 1);
	return { start, end };
}

function parseDayStart(value: string): Date | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const date = new Date(`${value}T00:00:00+09:00`);
	return Number.isNaN(date.getTime()) ? null : date;
}

function parseDayEnd(value: string): Date | null {
	const start = parseDayStart(value);
	if (!start) return null;
	return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function asEventType(value: string): SecurityEventType {
	if (isSecurityEventType(value)) return value;
	if (value === 'LOGIN_FAILED') return 'LOGIN_FAIL';
	return 'LOGIN_SUCCESS';
}

function asStatus(value: string): SecurityLogStatus {
	if (isSecurityLogStatus(value)) return value;
	if (value === 'info') return 'SUCCESS';
	if (value === 'critical') return 'FAIL';
	return 'WARNING';
}

function toLog(row: {
	id: string;
	createdAt: Date;
	eventType: string;
	userEmail: string;
	ipAddress: string;
	userAgent: string;
	country: string;
	status: string;
	details: string;
}): SecurityLog {
	return {
		id: row.id,
		timestamp: formatTimestamp(row.createdAt),
		eventType: asEventType(row.eventType),
		userEmail: row.userEmail || GUEST_EMAIL,
		ipAddress: row.ipAddress || '-',
		userAgent: row.userAgent || '',
		country: row.country || 'KR',
		device: parseUserAgent(row.userAgent),
		status: asStatus(row.status),
		details: row.details || '',
	};
}

function buildWhere(filters: SecurityLogFilters) {
	const q = filters.query.trim();
	const from = parseDayStart(filters.from);
	const to = parseDayEnd(filters.to);
	return {
		...(filters.eventType !== 'all' ? { eventType: filters.eventType } : {}),
		...(filters.status !== 'all' ? { status: filters.status } : {}),
		...(from || to
			? {
					createdAt: {
						...(from ? { gte: from } : {}),
						...(to ? { lt: to } : {}),
					},
				}
			: {}),
		...(q
			? {
					OR: [
						{ userEmail: { contains: q } },
						{ ipAddress: { contains: q } },
						{ details: { contains: q } },
						{ country: { contains: q } },
					],
				}
			: {}),
	};
}

export async function querySecurityLogs(input: {
	filters: SecurityLogFilters;
	sortDir: 'asc' | 'desc';
	page: number;
	pageSize: number;
}) {
	const where = buildWhere(input.filters);
	const total = await prisma.securityAccessLog.count({ where });
	const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
	const page = Math.min(Math.max(1, input.page), totalPages);

	const rows = await prisma.securityAccessLog.findMany({
		where,
		orderBy: { createdAt: input.sortDir },
		skip: (page - 1) * input.pageSize,
		take: input.pageSize,
	});

	return {
		items: rows.map(toLog),
		total,
		page,
		pageSize: input.pageSize,
		totalPages,
	};
}

export async function buildSecurityLogKpi(): Promise<SecurityLogKpi> {
	const { start, end } = seoulDayBounds();
	const today = { createdAt: { gte: start, lt: end } };

	const [todayAccessCount, failedOrSuspiciousCount, activeAdminCount] = await Promise.all([
		prisma.securityAccessLog.count({
			where: {
				...today,
				eventType: { in: ['LOGIN_SUCCESS', 'ADMIN_ACCESS'] },
			},
		}),
		prisma.securityAccessLog.count({
			where: {
				...today,
				OR: [
					{ status: { in: ['FAIL', 'WARNING'] } },
					{ eventType: { in: ['LOGIN_FAIL', 'ADMIN_ACCESS_DENIED', 'API_QUOTA_EXCEEDED'] } },
				],
			},
		}),
		prisma.user.count({
			where: {
				status: 'active',
				OR: [{ role: 'admin' }, { role: 'ADMIN' }],
			},
		}),
	]);

	return { todayAccessCount, failedOrSuspiciousCount, activeAdminCount };
}

export async function listSecurityLogsForExport(ids?: string[]) {
	const rows = await prisma.securityAccessLog.findMany({
		where: ids?.length ? { id: { in: ids } } : undefined,
		orderBy: { createdAt: 'desc' },
		take: 500,
	});
	return rows.map(toLog);
}
