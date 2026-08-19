import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import {
	isAdminEmail,
	isDbAdminRole,
	isMasterAdminLoginId,
	MASTER_ADMIN_ID,
} from './master-admin';
import { prisma } from './prisma';

export { isAdminEmail, isDbAdminRole } from './master-admin';

export interface AdminSessionUser {
	id: string;
	email: string | null;
	name: string | null;
}

function jwtLooksAdmin(session: {
	user?: { id?: string; email?: string | null; role?: string | null };
}): boolean {
	const email = session.user?.email || '';
	const role = session.user?.role || '';
	if (isMasterAdminLoginId(email) || session.user?.id === MASTER_ADMIN_ID) return true;
	if (isDbAdminRole(role) || role.toUpperCase() === 'ADMIN') return isAdminEmail(email) || Boolean(session.user?.id);
	return isAdminEmail(email);
}

/**
 * Resolves the current session and verifies admin access.
 * Master-admin JWT (`admin` / `jooni1428`) is accepted even when the SQLite
 * row is missing or unwritable on Vercel.
 */
export async function requireAdmin(): Promise<AdminSessionUser | null> {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) return null;

	const email = session.user.email || '';

	try {
		const user = await prisma.user.findUnique({
			where: { id: session.user.id },
			select: { id: true, email: true, name: true, role: true },
		});

		if (user) {
			if (isDbAdminRole(user.role)) {
				return { id: user.id, email: user.email, name: user.name };
			}
			if (
				jwtLooksAdmin(session) ||
				isMasterAdminLoginId(user.email || '') ||
				isAdminEmail(user.email || email)
			) {
				return { id: user.id, email: user.email, name: user.name };
			}
			return null;
		}
	} catch (err) {
		console.error('[requireAdmin] db lookup failed:', err);
	}

	if (!jwtLooksAdmin(session) && !isAdminEmail(email)) return null;

	return {
		id: session.user.id,
		email: session.user.email ?? null,
		name: session.user.name ?? null,
	};
}
