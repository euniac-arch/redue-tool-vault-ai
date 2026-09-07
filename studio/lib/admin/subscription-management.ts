export type SubscriptionPlanId = 'starter' | 'speed' | 'pro' | 'agency' | 'enterprise';

export const SUBSCRIPTION_PLAN_LABEL: Record<SubscriptionPlanId, string> = {
	starter: 'Free',
	speed: '스피드 셋업',
	pro: 'GEO 프로',
	agency: 'Agency',
	enterprise: 'Enterprise',
};

export const SUBSCRIPTION_PLAN_OPTIONS: { value: SubscriptionPlanId; label: string }[] = [
	{ value: 'starter', label: 'Free' },
	{ value: 'speed', label: '스피드 셋업' },
	{ value: 'pro', label: 'GEO 프로' },
	{ value: 'agency', label: 'Agency' },
	{ value: 'enterprise', label: 'Enterprise' },
];

export type PaymentStatus = 'DONE' | 'PENDING' | 'CANCELED' | 'FAILED' | 'NONE';

export type SubscriptionPayment = {
	id: string;
	planId: string;
	amount: number;
	currency: string;
	provider: string;
	status: string;
	createdAt: string;
};

export type SubscriptionRow = {
	id: string;
	email: string;
	name: string;
	planId: SubscriptionPlanId;
	planLabel: string;
	status: PaymentStatus;
	creditsRemaining: number;
	lastPaidAt: string | null;
	planRenewsAt: string | null;
	totalPaidKrw: number;
	payments: SubscriptionPayment[];
};

export type SubscriptionFilters = {
	query: string;
	plan: 'all' | SubscriptionPlanId;
};

export type SubscriptionKpi = {
	totalMembers: number;
	freeMembers: number;
	paidMembers: number;
	monthlyRevenueKrw: number;
};

export type FetchSubscriptionsResult = {
	items: SubscriptionRow[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
	kpi: SubscriptionKpi;
};

export function normalizeSubscriptionPlanId(value: string | null | undefined): SubscriptionPlanId {
	const plan = (value || '').toLowerCase();
	if (plan === 'speed' || plan === 'pro' || plan === 'agency' || plan === 'enterprise') return plan;
	return 'starter';
}

export function formatKrw(value: number): string {
	return `₩${value.toLocaleString('ko-KR')}`;
}
