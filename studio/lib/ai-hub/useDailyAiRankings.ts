'use client';

import { useCallback, useEffect, useState } from 'react';
import {
	getKstDateKey,
	msUntilNextKstMidnight,
	type DailyAiRankingsResponse,
	type RankedLiveAiTool,
} from '@/lib/ai-hub/live-ai-rankings';

type CacheSlot = {
	date: string;
	includeHidden: boolean;
	payload: DailyAiRankingsResponse;
	fetchedAt: number;
};

const memory = new Map<string, CacheSlot>();

function cacheKey(date: string, includeHidden: boolean): string {
	return `${date}:${includeHidden ? 'all' : 'public'}`;
}

async function fetchDailyAiRankings(options: {
	includeHidden?: boolean;
	forceRefresh?: boolean;
	date?: string;
}): Promise<DailyAiRankingsResponse> {
	const date = options.date ?? getKstDateKey();
	const params = new URLSearchParams();
	params.set('date', date);
	if (options.includeHidden) params.set('includeHidden', '1');
	if (options.forceRefresh) params.set('refresh', '1');

	const res = await fetch(`/api/ai-rankings/daily?${params.toString()}`, {
		cache: options.forceRefresh ? 'no-store' : 'default',
	});
	const data = (await res.json().catch(() => null)) as (DailyAiRankingsResponse & { error?: string }) | null;
	if (!res.ok || !data || !Array.isArray(data.tools)) {
		throw new Error(data?.error || '일간 AI 순위를 불러오지 못했습니다.');
	}
	return data;
}

export function useDailyAiRankings(options?: { includeHidden?: boolean }) {
	const includeHidden = options?.includeHidden === true;
	const date = getKstDateKey();
	const key = cacheKey(date, includeHidden);
	const cached = memory.get(key);

	const [payload, setPayload] = useState<DailyAiRankingsResponse | null>(cached?.payload ?? null);
	const [loading, setLoading] = useState(!cached);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(
		async (forceRefresh = false) => {
			const today = getKstDateKey();
			const slotKey = cacheKey(today, includeHidden);
			if (!forceRefresh) {
				const hit = memory.get(slotKey);
				if (hit && hit.date === today) {
					setPayload(hit.payload);
					setLoading(false);
					setError(null);
					return hit.payload;
				}
			}

			setLoading(true);
			setError(null);
			try {
				const next = await fetchDailyAiRankings({ includeHidden, forceRefresh, date: today });
				memory.set(slotKey, { date: today, includeHidden, payload: next, fetchedAt: Date.now() });
				setPayload(next);
				return next;
			} catch (err) {
				const message = err instanceof Error ? err.message : '일간 AI 순위를 불러오지 못했습니다.';
				setError(message);
				throw err;
			} finally {
				setLoading(false);
			}
		},
		[includeHidden],
	);

	useEffect(() => {
		void load(false).catch(() => {
			/* error state is set inside load */
		});
	}, [load, date]);

	useEffect(() => {
		let timeoutId = 0;
		const arm = () => {
			timeoutId = window.setTimeout(() => {
				void load(true).catch(() => undefined);
				arm();
			}, msUntilNextKstMidnight());
		};
		arm();
		return () => window.clearTimeout(timeoutId);
	}, [load]);

	return {
		date: payload?.date ?? date,
		updatedAt: payload?.updatedAt ?? null,
		tools: (payload?.tools ?? []) as RankedLiveAiTool[],
		analysis: payload?.analysis ?? null,
		categories: payload?.categories ?? [],
		loading,
		error,
		refetch: () => load(true),
	};
}
