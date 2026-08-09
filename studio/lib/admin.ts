import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { prisma } from './prisma';

/** Comma-separated allowlist, e.g. `ADMIN_EMAILS="owner@redue.io,ops@redue.io"`. */
export function isAdminEmail(email: string): boolean {
	const list = (process.env.ADMIN_EMAILS || '')
		.split(',')
		.map((entry) => entry.trim().toLowerCase())
		.filter(Boolean);
	return list.includes(email.trim().toLowerCase());
}

export interface AdminSessionUser {
	id: string;
	email: string | null;
	name: string | null;
}

/**
 * Resolves the current session and verifies `role === 'admin'` in the
 * database (never trusts the JWT alone, so a role revoked mid-session takes
 * effect immediately). Returns `null` when the caller is not an admin.
 */
export async function requireAdmin(): Promise<AdminSessionUser | null> {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) return null;

	const user = await prisma.user.findUnique({
		where: { id: session.user.id },
		select: { id: true, email: true, name: true, role: true },
	});
	if (!user || user.role !== 'admin') return null;

	return { id: user.id, email: user.email, name: user.name };
}
