'use client';

import { fetchAdminApi } from '@/lib/admin/admin-api';
import type { AnalyticsRangeResponse } from '@/lib/analytics/types';

/** Fetches daily analytics aggregates for an inclusive `YYYY-MM-DD` range via the admin API. */
export async function fetchAnalyticsRange(start: string, end: string): Promise<AnalyticsRangeResponse> {
	const query = new URLSearchParams({ start, end });
	const result = await fetchAdminApi<AnalyticsRangeResponse>(`/api/admin/analytics?${query.toString()}`);
	if (!result.ok) {
		throw new Error(result.message || '분석 데이터를 불러오지 못했습니다.');
	}
	return result.data;
}
