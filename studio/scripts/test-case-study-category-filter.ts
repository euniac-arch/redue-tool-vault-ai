/**
 * 도입사례 대분류 필터 + 진단 카테고리 전문 매칭.
 * Run: npx tsx scripts/test-case-study-category-filter.ts
 */
import {
	CASE_STUDY_FILTER_TABS,
	categoryMajorHead,
	matchesCaseStudyFilter,
} from '../lib/case-studies/category-filter';
import { formatTargetCategory } from '../lib/audit/target-entity';
import type { SiteMetadata } from '../lib/audit/site-metadata';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`fail ${label}${detail != null ? ` — ${String(detail)}` : ''}`);
}

assert(
	'standard tabs stay in order',
	CASE_STUDY_FILTER_TABS.map((tab) => tab.label).join('|') ===
		'전체|의료 / 병원·클리닉|숙박 / 한옥·스테이|법률 / 법무법인|이커머스 / 쇼핑몰|교육 / 학원',
);

assert('head of 의료 / 피부시술 is 의료', categoryMajorHead('의료 / 피부시술') === '의료');
assert('head of medical/derma is medical', categoryMajorHead('medical/derma') === 'medical');

assert(
	'의료 / 피부시술 matches medical tab',
	matchesCaseStudyFilter('의료 / 피부시술', 'medical'),
);
assert(
	'피부시술 still matches medical via 피부',
	matchesCaseStudyFilter('피부시술', 'medical'),
);
assert(
	'medical/derma matches medical tab',
	matchesCaseStudyFilter('medical/derma', 'medical'),
);
assert(
	'의료 / 피부시술 does not match lodging',
	!matchesCaseStudyFilter('의료 / 피부시술', 'lodging'),
);
assert('all tab accepts any category', matchesCaseStudyFilter('의료 / 피부시술', 'all'));
assert('empty category does not match medical', !matchesCaseStudyFilter('', 'medical'));

const formatted = formatTargetCategory(
	{
		industryType: 'MEDICAL',
		category: '피부시술',
		primaryKeyword: '피부시술',
	} as SiteMetadata,
	'ko',
);
assert('formatTargetCategory keeps 의료 / 피부시술', formatted === '의료 / 피부시술', formatted);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall passed');
