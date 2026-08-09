import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const DAYS = 14;

/** GET /api/developer/usage — last 14 days of call volume across all of the user's API keys, for the usage chart. */
export async function GET() {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const keys = await prisma.apiKey.findMany({ where: { userId: session.user.id }, select: { id: true } });
	const keyIds = keys.map((k) => k.id);

	const since = new Date();
	since.setUTCDate(since.getUTCDate() - (DAYS - 1));
	since.setUTCHours(0, 0, 0, 0);

	const logs = keyIds.length
		? await prisma.apiCallLog.findMany({
				where: { apiKeyId: { in: keyIds }, createdAt: { gte: since } },
				select: { createdAt: true, success: true },
			})
		: [];

	const buckets = new Map<string, { success: number; failed: number }>();
	for (let i = 0; i < DAYS; i += 1) {
		const day = new Date(since);
		day.setUTCDate(day.getUTCDate() + i);
		buckets.set(day.toISOString().slice(0, 10), { success: 0, failed: 0 });
	}
	for (const log of logs) {
		const key = log.createdAt.toISOString().slice(0, 10);
		const bucket = buckets.get(key);
		if (!bucket) continue;
		if (log.success) bucket.success += 1;
		else bucket.failed += 1;
	}

	const days = Array.from(buckets.entries()).map(([date, counts]) => ({ date, ...counts }));
	return NextResponse.json({ days });
}
