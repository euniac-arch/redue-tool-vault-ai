import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { decode, getToken, type JWT } from 'next-auth/jwt';
import { authOptions } from './auth';
import {
	isAdminEmail,
	isDbAdminRole,
	isMasterAdminLoginId,
	MASTER_ADMIN_ID,
	resolveNextAuthSecret,
} from './master-admin';
import { prisma } from './prisma';

export { isAdminEmail, isDbAdminRole } from './master-admin';

export interface AdminSessionUser {
	id: string;
	email: string | null;
	name: string | null;
}

export type AdminAccessState =
	| { state: 'ok'; user: AdminSessionUser }
	| { state: 'unauthenticated' }
	| { state: 'forbidden' };

const SESSION_COOKIE_NAMES = [
	'next-auth.session-token',
	'__Secure-next-auth.session-token',
	'__Host-next-auth.session-token',
] as const;

function roleLooksAdmin(role: string | null | undefined): boolean {
	return isDbAdminRole(role) || (role || '').toUpperCase() === 'ADMIN';
}

function identityLooksAdmin(input: {
	id?: string;
	email?: string | null;
	role?: string | null;
	isAdmin?: boolean;
}): boolean {
	const email = (input.email || '').trim();
	const id = (input.id || '').trim();
	if (!email && !id) return false;
	if (input.isAdmin === true) return true;
	if (email && isMasterAdminLoginId(email)) return true;
	if (id && id === MASTER_ADMIN_ID) return true;
	if (email && isAdminEmail(email)) return true;
	return roleLooksAdmin(input.role);
}

async function readJwtFromCookies(): Promise<JWT | null> {
	const secret = resolveNextAuthSecret();
	try {
		const jar = cookies();
		for (const name of SESSION_COOKIE_NAMES) {
			const raw = jar.get(name)?.value;
			if (!raw) continue;
			const token = await decode({ token: raw, secret });
			if (token) return token;
		}
	} catch {
		return null;
	}
	return null;
}

async function readJwtFromRequest(req?: NextRequest): Promise<JWT | null> {
	const secret = resolveNextAuthSecret();

	if (req) {
		try {
			const token = await getToken({ req, secret });
			if (token) return token;
		} catch {
			// keep trying explicit cookie names
		}

		for (const cookieName of SESSION_COOKIE_NAMES) {
			try {
				const token = await getToken({
					req,
					secret,
					cookieName,
					secureCookie: cookieName.startsWith('__Secure') || cookieName.startsWith('__Host'),
				});
				if (token) return token;
			} catch {
				// try the next cookie name
			}
		}
	}

	return readJwtFromCookies();
}

/**
 * Resolves the current session and verifies admin access.
 * Distinguishes missing session (401) from signed-in non-admin (403).
 *
 * After Kakao/Google OAuth, `getServerSession` can briefly return null in
 * Route Handlers while the JWT cookie is already present — always read the
 * request JWT (and cookie store) in parallel. Admin grant is `ADMIN_EMAILS`
 * + DB role + master id.
 */
type SessionUserFields = {
	id?: string | null;
	email?: string | null;
	name?: string | null;
	role?: string | null;
	isAdmin?: boolean;
};

/** next-auth Session can resolve to `{}` — never read `.user` on that type. */
function readSessionUser(value: unknown): SessionUserFields | null {
	if (!value || typeof value !== 'object') return null;
	const rawUser = 'user' in value ? (value as { user?: unknown }).user : undefined;
	if (!rawUser || typeof rawUser !== 'object') return null;
	const rec = rawUser as Record<string, unknown>;
	return {
		id: typeof rec.id === 'string' ? rec.id : null,
		email: typeof rec.email === 'string' ? rec.email : null,
		name: typeof rec.name === 'string' ? rec.name : null,
		role: typeof rec.role === 'string' ? rec.role : null,
		isAdmin: rec.isAdmin === true,
	};
}

export async function getAdminAccessState(req?: NextRequest): Promise<AdminAccessState> {
	let session: unknown = null;
	try {
		session = await getServerSession(authOptions);
	} catch {
		session = null;
	}

	const token = await readJwtFromRequest(req);
	const sessionUser = readSessionUser(session);

	let id = sessionUser?.id || '';
	let email = sessionUser?.email || '';
	let name = sessionUser?.name ?? null;
	let role = sessionUser?.role || '';
	let flaggedAdmin = Boolean(sessionUser?.isAdmin);

	if (token) {
		if (!id) id = String(token.uid || token.sub || '');
		if (!email) email = String(token.email || '');
		if (!name && token.name) name = String(token.name);
		if (!role) role = String(token.role || '');
		flaggedAdmin = flaggedAdmin || Boolean(token.isAdmin);
	}

	const hasIdentity = Boolean(id || email);
	if (!sessionUser && !token && !hasIdentity) {
		return { state: 'unauthenticated' };
	}

	const looksAdmin = identityLooksAdmin({ id, email, role, isAdmin: flaggedAdmin });

	try {
		const user = id
			? await prisma.user.findUnique({
					where: { id },
					select: { id: true, email: true, name: true, role: true },
				})
			: email
				? await prisma.user.findUnique({
						where: { email },
						select: { id: true, email: true, name: true, role: true },
					})
				: null;

		if (!user && email && id) {
			const byEmail = await prisma.user.findUnique({
				where: { email },
				select: { id: true, email: true, name: true, role: true },
			});
			if (byEmail) {
				if (isDbAdminRole(byEmail.role) || looksAdmin || isAdminEmail(byEmail.email || email)) {
					return { state: 'ok', user: { id: byEmail.id, email: byEmail.email, name: byEmail.name } };
				}
				return { state: 'forbidden' };
			}
		}

		if (user) {
			if (isDbAdminRole(user.role) || looksAdmin || isAdminEmail(user.email || email)) {
				return { state: 'ok', user: { id: user.id, email: user.email, name: user.name } };
			}
			return { state: 'forbidden' };
		}
	} catch (err) {
		console.error('[requireAdmin] db lookup failed:', err);
	}

	if (!looksAdmin) return { state: 'forbidden' };

	return {
		state: 'ok',
		user: {
			id: id || email,
			email: email || null,
			name,
		},
	};
}

/**
 * Resolves the current session and verifies admin access.
 * Master-admin JWT (`admin` / `jooni1428`) is accepted even when the SQLite
 * row is missing or unwritable on Vercel.
 */
export async function requireAdmin(req?: NextRequest): Promise<AdminSessionUser | null> {
	const access = await getAdminAccessState(req);
	return access.state === 'ok' ? access.user : null;
}
