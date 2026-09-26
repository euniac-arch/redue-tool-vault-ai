import type { NextRequest } from 'next/server';
import { getToken, type JWT } from 'next-auth/jwt';
import { resolveNextAuthSecret } from '@/lib/master-admin';

/** Production HTTPS issues `__Secure-` cookies. Local `next dev` stays on the plain name. */
export function authCookiesUseSecure(): boolean {
	return process.env.NODE_ENV === 'production';
}

export const SESSION_TOKEN_COOKIE_NAME = authCookiesUseSecure()
	? '__Secure-next-auth.session-token'
	: 'next-auth.session-token';

export function authSessionCookieOptions() {
	return {
		httpOnly: true as const,
		sameSite: 'lax' as const,
		path: '/',
		secure: authCookiesUseSecure(),
	};
}

const SESSION_COOKIE_NAMES = [
	'__Secure-next-auth.session-token',
	'__Host-next-auth.session-token',
	'next-auth.session-token',
] as const;

/**
 * Read the NextAuth JWT using the cookie name that production actually sets.
 * `getToken()` defaults follow `NEXTAUTH_URL`; a localhost URL in production
 * looks for `next-auth.session-token` and misses `__Secure-next-auth.session-token`.
 */
export async function readAuthToken(req: NextRequest | { headers: Headers }): Promise<JWT | null> {
	const secret = resolveNextAuthSecret();
	const preferred = authCookiesUseSecure()
		? SESSION_COOKIE_NAMES
		: (['next-auth.session-token', '__Secure-next-auth.session-token', '__Host-next-auth.session-token'] as const);

	for (const cookieName of preferred) {
		try {
			const token = await getToken({
				req: req as NextRequest,
				secret,
				cookieName,
				secureCookie: cookieName.startsWith('__Secure-') || cookieName.startsWith('__Host-'),
			});
			if (token) return token;
		} catch (err) {
			console.error('[auth] session token read failed:', cookieName, err);
		}
	}
	return null;
}
