import { clampScore } from '@/lib/audit/score-grade';

/** Anchor for the paid GEO package CTA — used by the 30-second Quick CTA scroll. */
export const SOLUTION_PACKAGES_ID = 'solution-packages';

export type SolutionPackageId = 'standard' | 'pro' | 'enterprise';

export const SOLUTION_PACKAGES: Record<
	SolutionPackageId,
	{ id: SolutionPackageId; priceKrw: number; openEnded?: boolean }
> = {
	standard: { id: 'standard', priceKrw: 190_000 },
	pro: { id: 'pro', priceKrw: 490_000 },
	enterprise: { id: 'enterprise', priceKrw: 990_000, openEnded: true },
};

/** Display-only floor price for the upcoming Enterprise wide card. */
export const ENTERPRISE_PACKAGE_PRICE_KRW = 990_000;

export type PackageScoreBandId = 'risk' | 'fair' | 'optimized' | 'monopoly';

export const PACKAGE_SCORE_BANDS: ReadonlyArray<{
	id: PackageScoreBandId;
	min: number;
	max: number;
	barPercent: number;
}> = [
	{ id: 'risk', min: 0, max: 49, barPercent: 50 },
	{ id: 'fair', min: 50, max: 74, barPercent: 25 },
	{ id: 'optimized', min: 75, max: 85, barPercent: 11 },
	{ id: 'monopoly', min: 86, max: 100, barPercent: 14 },
];

export interface PackageScoreProjection {
	current: number;
	expected: number;
	delta: number;
	goalLow: number;
	goalHigh: number;
}

export function packageScoreBand(score: number): PackageScoreBandId {
	const n = clampScore(score);
	if (n >= 86) return 'monopoly';
	if (n >= 75) return 'optimized';
	if (n >= 50) return 'fair';
	return 'risk';
}

function roundScore(score: number): number {
	return Math.round(clampScore(score));
}

/** Speed setup: typical +20~+25, target band 65–70. */
export function projectStandardScore(currentScore: number): PackageScoreProjection {
	const current = roundScore(currentScore);
	const expected = Math.max(current, Math.min(current + 22, 70));
	return { current, expected, delta: expected - current, goalLow: 65, goalHigh: 70 };
}

/** Pro: typical +30~+35, target band 80–85. */
export function projectProScore(currentScore: number): PackageScoreProjection {
	const current = roundScore(currentScore);
	const expected = Math.max(current, Math.min(current + 32, 85));
	return { current, expected, delta: expected - current, goalLow: 80, goalHigh: 85 };
}

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
