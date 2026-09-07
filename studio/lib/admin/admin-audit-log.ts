import 'server-only';

import type { AdminSessionUser } from '@/lib/admin';
import type { SystemLogModule, SystemLogResult } from '@/lib/admin/system-log-management';
import { prisma } from '@/lib/prisma';

export async function writeAdminAuditLog(input: {
	admin?: AdminSessionUser | null;
	operator?: string;
	module: SystemLogModule | 'DIAGNOSIS';
	actionDetail: string;
	result?: SystemLogResult;
}): Promise<void> {
	const operator =
		input.operator?.trim() ||
		input.admin?.name?.trim() ||
		input.admin?.email?.trim() ||
		'관리자';
	try {
		await prisma.adminAuditLog.create({
			data: {
				operatorId: input.admin?.id || null,
				operator,
				module: input.module,
				actionDetail: input.actionDetail,
				result: input.result ?? 'SUCCESS',
			},
		});
	} catch (error) {
		console.error('[admin-audit-log] write failed:', error);
	}
}
