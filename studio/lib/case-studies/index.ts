import type { CaseStudyData } from '@/lib/case-study-types';

/**
 * Static case-study registry is intentionally empty.
 * Public 도입 사례 cards come only from `getLiveCaseStudies()` (admin-toggled
 * real projects). Hand-authored industry mocks have been removed.
 */
export const CASE_STUDIES: CaseStudyData[] = [];

export function getCaseStudyById(_id: string): CaseStudyData | undefined {
	return undefined;
}
