import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/** POST /api/developer/keys/[id]/revoke — immediately disables a key; already-issued secrets stop authenticating. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const key = await prisma.apiKey.findUnique({ where: { id: params.id } });
	if (!key || key.userId !== session.user.id) {
		return NextResponse.json({ error: 'Key not found' }, { status: 404 });
	}
	if (key.revokedAt) {
		return NextResponse.json({ ok: true, alreadyRevoked: true });
	}

	await prisma.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });
	return NextResponse.json({ ok: true });
}
