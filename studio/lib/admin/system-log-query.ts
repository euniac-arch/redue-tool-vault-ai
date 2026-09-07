import 'server-only';

import type { SystemLog, SystemLogFilters, SystemLogKpi, SystemLogModule, SystemLogResult } from '@/lib/admin/system-log-management';
import { prisma } from '@/lib/prisma';

function formatTimestamp(value: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

function asModule(value: string): SystemLogModule {
	if (value === 'CONTENT' || value === 'SYSTEM_CONFIG' || value === 'AUTH') return value;
	return 'USER_MGMT';
}

function asResult(value: string): SystemLogResult {
	if (value === 'INFO' || value === 'PENDING') return value;
	return 'SUCCESS';
}

function toLog(row: {
	id: string;
	createdAt: Date;
	operator: string;
	module: string;
	actionDetail: string;
	result: string;
}): SystemLog {
	return {
		id: row.id,
		timestamp: formatTimestamp(row.createdAt),
		operator: row.operator,
		module: asModule(row.module),
		actionDetail: row.actionDetail,
		result: asResult(row.result),
	};
}

export async function querySystemLogs(input: {
	filters: SystemLogFilters;
	sortDir: 'asc' | 'desc';
	page: number;
	pageSize: number;
}) {
	const q = input.filters.query.trim();
	const where = {
		...(input.filters.module !== 'all' ? { module: input.filters.module } : {}),
		...(q
			? {
					OR: [
						{ operator: { contains: q } },
						{ actionDetail: { contains: q } },
						{ id: { contains: q } },
					],
				}
			: {}),
	};

	const total = await prisma.adminAuditLog.count({ where });
	const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
	const page = Math.min(Math.max(1, input.page), totalPages);

	const rows = await prisma.adminAuditLog.findMany({
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

export async function buildSystemLogKpi(): Promise<SystemLogKpi> {
	const now = new Date();
	const seoul = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
	seoul.setHours(0, 0, 0, 0);
	const todayStart = new Date(seoul);
	const tomorrow = new Date(seoul);
	tomorrow.setDate(tomorrow.getDate() + 1);

	const [totalJobs, todayChanges, pendingJobs] = await Promise.all([
		prisma.adminAuditLog.count(),
		prisma.adminAuditLog.count({ where: { createdAt: { gte: todayStart, lt: tomorrow } } }),
		prisma.adminAuditLog.count({ where: { result: 'PENDING' } }),
	]);

	return { totalJobs, todayChanges, pendingJobs };
}

export async function listSystemLogsForExport(ids?: string[]) {
	const rows = await prisma.adminAuditLog.findMany({
		where: ids?.length ? { id: { in: ids } } : undefined,
		orderBy: { createdAt: 'desc' },
		take: 500,
	});
	return rows.map(toLog);
}
