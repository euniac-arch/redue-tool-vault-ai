import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import type { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import {
	AUDIT_LIMIT_CODE,
	GUEST_MAX_COUNT,
	SEO_AUDIT_COOKIE,
	USER_FREE_CREDITS,
	buildAuditQuota,
	isUnlimitedAuditAccess,
	parseGuestAuditCount,
	serializeGuestAuditCount,
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

/**
 * Guest audits are capped for the lifetime of the cookie (no daily reset) — see
 * `parseGuestAuditCount` for the rationale. `maxAge` is long-lived on purpose so the cap
 * survives across days and nudges anonymous visitors toward creating an account.
 */
export async function readGuestAuditCookie(): Promise<number> {
	try {
		const store = await cookies();
		return parseGuestAuditCount(store.get(SEO_AUDIT_COOKIE)?.value);
	} catch {
		return 0;
	}
}

export function applyGuestAuditCookie(response: NextResponse, used: number): void {
	response.cookies.set(SEO_AUDIT_COOKIE, serializeGuestAuditCount(used), {
		path: '/',
		maxAge: 60 * 60 * 24 * 365,
		sameSite: 'lax',
		httpOnly: false,
	});
	response.cookies.set('seo_audit_count', '', { path: '/', maxAge: 0 });
}

type StoredDailyUsage = {
	used: number;
	recordedToday: boolean;
};

let quotaColumnsReady = false;

/** Adds User.dailyAuditCount / lastAuditResetDate when the live SQLite file predates those columns. */
export async function ensureDailyQuotaColumns(): Promise<void> {
	if (quotaColumnsReady) return;
	try {
		const cols = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info(User)');
		const names = new Set(cols.map((col) => col.name));
		if (!names.has('dailyAuditCount')) {
			await prisma.$executeRawUnsafe('ALTER TABLE User ADD COLUMN dailyAuditCount INTEGER NOT NULL DEFAULT 0');
		}
		if (!names.has('lastAuditResetDate')) {
			await prisma.$executeRawUnsafe('ALTER TABLE User ADD COLUMN lastAuditResetDate TEXT');
		}
		if (!names.has('freeAuditsUsed')) {
			await prisma.$executeRawUnsafe('ALTER TABLE User ADD COLUMN freeAuditsUsed INTEGER NOT NULL DEFAULT 0');
		}
		quotaColumnsReady = true;
	} catch (err) {
		console.error('[audit-quota] ensureDailyQuotaColumns failed:', err);
	}
}

async function readStoredDailyUsageState(userId: string, date: string): Promise<StoredDailyUsage> {
	await ensureDailyQuotaColumns();
	try {
		const rows = await prisma.$queryRawUnsafe<Array<{ dailyAuditCount: number | null; lastAuditResetDate: string | null }>>(
			'SELECT dailyAuditCount, lastAuditResetDate FROM User WHERE id = ? LIMIT 1',
			userId,
		);
		const row = rows[0];
		if (!row) return { used: 0, recordedToday: false };
		const recordedToday = (row.lastAuditResetDate || '') === date;
		return {
			used: recordedToday ? Math.max(0, Number(row.dailyAuditCount) || 0) : 0,
			recordedToday,
		};
	} catch {
		return { used: 0, recordedToday: false };
	}
}

async function writeStoredDailyUsage(userId: string, used: number, date: string): Promise<void> {
	await ensureDailyQuotaColumns();
	await prisma.$executeRawUnsafe(
		'UPDATE User SET dailyAuditCount = ?, lastAuditResetDate = ? WHERE id = ?',
		used,
		date,
		userId,
	);
}

export type ResetAuditUsageResult = {
	date: string;
	resetCount: number;
	userIds: string[];
	emails: string[];
};

export async function resetStoredDailyUsage(options?: {
	userId?: string | null;
	email?: string | null;
	all?: boolean;
}): Promise<ResetAuditUsageResult> {
	await ensureDailyQuotaColumns();
	const date = todayStamp();
	const empty: ResetAuditUsageResult = { date, resetCount: 0, userIds: [], emails: [] };

	try {
		if (options?.all) {
			const users = await prisma.user.findMany({ select: { id: true, email: true } });
			const resetCount = await prisma.$executeRawUnsafe(
				'UPDATE User SET dailyAuditCount = 0, lastAuditResetDate = ?',
				date,
			);
			return {
				date,
				resetCount: Number(resetCount) || users.length,
				userIds: users.map((user) => user.id),
				emails: users.map((user) => user.email || ''),
			};
		}

		const email = options?.email?.trim().toLowerCase() || '';
		if (email) {
			const users = await prisma.user.findMany({
				where: { email },
				select: { id: true, email: true },
			});
			if (users.length === 0) return empty;
			for (const user of users) {
				await writeStoredDailyUsage(user.id, 0, date);
			}
			return {
				date,
				resetCount: users.length,
				userIds: users.map((user) => user.id),
				emails: users.map((user) => user.email || email),
			};
		}

		const userId = options?.userId?.trim() || '';
		if (!userId) return empty;
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { id: true, email: true },
		});
		if (!user) return empty;
		await writeStoredDailyUsage(user.id, 0, date);
		return { date, resetCount: 1, userIds: [user.id], emails: [user.email || ''] };
	} catch (err) {
		console.error('[audit-quota] resetStoredDailyUsage failed:', err);
		return empty;
	}
}

export function applyClearedGuestAuditCookie(response: NextResponse): void {
	applyGuestAuditCookie(response, 0);
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
	const guestUsed = await readGuestAuditCookie();

	if (sessionLooksAdmin(session)) {
		return {
			...buildAuditQuota(0, true, date, USER_FREE_CREDITS),
			userId,
			planId: 'pro',
			role: 'admin',
		};
	}

	if (userId) {
		try {
			await ensureDailyQuotaColumns();
			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: { planId: true, role: true, email: true },
			});
			if (user) {
				const unlimited =
					isUnlimitedAuditAccess(user.planId, user.role) ||
					isAdminEmail(user.email || '') ||
					isMasterAdminLoginId(user.email || '');
				const stored = await readStoredDailyUsageState(userId, date);
				// Signed-in members get a fresh USER_FREE_CREDITS pool (daily). Do not
				// import the leftover guest cookie — signup is meant to grant 5 new audits.
				const mergedUsed = stored.used;
				return {
					...buildAuditQuota(mergedUsed, unlimited, date, USER_FREE_CREDITS),
					userId,
					planId: user.planId,
					role: user.role,
				};
			}
		} catch (err) {
			console.error('[audit-quota] user lookup failed:', err);
		}
		return {
			...buildAuditQuota(guestUsed, false, date, USER_FREE_CREDITS),
			userId,
			planId: null,
			role: session?.user?.role || null,
		};
	}

	return {
		...buildAuditQuota(guestUsed, false, date, GUEST_MAX_COUNT),
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
	if (quota.unlimited) return quota;
	const date = todayStamp();
	const limit = quota.userId ? USER_FREE_CREDITS : GUEST_MAX_COUNT;
	const nextUsed = Math.min(limit, quota.used + 1);
	if (quota.userId) {
		try {
			await writeStoredDailyUsage(quota.userId, nextUsed, date);
		} catch (err) {
			console.error('[audit-quota] increment failed:', err);
		}
	}
	return buildAuditQuota(nextUsed, false, date, limit);
}
