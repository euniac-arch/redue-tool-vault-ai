import {
	isAdminEmail,
	isDbAdminRole,
	isMasterAdminLoginId,
	MASTER_ADMIN_ID,
} from '@/lib/master-admin';

/** Diagnosing party captured at scan time. */
export type DiagnosisUserType = 'admin' | 'user' | 'guest';

export type DiagnosisActor = {
	userId: string | null;
	userType: DiagnosisUserType;
	email: string | null;
	role: string | null;
};

function trimOrNull(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const next = value.trim();
	return next ? next : null;
}

/** Accepts `admin` / `ADMIN` / `user` / `USER` / `guest`. Anything else → guest. */
export function normalizeDiagnosisUserType(raw: unknown): DiagnosisUserType {
	const value = String(raw || '')
		.trim()
		.toLowerCase();
	if (value === 'admin') return 'admin';
	if (value === 'user') return 'user';
	return 'guest';
}

export function isAdminRoleValue(raw: unknown): boolean {
	const value = String(raw || '')
		.trim()
		.toLowerCase();
	return value === 'admin';
}

export function actorLooksAdmin(input: {
	userId?: string | null;
	email?: string | null;
	role?: string | null;
}): boolean {
	const email = input.email || '';
	const role = input.role ? String(input.role) : '';
	const userId = trimOrNull(input.userId);
	return (
		isMasterAdminLoginId(email) ||
		userId === MASTER_ADMIN_ID ||
		isDbAdminRole(role) ||
		role.toUpperCase() === 'ADMIN' ||
		isAdminRoleValue(role) ||
		isAdminEmail(email)
	);
}

/**
 * Resolve who ran the diagnosis.
 * Session / quota win. Client `userId` + `role` hints are accepted only when they
 * match an already-authenticated session (never trusted alone).
 */
export function resolveDiagnosisActor(input: {
	sessionUserId?: string | null;
	sessionEmail?: string | null;
	sessionRole?: string | null;
	quotaUserId?: string | null;
	quotaRole?: string | null;
	hintedUserId?: string | null;
	hintedRole?: string | null;
}): DiagnosisActor {
	const sessionUserId = trimOrNull(input.sessionUserId) || trimOrNull(input.quotaUserId);
	const sessionEmail = trimOrNull(input.sessionEmail);
	const sessionRole = trimOrNull(input.sessionRole) || trimOrNull(input.quotaRole);
	const hintedUserId = trimOrNull(input.hintedUserId);
	const hintedRole = trimOrNull(input.hintedRole);

	const userId = sessionUserId || null;
	const email = sessionEmail;
	const role = sessionRole;

	const hintedMatchesSession = Boolean(userId && hintedUserId && hintedUserId === userId);

	const admin =
		actorLooksAdmin({ userId, email, role }) ||
		isAdminRoleValue(input.quotaRole) ||
		(hintedMatchesSession && (isAdminRoleValue(hintedRole) || actorLooksAdmin({ userId, email, role: hintedRole })));

	if (admin) {
		return {
			userId: userId || MASTER_ADMIN_ID,
			userType: 'admin',
			email,
			role: role || 'admin',
		};
	}

	if (userId) {
		return {
			userId,
			userType: 'user',
			email,
			role: role || 'user',
		};
	}

	return { userId: null, userType: 'guest', email: null, role: null };
}

/**
 * Display / list membership: prefer the value stored at scan time, then
 * infer admin from linked user, then signed-in member vs anonymous guest.
 * Legacy rows defaulted to `guest` even when `userId` was set.
 */
export function resolveStoredDiagnosisUserType(input: {
	userType?: unknown;
	userId?: string | null;
	email?: string | null;
	role?: string | null;
}): DiagnosisUserType {
	const stored = normalizeDiagnosisUserType(input.userType);
	if (stored === 'admin') return 'admin';
	if (actorLooksAdmin({ userId: input.userId, email: input.email, role: input.role })) {
		return 'admin';
	}
	if (stored === 'user') return 'user';
	if (trimOrNull(input.userId)) return 'user';
	return 'guest';
}
