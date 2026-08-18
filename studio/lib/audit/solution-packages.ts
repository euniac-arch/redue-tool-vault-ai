/** Anchor for the paid GEO package CTA — used by the 30-second Quick CTA scroll. */
export const SOLUTION_PACKAGES_ID = 'solution-packages';

export type SolutionPackageId = 'standard' | 'pro';

export const SOLUTION_PACKAGES: Record<
	SolutionPackageId,
	{ id: SolutionPackageId; priceKrw: number }
> = {
	standard: { id: 'standard', priceKrw: 190_000 },
	pro: { id: 'pro', priceKrw: 490_000 },
};

/** Display-only floor price for the upcoming Enterprise wide card. */
export const ENTERPRISE_PACKAGE_PRICE_KRW = 990_000;

export function scrollToSolutionPackages(): void {
	if (typeof document === 'undefined') return;
	document.getElementById(SOLUTION_PACKAGES_ID)?.scrollIntoView({
		behavior: 'smooth',
		block: 'start',
	});
}

export function formatKrw(value: number, locale: 'ko' | 'en' = 'ko'): string {
	return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ko-KR').format(Math.round(value));
}
