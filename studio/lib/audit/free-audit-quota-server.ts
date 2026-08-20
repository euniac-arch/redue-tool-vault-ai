import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import type { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import {
	AUDIT_LIMIT_CODE,
	FREE_AUDIT_LIMIT,
	SEO_AUDIT_COOKIE,
	buildAuditQuota,
	isDevUnlimitedAuditQuota,
	isUnlimitedAuditAccess,
	parseGuestDailyCount,
	serializeGuestDailyCount,
	todayStamp,
	type AuditQuotaSnapshot,
} from '@/lib/audit/free-audit-quota';
import { isAdminEmail, isDbAdminRole, isMasterAdminLoginId, MASTER_ADMIN_ID } from '@/lib/master-admin';
import { prisma } from '@/lib/prisma';

export type ResolvedAuditQuota = AuditQuotaSnapshot & {
	userId: string | null;
	planId: string | null;
	role: string | null;
};

type QuotaSessionUser = {
	id?: string | null;
	email?: string | null;
	role?: string | null;
};

type QuotaSession = {
	user?: QuotaSessionUser | null;
};

/** next-auth Session can resolve to `{}` in this project — never read `.user` on that type. */
function asQuotaSession(value: unknown): QuotaSession | null {
	if (!value || typeof value !== 'object') return null;
	const rawUser = 'user' in value ? (value as { user?: unknown }).user : undefined;
	if (!rawUser || typeof rawUser !== 'object') return { user: null };
	const rec = rawUser as Record<string, unknown>;
	return {
		user: {
			id: typeof rec.id === 'string' ? rec.id : null,
			email: typeof rec.email === 'string' ? rec.email : null,
			role: typeof rec.role === 'string' ? rec.role : null,
		},
	};
}

function sessionUserId(session: QuotaSession | null | undefined): string | null {
	const id = session?.user?.id;
	return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function sessionLooksAdmin(session: QuotaSession | null | undefined): boolean {
	const email = session?.user?.email || '';
	const role = session?.user?.role ? String(session.user.role) : '';
	return (
		isMasterAdminLoginId(email) ||
		sessionUserId(session) === MASTER_ADMIN_ID ||
		isDbAdminRole(role) ||
		role.toUpperCase() === 'ADMIN' ||
		isAdminEmail(email)
	);
}

export async function readGuestAuditCookie(date = todayStamp()): Promise<number> {
	try {
		const store = await cookies();
		return parseGuestDailyCount(store.get(SEO_AUDIT_COOKIE)?.value, date).count;
	} catch {
		return 0;
	}
}

export function applyGuestAuditCookie(response: NextResponse, used: number, date = todayStamp()): void {
	response.cookies.set(SEO_AUDIT_COOKIE, serializeGuestDailyCount({ date, count: Math.max(0, used) }), {
		path: '/',
		maxAge: 60 * 60 * 24 * 365,
		sameSite: 'lax',
		httpOnly: false,
	});
}

async function readStoredDailyUsage(userId: string, date: string): Promise<number> {
	try {
		const rows = await prisma.$queryRawUnsafe<Array<{ dailyAuditCount: number | null; lastAuditResetDate: string | null }>>(
			'SELECT dailyAuditCount, lastAuditResetDate FROM User WHERE id = ? LIMIT 1',
			userId,
		);
		const row = rows[0];
		if (!row) return 0;
		if ((row.lastAuditResetDate || '') !== date) return 0;
		return Math.max(0, Number(row.dailyAuditCount) || 0);
	} catch {
		return 0;
	}
}

async function writeStoredDailyUsage(userId: string, used: number, date: string): Promise<void> {
	await prisma.$executeRawUnsafe(
		'UPDATE User SET dailyAuditCount = ?, lastAuditResetDate = ? WHERE id = ?',
		used,
		date,
		userId,
	);
}

export async function resolveAuditQuota(): Promise<ResolvedAuditQuota> {
	const date = todayStamp();
	let session: QuotaSession | null = null;
	try {
		session = asQuotaSession(await getServerSession(authOptions));
	} catch {
		session = null;
	}

	const userId = sessionUserId(session);
	const guestUsed = await readGuestAuditCookie(date);

	if (isDevUnlimitedAuditQuota()) {
		return {
			...buildAuditQuota(0, true, date, true),
			userId,
			planId: null,
			role: null,
		};
	}

	if (sessionLooksAdmin(session)) {
		return {
			...buildAuditQuota(0, true, date),
			userId,
			planId: 'pro',
			role: 'admin',
		};
	}

	if (userId) {
		try {
			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: { planId: true, role: true, email: true },
			});
			if (user) {
				const unlimited =
					isUnlimitedAuditAccess(user.planId, user.role) ||
					isAdminEmail(user.email || '') ||
					isMasterAdminLoginId(user.email || '');
				const storedUsed = await readStoredDailyUsage(userId, date);
				const mergedUsed = unlimited ? storedUsed : Math.max(storedUsed, guestUsed);
				if (!unlimited && mergedUsed > storedUsed) {
					await writeStoredDailyUsage(userId, mergedUsed, date);
				}
				return {
					...buildAuditQuota(mergedUsed, unlimited, date),
					userId,
					planId: user.planId,
					role: user.role,
				};
			}
		} catch (err) {
			console.error('[audit-quota] user lookup failed:', err);
		}
	}

	return {
		...buildAuditQuota(guestUsed, false, date),
		userId: null,
		planId: null,
		role: null,
	};
}

export function limitReachedPayload(quota: AuditQuotaSnapshot, message: string) {
	return {
		error: message,
		code: AUDIT_LIMIT_CODE,
		used: quota.used,
		remaining: 0,
		limit: quota.limit,
		date: quota.date,
		unlimited: false,
	};
}

export async function incrementAuditUsage(quota: ResolvedAuditQuota): Promise<AuditQuotaSnapshot> {
	if (quota.unlimited || isDevUnlimitedAuditQuota()) return quota;
	const date = todayStamp();
	const nextUsed = Math.min(FREE_AUDIT_LIMIT, quota.used + 1);
	if (quota.userId) {
		try {
			await writeStoredDailyUsage(quota.userId, nextUsed, date);
		} catch (err) {
			console.error('[audit-quota] increment failed:', err);
		}
	}
	return buildAuditQuota(nextUsed, false, date);
}
