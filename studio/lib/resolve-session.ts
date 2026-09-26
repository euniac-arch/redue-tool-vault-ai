import { cookies, headers } from 'next/headers';
import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth';
import { readAuthToken } from '@/lib/auth-cookies';
import { isStudioAdminIdentity, MASTER_ADMIN_ROLE } from '@/lib/master-admin';

export type SignedInUser = {
	id: string;
	email: string;
	name: string | null;
	role: string;
	isAdmin: boolean;
};

function asSignedInUser(input: {
	id?: string | null;
	email?: string | null;
	name?: string | null;
	role?: string | null;
	isAdmin?: boolean;
}): SignedInUser | null {
	const id = (input.id || '').trim();
	const email = (input.email || '').trim();
	if (!id && !email) return null;
	const isAdmin = isStudioAdminIdentity({
		id,
		email,
		role: input.role,
		isAdmin: input.isAdmin,
	});
	return {
		id,
		email,
		name: input.name?.trim() || null,
		role: isAdmin ? MASTER_ADMIN_ROLE : (input.role || 'USER'),
		isAdmin,
	};
}

/**
 * Session from NextAuth, then the secure/plain session cookie.
 * Production sets `__Secure-next-auth.session-token` while a localhost
 * `NEXTAUTH_URL` makes the default reader look for the plain name.
 */
export async function resolveSignedInUser(): Promise<SignedInUser | null> {
	const session = await getServerSession(authOptions).catch((err) => {
		console.error('[auth] getServerSession failed', err);
		return null;
	});
	const fromSession = asSignedInUser({
		id: session?.user?.id,
		email: session?.user?.email,
		name: session?.user?.name,
		role: session?.user?.role,
		isAdmin: session?.user?.isAdmin,
	});
	if (fromSession) return fromSession;

	try {
		const token = await readAuthToken({
			cookies: cookies(),
			headers: headers(),
		} as unknown as NextRequest);
		if (!token) return null;
		return asSignedInUser({
			id: typeof token.uid === 'string' ? token.uid : typeof token.sub === 'string' ? token.sub : '',
			email: typeof token.email === 'string' ? token.email : '',
			name: typeof token.name === 'string' ? token.name : null,
			role: typeof token.role === 'string' ? token.role : null,
			isAdmin: token.isAdmin === true,
		});
	} catch (err) {
		console.error('[auth] session cookie fallback failed', err);
		return null;
	}
}
