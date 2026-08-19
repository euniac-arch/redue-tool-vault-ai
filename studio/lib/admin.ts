import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { isAdminEmail, isDbAdminRole } from './master-admin';
import { prisma } from './prisma';

export { isAdminEmail, isDbAdminRole } from './master-admin';

export interface AdminSessionUser {
	id: string;
	email: string | null;
	name: string | null;
}

/**
 * Resolves the current session and verifies `role === 'admin'` in the
 * database (never trusts the JWT alone, so a role revoked mid-session takes
 * effect immediately). Returns `null` when the caller is not an admin.
 *
 * Bootstrap master admin (`admin`) may exist only in the JWT until
 * the first DB upsert; email allowlist still grants access in that window.
 */
export async function requireAdmin(): Promise<AdminSessionUser | null> {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) return null;

	const user = await prisma.user.findUnique({
		where: { id: session.user.id },
		select: { id: true, email: true, name: true, role: true },
	});

	if (user) {
		if (!isDbAdminRole(user.role)) return null;
		return { id: user.id, email: user.email, name: user.name };
	}

	const email = session.user.email || '';
	const jwtAdmin = (session.user.role || '').toUpperCase() === 'ADMIN' && isAdminEmail(email);
	if (!jwtAdmin) return null;

	return {
		id: session.user.id,
		email: session.user.email ?? null,
		name: session.user.name ?? null,
	};
}
