import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import {
	isAdminEmail,
	isDbAdminRole,
	isMasterAdminLoginId,
	MASTER_ADMIN_EMAIL,
	MASTER_ADMIN_ID,
} from '@/lib/master-admin';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

function bootstrapMe(session: { user?: { id?: string; name?: string | null; email?: string | null; image?: string | null; role?: string | null } }) {
	const email = session.user?.email || MASTER_ADMIN_EMAIL;
	return {
		authenticated: true,
		planId: 'pro',
		creditsRemaining: 100,
		name: session.user?.name ?? 'REDUE Admin',
		email,
		image: session.user?.image ?? null,
		role: 'admin',
	};
}

function sessionIsMasterAdmin(session: {
	user?: { id?: string; email?: string | null; role?: string | null };
}): boolean {
	const email = session.user?.email || '';
	const role = session.user?.role || '';
	return (
		isMasterAdminLoginId(email) ||
		session.user?.id === MASTER_ADMIN_ID ||
		isDbAdminRole(role) ||
		role.toUpperCase() === 'ADMIN' ||
		isAdminEmail(email)
	);
}

/**
 * GET /api/me — always re-reads the live balance from the DB so the header
 * credit badge never trusts a (potentially stale) JWT-cached value.
 * On Vercel the SQLite row may be missing; master-admin JWT still counts as signed in.
 */
export async function GET() {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return NextResponse.json({ authenticated: false }, { status: 401 });
	}

	try {
		const user = await prisma.user.findUnique({
			where: { id: session.user.id },
			select: { planId: true, creditsRemaining: true, name: true, email: true, image: true, role: true },
		});

		if (user) {
			const admin =
				isDbAdminRole(user.role) ||
				isMasterAdminLoginId(user.email || '') ||
				isAdminEmail(user.email || '') ||
				sessionIsMasterAdmin(session);
			return NextResponse.json({
				authenticated: true,
				...user,
				role: admin ? 'admin' : user.role,
			});
		}
	} catch (err) {
		console.error('[api/me] db lookup failed:', err);
	}

	if (sessionIsMasterAdmin(session)) {
		return NextResponse.json(bootstrapMe(session));
	}

	return NextResponse.json({ authenticated: false }, { status: 401 });
}
