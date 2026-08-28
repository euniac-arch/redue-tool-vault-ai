/**
 * Search-query stopword filter + [region + industry + intent] normalization.
 * Run: npx tsx scripts/test-search-query-normalize.ts
 */
import { extractValidSpecialties, isUiStopword, stripUiStopwords } from '../lib/geo/clean-medical-entities';
import {
	composeSearchQuery,
	dedupeQueryTokens,
	extractHourIntent,
	extractIndustrySearchNoun,
	extractMetaQueryTokens,
} from '../lib/geo/search-query-normalize';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${JSON.stringify(detail)}` : ''}`);
}

assert('strip 병원장 인사말', stripUiStopwords('병원장 인사말') === '');
assert('strip 병원 둘러보기 as GNB label', stripUiStopwords('병원 둘러보기') === '');
assert('strip 운영 시스템 안내', stripUiStopwords('운영 시스템 안내') === '');
assert('strip 오시는 길', stripUiStopwords('오시는 길') === '');
assert('strip 의료진 소개', stripUiStopwords('의료진 소개') === '');
assert('keeps 비뇨기질환 stem', stripUiStopwords('비뇨기질환') === '비뇨기질환');
assert('isUiStopword 인사말', isUiStopword('인사말'));
assert('isUiStopword 둘러보기', isUiStopword('병원장 인사말'));
assert('not stopword 슬개골', !isUiStopword('슬개골'));

assert(
	'extractValidSpecialties drops GNB',
	extractValidSpecialties(['병원장 인사말', '병원 둘러보기', '비뇨기질환', '운영 시스템 안내']).join(',') === '비뇨기질환',
	extractValidSpecialties(['병원장 인사말', '병원 둘러보기', '비뇨기질환', '운영 시스템 안내']),
);

assert(
	'dedupe repeated 병원',
	dedupeQueryTokens(['수원', '반려동물', '병원', '비뇨기', '병원']).join(' ') === '수원 반려동물 병원 비뇨기',
	dedupeQueryTokens(['수원', '반려동물', '병원', '비뇨기', '병원']),
);

assert(
	'compose main query',
	composeSearchQuery(['수원', '24시', '동물병원'], { trailingIntent: '추천', maxTokens: 5 }) === '수원 24시 동물병원 추천',
);
assert(
	'compose specialty query',
	composeSearchQuery(['수원', '반려동물', '비뇨기질환', '전문', '병원'], { maxTokens: 5 }) ===
		'수원 반려동물 비뇨기 전문 병원',
);
assert(
	'compose stays within 4-5 tokens',
	composeSearchQuery(['수원', '병원장 인사말', '병원 둘러보기', '반려동물', '병원', '비뇨기질환', '운영 시스템 안내'], {
		maxTokens: 5,
	}) === '수원 반려동물 병원 비뇨기',
	composeSearchQuery(['수원', '병원장 인사말', '병원 둘러보기', '반려동물', '병원', '비뇨기질환', '운영 시스템 안내'], {
		maxTokens: 5,
	}),
);

assert(
	'industry from 마음반려동물의료원',
	extractIndustrySearchNoun({ brandName: '마음반려동물의료원', lang: 'ko' }) === '동물병원',
);
assert(
	'industry from VeterinaryCare',
	extractIndustrySearchNoun({ schemaTypes: ['VeterinaryCare'], lang: 'ko' }) === '동물병원',
);
assert(
	'industry from dental brand',
	extractIndustrySearchNoun({ brandName: '센텀스마일치과', lang: 'ko' }) === '치과',
);
assert('hour intent from meta', extractHourIntent('수원 24시 응급 동물병원') === '24시');
assert('hour intent not invented', extractHourIntent('수원 내과 의원') === '');

const metaTokens = extractMetaQueryTokens({
	title: '마음반려동물의료원 | 수원 24시 동물병원',
	metaDescription: '비뇨기, 슬개골, 건강검진',
	ogDescription: '병원장 인사말과 병원 둘러보기, 운영 시스템 안내',
	metaKeywords: '수원 동물병원, 비뇨기',
});
assert(
	'meta tokens keep services and drop GNB',
	metaTokens.some((t) => /비뇨기|슬개골|건강검진|동물병원/.test(t)) &&
		metaTokens.every((t) => !/인사말|둘러보기|운영시스템|안내/.test(t)),
	metaTokens,
);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nsearch-query-normalize: all assertions passed');
