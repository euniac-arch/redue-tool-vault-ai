import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiLimitsForPlan, generateApiKeySecret, hashApiKey } from '@/lib/api-keys';

export const runtime = 'nodejs';

interface CreateKeyBody {
	label?: string;
}

async function requireUser() {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) return null;
	return session.user.id;
}

/** GET /api/developer/keys — list the signed-in user's API keys with today/this-month usage counts. */
export async function GET() {
	const userId = await requireUser();
	if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const now = new Date();
	const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

	const keys = await prisma.apiKey.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });

	const withUsage = await Promise.all(
		keys.map(async (key) => {
			const [dailyUsed, monthlyUsed, totalCalls] = await Promise.all([
				prisma.apiCallLog.count({ where: { apiKeyId: key.id, createdAt: { gte: startOfDay } } }),
				prisma.apiCallLog.count({ where: { apiKeyId: key.id, createdAt: { gte: startOfMonth } } }),
				prisma.apiCallLog.count({ where: { apiKeyId: key.id } }),
			]);
			return {
				id: key.id,
				label: key.label,
				keyPrefix: key.keyPrefix,
				dailyLimit: key.dailyLimit,
				monthlyLimit: key.monthlyLimit,
				dailyUsed,
				monthlyUsed,
				totalCalls,
				lastUsedAt: key.lastUsedAt,
				revokedAt: key.revokedAt,
				createdAt: key.createdAt,
			};
		})
	);

	return NextResponse.json({ keys: withUsage });
}

/** POST /api/developer/keys — mint a new `redue_live_sk_...` key. The raw secret is returned exactly once. */
export async function POST(request: Request) {
	const userId = await requireUser();
	if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const activeCount = await prisma.apiKey.count({ where: { userId, revokedAt: null } });
	if (activeCount >= 5) {
		return NextResponse.json({ error: '활성 API Key는 최대 5개까지 발급할 수 있습니다. 기존 키를 폐기한 뒤 다시 시도해 주세요.' }, { status: 400 });
	}

	const body = (await request.json().catch(() => ({}))) as CreateKeyBody;
	const label = body.label?.trim() || `API Key ${activeCount + 1}`;

	const user = await prisma.user.findUnique({ where: { id: userId } });
	const { dailyLimit, monthlyLimit } = apiLimitsForPlan(user?.planId ?? 'starter');

	const { rawKey, keyPrefix } = generateApiKeySecret();
	const keyHash = await hashApiKey(rawKey);

	const created = await prisma.apiKey.create({
		data: { userId, label, keyPrefix, keyHash, dailyLimit, monthlyLimit },
	});

	return NextResponse.json({
		rawKey,
		key: {
			id: created.id,
			label: created.label,
			keyPrefix: created.keyPrefix,
			dailyLimit: created.dailyLimit,
			monthlyLimit: created.monthlyLimit,
			createdAt: created.createdAt,
		},
	});
}
