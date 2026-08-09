export type PlanId = 'starter' | 'pro' | 'agency' | 'topup';

export interface PlanDefinition {
	id: PlanId;
	name: string;
	price: number; // KRW, 0 for free
	priceUsd: number; // USD, for Stripe overseas checkout (0 for free/not offered)
	credits: number; // credits granted when this plan is purchased/activated
	cycle: 'once' | 'monthly';
	description: string;
	perks: string[];
	/** External /api/v1/* daily & monthly call caps granted to API keys owned by a user on this plan. */
	apiDailyLimit: number;
	apiMonthlyLimit: number;
}

/**
 * Single source of truth for pricing — consumed by `PricingModal` (client,
 * to render tiers and kick off Toss checkout) and `/api/payments/toss/confirm`
 * (server, to validate the paid amount and grant the right number of credits).
 */
export const PLANS: Record<PlanId, PlanDefinition> = {
	starter: {
		id: 'starter',
		name: 'Starter',
		price: 0,
		priceUsd: 0,
		credits: 1,
		cycle: 'once',
		description: '가입 시 1회 무료 체험',
		perks: ['AI 스캔 및 주입 1회 무료 체험'],
		apiDailyLimit: 5,
		apiMonthlyLimit: 20,
	},
	pro: {
		id: 'pro',
		name: 'Pro',
		price: 29000,
		priceUsd: 29,
		credits: 10,
		cycle: 'monthly',
		description: '월 10회 주입 + 전체 CMS 자동 감지',
		perks: ['월 10회 스키마 주입', '전체 CMS 자동 감지', '이메일 지원'],
		apiDailyLimit: 50,
		apiMonthlyLimit: 1000,
	},
	agency: {
		id: 'agency',
		name: 'Agency',
		price: 99000,
		priceUsd: 99,
		credits: 50,
		cycle: 'monthly',
		description: '월 50회 주입 + 무제한 원본 백업',
		perks: ['월 50회 스키마 주입', '무제한 원본 백업 보관', '우선 지원'],
		apiDailyLimit: 300,
		apiMonthlyLimit: 6000,
	},
	topup: {
		id: 'topup',
		name: '1회 단건 충전권',
		price: 5000,
		priceUsd: 4,
		credits: 1,
		cycle: 'once',
		description: '크레딧 1회 즉시 충전',
		perks: ['크레딧 1회 즉시 충전 (플랜 변경 없음)'],
		apiDailyLimit: 5,
		apiMonthlyLimit: 20,
	},
};

export function getPurchasablePlans(): PlanDefinition[] {
	return [PLANS.pro, PLANS.agency, PLANS.topup];
}

export function findPlanByAmount(amount: number): PlanDefinition | null {
	return Object.values(PLANS).find((plan) => plan.price === amount) ?? null;
}
