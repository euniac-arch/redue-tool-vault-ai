import 'server-only';

import { prisma } from '@/lib/prisma';

export type DailyUsageService = 'ai_research' | 'youtube_search' | 'audit';
export type DailyUsageActor = 'member' | 'guest';

function seoulDateKey(now = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Seoul',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(now);
}

export function recordDailyApiUsage(input: {
	service: DailyUsageService;
	userId?: string | null;
	actorType?: DailyUsageActor;
}): void {
	const userId = input.userId?.trim() || '';
	const actorType = input.actorType ?? (userId ? 'member' : 'guest');
	const dateKey = seoulDateKey();
	void prisma.dailyApiUsage
		.upsert({
			where: {
				dateKey_userId_service_actorType: {
					dateKey,
					userId,
					service: input.service,
					actorType,
				},
			},
			create: {
				dateKey,
				userId,
				actorType,
				service: input.service,
				count: 1,
			},
			update: { count: { increment: 1 } },
		})
		.catch((error) => {
			console.error('[daily-usage] increment failed:', error);
		});
}
