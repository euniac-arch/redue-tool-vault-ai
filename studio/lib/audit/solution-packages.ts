import { PRICING_PLANS, formatKrwAmount, type PricingPlanId } from '@/lib/pricing/plans';

/** Anchor for the paid GEO package CTA — used by the 30-second Quick CTA scroll. */
export const SOLUTION_PACKAGES_ID = 'solution-packages';

export type SolutionPackageId = PricingPlanId;

export const SOLUTION_PACKAGES = PRICING_PLANS;

/** Display-only floor price for Enterprise. */
export const ENTERPRISE_PACKAGE_PRICE_KRW = PRICING_PLANS.enterprise.priceKrw;

export function scrollToSolutionPackages(): void {
	if (typeof document === 'undefined') return;
	document.getElementById(SOLUTION_PACKAGES_ID)?.scrollIntoView({
		behavior: 'smooth',
		block: 'start',
	});
}

export function formatKrw(value: number, locale: 'ko' | 'en' = 'ko'): string {
	return formatKrwAmount(value, locale);
}
