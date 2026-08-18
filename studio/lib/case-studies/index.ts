import type { CaseStudyData } from '@/lib/case-study-types';
import { anseongSunshineClinicCaseStudy } from './anseong-sunshine-clinic';
import { SAMPLE_CASE_STUDIES } from './samples';

export { anseongSunshineClinicCaseStudy } from './anseong-sunshine-clinic';
export { SAMPLE_CASE_STUDIES } from './samples';

/** 포트폴리오 리스트에 노출되는 케이스 스터디. 안성햇살의원이 선두, 이어서 샘플. */
export const CASE_STUDIES: CaseStudyData[] = [anseongSunshineClinicCaseStudy, ...SAMPLE_CASE_STUDIES];

export function getCaseStudyById(id: string): CaseStudyData | undefined {
	return CASE_STUDIES.find((item) => item.id === id);
}
