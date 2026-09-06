export type PricingPlanId = 'speed' | 'pro' | 'enterprise';

export const PRICING_PLAN_IDS = ['speed', 'pro', 'enterprise'] as const satisfies ReadonlyArray<PricingPlanId>;

export const PRICING_PLANS: Record<
	PricingPlanId,
	{
		id: PricingPlanId;
		priceKrw: number;
		openEnded: boolean;
		items: number;
		benefits: number;
		href: '/contact' | '/enterprise';
	}
> = {
	speed: {
		id: 'speed',
		priceKrw: 190_000,
		openEnded: false,
		items: 4,
		benefits: 3,
		href: '/contact',
	},
	pro: {
		id: 'pro',
		priceKrw: 490_000,
		openEnded: false,
		items: 5,
		benefits: 4,
		href: '/contact',
	},
	enterprise: {
		id: 'enterprise',
		priceKrw: 990_000,
		openEnded: true,
		items: 5,
		benefits: 4,
		href: '/enterprise',
	},
};

export function formatKrwAmount(value: number, locale: 'ko' | 'en' = 'ko'): string {
	return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ko-KR').format(Math.round(value));
}

/** Landing + audit share this so list prices cannot drift. */
export function formatPlanPrice(priceKrw: number, locale: 'ko' | 'en' = 'ko', openEnded = false): string {
	const amount = formatKrwAmount(priceKrw, locale);
	if (!openEnded) return `₩${amount}`;
	return locale === 'en' ? `₩${amount}+` : `₩${amount}~`;
}
