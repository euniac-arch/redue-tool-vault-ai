import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * GET /api/me — always re-reads the live balance from the DB so the header
 * credit badge never trusts a (potentially stale) JWT-cached value.
 */
export async function GET() {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return NextResponse.json({ authenticated: false }, { status: 401 });
	}

	const user = await prisma.user.findUnique({
		where: { id: session.user.id },
		select: { planId: true, creditsRemaining: true, name: true, email: true, image: true, role: true },
	});

	if (!user) {
		return NextResponse.json({ authenticated: false }, { status: 401 });
	}

	return NextResponse.json({ authenticated: true, ...user });
}
