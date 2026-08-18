/**
 * Live Criteria / GEO algorithm schema mapping + query / josa audit.
 * Run: npx tsx scripts/test-live-criteria-mapping.ts
 */
import { buildCoreChecklistSummaryText, getCoreFailIssueLabels } from '../lib/audit/core-checklist';
import { buildHeuristicGeoNarrative } from '../lib/audit/geo-narrative';
import {
	alignRecommendedSchemas,
	buildMedicalSimulatorQuery,
	coreArticleIssueLabel,
	detectSchemaVertical,
	geoAlgorithmStepBadge,
	resolveRecommendedSchemas,
} from '../lib/audit/recommended-schemas';
import { generateBroadQuery } from '../lib/audit/site-metadata';
import { getJosa, withJosa } from '../lib/korean-josa';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const clinicInput = {
	industry: '의료/클리닉',
	category: '의료/클리닉',
	siteTitle: '안성햇살의원',
	brandName: '안성햇살의원',
	domain: 'anseong-clinic.example',
	primaryKeyword: '정형·통증클리닉',
	industryType: 'MEDICAL',
};

assert('clinic vertical', detectSchemaVertical(clinicInput) === 'medical-clinic');
assert(
	'clinic schemas = MedicalClinic / FAQPage / Person',
	resolveRecommendedSchemas(clinicInput).join(',') === 'MedicalClinic,FAQPage,Person',
	resolveRecommendedSchemas(clinicInput).join(','),
);

const remapped = alignRecommendedSchemas(['Hospital', 'MedicalBusiness', 'FAQPage'], clinicInput);
assert('Hospital remaps to MedicalClinic', remapped[0] === 'MedicalClinic', remapped.join(','));
assert('step 2 stays FAQPage', remapped[1] === 'FAQPage', remapped.join(','));
assert('step 3 is Person', remapped[2] === 'Person', remapped.join(','));

const newsArticleDropped = alignRecommendedSchemas(['NewsArticle', 'Article', 'FAQPage'], clinicInput);
assert(
	'NewsArticle dropped for clinic',
	newsArticleDropped[0] === 'MedicalClinic' && newsArticleDropped[1] === 'FAQPage',
	newsArticleDropped.join(','),
);

assert(
	'step badges 1:1',
	geoAlgorithmStepBadge(1, remapped) === 'LocalBusiness / MedicalClinic' &&
		geoAlgorithmStepBadge(2, remapped) === 'FAQPage / QAPage' &&
		geoAlgorithmStepBadge(3, remapped) === 'Person / Organization',
	[geoAlgorithmStepBadge(1, remapped), geoAlgorithmStepBadge(2, remapped), geoAlgorithmStepBadge(3, remapped)].join(' | '),
);

const dental = resolveRecommendedSchemas({ ...clinicInput, category: '치과', primaryKeyword: '임플란트' });
assert('dental schemas', dental.join(',') === 'Dentist,FAQPage,Person', dental.join(','));

const legal = resolveRecommendedSchemas({ category: '법률 서비스', industry: '법률' });
assert('legal schemas', legal.join(',') === 'LegalService,FAQPage,Person', legal.join(','));

const local = resolveRecommendedSchemas({ industryType: 'LOCAL_STORE', category: '카페' });
assert('local schemas', local.join(',') === 'LocalBusiness,FAQPage,Organization', local.join(','));

const news = resolveRecommendedSchemas({
	industry: '언론/미디어',
	siteTitle: '매일경제 뉴스룸',
	domain: 'example-news.com',
});
assert('news vertical keeps NewsArticle', news[0] === 'NewsArticle', news.join(','));

const query = buildMedicalSimulatorQuery('경기 안성', '정형·통증클리닉', 'ko');
assert(
	'medical query template',
	query === '경기 안성에서 정형·통증클리닉 과잉진료 없이 치료 잘하는 곳 어디야?',
	query,
);
assert(!query.includes('전체에서'), 'query must not use 전체에서');
assert(!query.includes('과잉진료 없고'), 'query must not use 과잉진료 없고');

const generated = generateBroadQuery({
	broadLocation: '경기',
	location: '경기 안성',
	brandName: '안성햇살의원',
	primaryKeyword: '정형·통증클리닉',
	industryType: 'MEDICAL',
});
assert('generateBroadQuery uses specialty + region', generated === query, generated);

assert('을/를: 의료/클리닉 → 을', getJosa('의료/클리닉', '을/를') === '을');
assert('을/를: 전문 서비스 → 를', getJosa('전문 서비스', '을/를') === '를');
assert(
	'withJosa client category',
	withJosa('의료/클리닉', '을/를') === '의료/클리닉을',
);

const narrative = buildHeuristicGeoNarrative({
	domain: 'anseong-clinic.example',
	siteTitle: '안성햇살의원',
	brandName: '안성햇살의원',
	category: '의료/클리닉',
	mainSpecialty: '정형·통증클리닉',
	location: '경기 안성',
	broadLocation: '경기',
	industryType: 'MEDICAL',
	lang: 'ko',
	technicalFails: ['헤딩 계층 구조 미흡'],
});

assert(
	'heuristic recommendedSchemas',
	narrative.recommendedSchemas.join(',') === 'MedicalClinic,FAQPage,Person',
	narrative.recommendedSchemas.join(','),
);
assert(
	'heuristic searchQuery',
	narrative.aiSimulator.searchQuery === query,
	narrative.aiSimulator.searchQuery,
);
assert(
	'heuristic josa on category',
	narrative.beforeImpact.includes('의료/클리닉을'),
	narrative.beforeImpact,
);
assert(!narrative.beforeImpact.includes('NewsArticle'), 'clinic beforeImpact must not cite NewsArticle');

assert(
	'clinic fail label is MedicalWebPage/AboutPage',
	coreArticleIssueLabel('medical-clinic', 'ko') === 'MedicalWebPage/AboutPage 스키마 누락',
);
assert(
	'news fail label stays NewsArticle',
	coreArticleIssueLabel('news', 'ko').includes('NewsArticle'),
);

const healthyCopy = buildCoreChecklistSummaryText({
	items: [],
	brandName: '안성햇살의원',
	industry: '의료/클리닉',
	lang: 'ko',
	vertical: 'medical-clinic',
});
assert(healthyCopy.includes('MedicalWebPage'), 'success copy names MedicalWebPage', healthyCopy);
assert(!healthyCopy.includes('NewsArticle'), 'clinic success copy omits NewsArticle', healthyCopy);

const failLabels = getCoreFailIssueLabels(
	[
		{
			id: 'article-schema',
			status: 'fail',
			tone: 'needs_work',
			checkIds: ['article-fields'],
		},
	],
	'ko',
	'medical-clinic',
);
assert(
	'core fail chip is not NewsArticle for clinic',
	failLabels[0] === 'MedicalWebPage/AboutPage 스키마 누락',
	failLabels.join(','),
);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall live-criteria mapping assertions passed');
