import { fetchAdminApi } from '@/lib/admin/admin-api';
import type { FetchSubscriptionsResult, SubscriptionFilters, SubscriptionPlanId, SubscriptionRow } from '@/lib/admin/subscription-management';

export async function fetchSubscriptions(input: {
	filters: SubscriptionFilters;
	page: number;
	pageSize: number;
	enabled?: boolean;
}): Promise<FetchSubscriptionsResult> {
	const query = new URLSearchParams({
		q: input.filters.query,
		plan: input.filters.plan,
		page: String(input.page),
		pageSize: String(input.pageSize),
	});
	const result = await fetchAdminApi<FetchSubscriptionsResult>(`/api/admin/subscriptions?${query.toString()}`, {
		enabled: input.enabled,
	});
	if (!result.ok) throw new Error(result.message || '구독 목록을 불러오지 못했습니다.');
	return result.data;
}

export async function updateSubscriptionPlan(userId: string, planId: SubscriptionPlanId): Promise<SubscriptionRow> {
	const result = await fetchAdminApi<SubscriptionRow>(`/api/admin/subscriptions/${encodeURIComponent(userId)}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ planId }),
	});
	if (!result.ok) throw new Error(result.message || '플랜을 변경하지 못했습니다.');
	return result.data;
}
