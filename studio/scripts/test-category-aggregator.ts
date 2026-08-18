/**
 * CategoryScoreIntegrity: 5-bucket reclassification never exceeds max,
 * and radar axes stay 1:1 with those buckets.
 * Run: npx tsx scripts/test-category-aggregator.ts
 */
import {
	STANDARD_CATEGORY_ITEM_COUNT,
	STANDARD_CATEGORY_MAX,
	STANDARD_CATEGORY_TOTAL_MAX,
	aggregateCategoryScores,
	assertCategoryIntegrity,
	buildSyncedRadarScores,
	calculate5CategoryScores,
	resolveCategoryVerdict,
	resolveItemCategory,
} from '../lib/audit/categoryAggregator';
import { AUDIT_CHECKLIST_DEFINITIONS, CHECKLIST_TOTAL_MAX } from '../lib/audit/checklistDefinitions';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

assert('24 items', AUDIT_CHECKLIST_DEFINITIONS.length === 24);
assert(
	'5 category maxes sum to 122',
	STANDARD_CATEGORY_MAX.security_infra +
		STANDARD_CATEGORY_MAX.web_perf_access +
		STANDARD_CATEGORY_MAX.basic_seo +
		STANDARD_CATEGORY_MAX.schema_data +
		STANDARD_CATEGORY_MAX.geo_ai_signals ===
		CHECKLIST_TOTAL_MAX,
	JSON.stringify(STANDARD_CATEGORY_MAX),
);
assert('total max is 122', STANDARD_CATEGORY_TOTAL_MAX === 122);
assert('item counts are 2+3+7+6+6', STANDARD_CATEGORY_ITEM_COUNT.security_infra === 2);
assert('web_perf_access has 3 items', STANDARD_CATEGORY_ITEM_COUNT.web_perf_access === 3);
assert('basic_seo has 7 items', STANDARD_CATEGORY_ITEM_COUNT.basic_seo === 7);
assert('schema_data has 6 items', STANDARD_CATEGORY_ITEM_COUNT.schema_data === 6);
assert('geo_ai_signals has 6 items', STANDARD_CATEGORY_ITEM_COUNT.geo_ai_signals === 6);

assert('https → security_infra', resolveItemCategory({ id: 'https' }) === 'security_infra');
assert('html-lang → basic_seo', resolveItemCategory({ id: 'html-lang' }) === 'basic_seo');
assert('person-eeat → geo_ai_signals', resolveItemCategory({ id: 'person-eeat' }) === 'geo_ai_signals');
assert('faq-howto-schema → schema_data', resolveItemCategory({ id: 'faq-howto-schema' }) === 'schema_data');
assert('image-alt → web_perf_access', resolveItemCategory({ id: 'image-alt' }) === 'web_perf_access');
assert('jsonld-present → schema_data', resolveItemCategory({ id: 'jsonld-present' }) === 'schema_data');
assert('website-schema → schema_data', resolveItemCategory({ id: 'website-schema' }) === 'schema_data');
assert(
	'stale geo tag is ignored when id maps to schema',
	resolveItemCategory({ id: 'faq-howto-schema', category: 'geo_eeat' }) === 'schema_data',
);

const overflow = aggregateCategoryScores(
	[
		{ id: 'https', passed: true, status: 'pass', weight: 10 },
		{ id: 'response-time', passed: true, status: 'pass', weight: 5 },
		{ id: 'page-weight', passed: true, status: 'pass', weight: 5 },
		{ id: 'render-blocking', passed: true, status: 'pass', weight: 3 },
		{ id: 'html-lang', passed: true, status: 'pass', weight: 2 },
		{ id: 'image-alt', passed: true, status: 'pass', weight: 4 },
		{ id: 'jsonld-present', passed: true, status: 'pass', weight: 8 },
		{ id: 'organization', passed: true, status: 'pass', weight: 7 },
		{ id: 'article-fields', passed: true, status: 'pass', weight: 6 },
		{ id: 'news-article', passed: true, status: 'pass', weight: 5 },
		{ id: 'website-schema', passed: true, status: 'pass', weight: 4 },
		{ id: 'person-eeat', passed: true, status: 'pass', weight: 5 },
		{ id: 'faq-howto-schema', passed: true, status: 'pass', weight: 6 },
	],
	true,
);

assert('integrity clamp holds', assertCategoryIntegrity(overflow));
const security = overflow.find((row) => row.id === 'security_infra');
const perf = overflow.find((row) => row.id === 'web_perf_access');
const schema = overflow.find((row) => row.id === 'schema_data');
const seo = overflow.find((row) => row.id === 'basic_seo');
const geo = overflow.find((row) => row.id === 'geo_ai_signals');
assert('보안/인프라 never exceeds 15', (security?.earned ?? 99) <= 15 && security?.max === 15, `${security?.earned}/${security?.max}`);
assert('성능/접근성 never exceeds 12', (perf?.earned ?? 99) <= 12 && perf?.max === 12, `${perf?.earned}/${perf?.max}`);
assert('스키마 never exceeds 36', (schema?.earned ?? 99) <= 36 && schema?.max === 36, `${schema?.earned}/${schema?.max}`);
assert('html-lang is not in 성능/접근성', perf?.earned === 12, String(perf?.earned));
assert('faq lands in 스키마 (6 schema items = 36)', schema?.earned === 36, String(schema?.earned));
assert('html-lang lands in SEO', seo?.earned === 2, String(seo?.earned));
assert('person lands in GEO', geo?.earned === 5, String(geo?.earned));

const httpRadar = buildSyncedRadarScores(
	[
		{ id: 'https', passed: false, status: 'fail', weight: 10 },
		{ id: 'response-time', passed: true, status: 'pass', weight: 5 },
		{ id: 'title', passed: true, status: 'pass', weight: 5 },
		{ id: 'jsonld-present', passed: true, status: 'pass', weight: 8 },
		{ id: 'page-weight', passed: true, status: 'pass', weight: 5 },
		{ id: 'render-blocking', passed: true, status: 'pass', weight: 3 },
		{ id: 'image-alt', passed: true, status: 'pass', weight: 4 },
		{ id: 'llms-txt', passed: true, status: 'pass', weight: 6 },
		{ id: 'ai-bots-allowed', passed: true, status: 'pass', weight: 6 },
		{ id: 'faq-howto-schema', passed: true, status: 'pass', weight: 6 },
	],
	false,
);
assert('HTTP radar security is 5/15 = 33', httpRadar.security === Math.round((5 / 15) * 100));
assert('radar seo matches SEO category', httpRadar.seo === Math.round((5 / 29) * 100));
assert('radar schema matches schema category', httpRadar.schema === Math.round((14 / 36) * 100));
assert('radar performance is HTML+render+alt', httpRadar.performance === 100);
assert('radar AI citation is llms+bots', httpRadar.geoSignal === Math.round((12 / 30) * 100));

const httpsRadar = buildSyncedRadarScores(
	[
		{ id: 'https', passed: true, status: 'pass', weight: 10 },
		{ id: 'response-time', passed: true, status: 'pass', weight: 5 },
	],
	true,
);
assert('HTTPS radar security tracks 보안/인프라 100', httpsRadar.security === 100);

const synced = calculate5CategoryScores(
	[
		{ id: 'https', passed: true, status: 'pass', weight: 10 },
		{ id: 'response-time', passed: true, status: 'pass', weight: 5 },
		{ id: 'page-weight', passed: true, status: 'pass', weight: 5 },
		{ id: 'render-blocking', passed: true, status: 'pass', weight: 3 },
		{ id: 'image-alt', passed: true, status: 'pass', weight: 4 },
	],
	true,
);
assert('radarData has 5 axes', synced.radarData.length === 5);
assert(
	'radar scores 1:1 with category percentages',
	synced.radarData.every((axis, i) => axis.score === synced.categories[i].percentage),
);
assert('totalMax is 122', synced.totalMax === 122);

assert('88% 0 defects → Warning', resolveCategoryVerdict(88, 0) === 'Warning');
assert('88% 1 warning → Warning', resolveCategoryVerdict(88, 0, 1) === 'Warning');
assert('78% 1 defect → Warning', resolveCategoryVerdict(78, 1) === 'Warning');
assert('90% 0 defects → Pass', resolveCategoryVerdict(90, 0) === 'Pass');
assert('80% 0 defects → Warning', resolveCategoryVerdict(80, 0) === 'Warning');
assert('79% 0 defects → Warning', resolveCategoryVerdict(79, 0) === 'Warning');
assert('60% 0 defects → Warning', resolveCategoryVerdict(60, 0) === 'Warning');
assert('59% 0 defects → Warning', resolveCategoryVerdict(59, 0) === 'Warning');
assert('49% 0 defects → Fail', resolveCategoryVerdict(49, 0) === 'Fail');
assert('90% 1 defect → Pass (rate badge)', resolveCategoryVerdict(90, 1) === 'Pass');
assert('70% 2 defects → Warning (rate badge)', resolveCategoryVerdict(70, 2) === 'Warning');

const badgeCases = calculate5CategoryScores(
	[
		{ id: 'page-weight', passed: true, status: 'pass', weight: 5 },
		{ id: 'render-blocking', passed: false, status: 'warning', weight: 3 },
		{ id: 'image-alt', passed: true, status: 'pass', weight: 4 },
		{ id: 'title', passed: true, status: 'pass', weight: 5 },
		{ id: 'meta-description', passed: false, status: 'fail', weight: 5 },
		{ id: 'og-tags', passed: true, status: 'pass', weight: 5 },
		{ id: 'canonical', passed: true, status: 'pass', weight: 5 },
		{ id: 'single-h1', passed: true, status: 'pass', weight: 4 },
		{ id: 'heading-skip', passed: false, status: 'warning', weight: 3 },
		{ id: 'html-lang', passed: true, status: 'pass', weight: 2 },
	],
	true,
);
const perfBadge = badgeCases.categories.find((c) => c.id === 'web_perf_access');
const seoBadge = badgeCases.categories.find((c) => c.id === 'basic_seo');
assert(
	'성능 10.5/12 (88, 주의 1) is Warning',
	perfBadge?.percentage === 88 && perfBadge.status === 'Warning',
	`${perfBadge?.percentage} ${perfBadge?.status}`,
);
assert(
	'SEO 22.5/29 (78, 결함 1) is Warning',
	seoBadge?.percentage === 78 && seoBadge.status === 'Warning',
	`${seoBadge?.percentage} ${seoBadge?.status} earned=${seoBadge?.earned}`,
);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall category-aggregator assertions passed');
