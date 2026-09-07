import 'server-only';

import {
	GUEST_EMAIL,
	isSecurityEventType,
	isSecurityLogStatus,
	type SecurityEventType,
	type SecurityLogStatus,
} from '@/lib/admin/security-log-management';
import { prisma } from '@/lib/prisma';
import { extractRequestMeta, normalizeLogEmail, type RequestMeta } from '@/lib/security-log-meta';

const ADMIN_ACCESS_DEDUPE_MS = 10 * 60 * 1000;

export type WriteSecurityLogInput = {
	eventType: SecurityEventType;
	userEmail?: string | null;
	userId?: string | null;
	status?: SecurityLogStatus;
	details?: string;
	ipAddress?: string;
	userAgent?: string;
	country?: string;
	headers?: Parameters<typeof extractRequestMeta>[0];
};

function defaultStatus(eventType: SecurityEventType): SecurityLogStatus {
	if (eventType === 'LOGIN_FAIL' || eventType === 'ADMIN_ACCESS_DENIED') return 'FAIL';
	if (eventType === 'API_QUOTA_EXCEEDED' || eventType === 'PASSWORD_RESET') return 'WARNING';
	return 'SUCCESS';
}

function resolveMeta(input: WriteSecurityLogInput): RequestMeta {
	const fromHeaders = extractRequestMeta(input.headers);
	return {
		ipAddress: input.ipAddress?.trim() || fromHeaders.ipAddress,
		userAgent: input.userAgent?.trim() || fromHeaders.userAgent,
		country: (input.country?.trim() || fromHeaders.country || 'KR').toUpperCase(),
	};
}

async function shouldSkipDuplicateAdminAccess(input: {
	eventType: SecurityEventType;
	userEmail: string;
	ipAddress: string;
	details: string;
}): Promise<boolean> {
	if (input.eventType !== 'ADMIN_ACCESS') return false;
	const recent = await prisma.securityAccessLog.findFirst({
		where: {
			eventType: 'ADMIN_ACCESS',
			userEmail: input.userEmail,
			ipAddress: input.ipAddress,
			details: input.details,
			createdAt: { gte: new Date(Date.now() - ADMIN_ACCESS_DEDUPE_MS) },
		},
		select: { id: true },
	});
	return Boolean(recent);
}

export async function writeSecurityLog(input: WriteSecurityLogInput): Promise<void> {
	if (!isSecurityEventType(input.eventType)) return;
	const status = input.status && isSecurityLogStatus(input.status) ? input.status : defaultStatus(input.eventType);
	const userEmail = normalizeLogEmail(input.userEmail);
	const details = (input.details || '').trim();
	const meta = resolveMeta(input);

	try {
		if (
			await shouldSkipDuplicateAdminAccess({
				eventType: input.eventType,
				userEmail,
				ipAddress: meta.ipAddress,
				details,
			})
		) {
			return;
		}

		await prisma.securityAccessLog.create({
			data: {
				eventType: input.eventType,
				userEmail,
				userId: input.userId?.trim() || null,
				ipAddress: meta.ipAddress,
				userAgent: meta.userAgent,
				country: meta.country || 'KR',
				status,
				details,
			},
		});
	} catch (error) {
		console.error('[security-log] write failed:', error);
	}
}

/** Fire-and-forget write so auth / middleware paths never block on logging. */
export function recordSecurityLog(input: WriteSecurityLogInput): void {
	void writeSecurityLog(input);
}

export { GUEST_EMAIL, extractRequestMeta, normalizeLogEmail };
