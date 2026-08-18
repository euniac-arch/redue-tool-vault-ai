/**
 * AuditScore SSOT: 122↔100, S/A/B/C/D, 양호/주의/미흡, history ↔ result parity.
 * Run: npx tsx scripts/test-audit-score-calculator.ts
 */
import {
	AUDIT_CATEGORY_CONFIG,
	AUDIT_TOTAL_MAX_SCORE,
	CATEGORY_DEFINITIONS,
	CATEGORY_KEYS,
	calculateCategory,
	calculateComprehensiveAuditScore,
	calculateComprehensiveAuditScoreFromOnpage,
	evaluateAuditData,
	gradeFromNormalizedScore,
	normalizeTo100,
	resolveAuditStatus,
	resolveCategoryKey,
} from '../lib/audit/auditScoreCalculator';
import { CHECKLIST_CATEGORY_MAX, CHECKLIST_TOTAL_MAX } from '../lib/audit/checklistDefinitions';
import { buildOnPageDiagnostic, getCategoryStatusInfo } from '../lib/audit/onpage-diagnostic';
import { resolveAuditScoreFromHistory } from '../lib/audit/resolveAuditScore';
import type { AuditCategory, AuditCheckItem, AuditReport } from '../lib/site-auditor';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function check(id: string, status: AuditCheckItem['status'], weight: number): AuditCheckItem {
	return { id, label: id, status, passed: status === 'pass', weight };
}

function category(
	id: AuditCategory['id'],
	score: number,
	maxScore: number,
	checks: AuditCheckItem[],
): AuditCategory {
	return { id, label: id, score, maxScore, status: 'PASS', statusNote: '', checks };
}

assert('config maxes match checklist definitions', AUDIT_CATEGORY_CONFIG.security.maxScore === CHECKLIST_CATEGORY_MAX.security_infra);
assert('performance max is 12', AUDIT_CATEGORY_CONFIG.performance.maxScore === 12);
assert('seoBasic max is 29', AUDIT_CATEGORY_CONFIG.seoBasic.maxScore === 29);
assert('schema max is 36', AUDIT_CATEGORY_CONFIG.schema.maxScore === 36);
assert('geoAi max is 30', AUDIT_CATEGORY_CONFIG.geoAi.maxScore === 30);
assert('total max is 122', AUDIT_TOTAL_MAX_SCORE === 122 && AUDIT_TOTAL_MAX_SCORE === CHECKLIST_TOTAL_MAX);
assert('five category keys', CATEGORY_KEYS.length === 5);

assert('69.5 / 122 → 57', normalizeTo100(69.5, 122) === 57, String(normalizeTo100(69.5, 122)));
assert('100 / 122 → 82', normalizeTo100(100, 122) === 82);
assert('122 / 122 → 100', normalizeTo100(122, 122) === 100);
assert('0 / 122 → 0', normalizeTo100(0, 122) === 0);

assert('grade 90 → S', gradeFromNormalizedScore(90) === 'S');
assert('grade 80 → A', gradeFromNormalizedScore(80) === 'A');
assert('grade 70 → B', gradeFromNormalizedScore(70) === 'B');
assert('grade 57 → C/D', gradeFromNormalizedScore(57) === 'C/D');
assert('grade 89 HTTP capped at B', gradeFromNormalizedScore(89, false) === 'B');

assert('status 90 no issues → good', resolveAuditStatus(90, 0, 0) === 'good');
assert('status 89 → warning', resolveAuditStatus(89, 0, 0) === 'warning');
assert('status 50 → warning', resolveAuditStatus(50, 0, 0) === 'warning');
assert('status 88 + warning still warning (rate)', resolveAuditStatus(88, 0, 1) === 'warning');
assert('status 90 + defect still good (rate badge)', resolveAuditStatus(90, 1, 0) === 'good');
assert('status 64 + defect → warning', resolveAuditStatus(64, 1, 0) === 'warning');
assert('status 49 → poor', resolveAuditStatus(49, 0, 0) === 'poor');
assert('status 45 → poor', resolveAuditStatus(45, 0, 0) === 'poor');

const mismatchExample = calculateComprehensiveAuditScore({
	totalEarnedScore: 69.5,
	totalMaxScore: 122,
	categoryList: [
		{ id: 'security', score: 10, maxScore: 15, defectCount: 0, warningCount: 1 },
		{ id: 'performance', score: 10.5, maxScore: 12, defectCount: 0, warningCount: 1 },
		{ id: 'seo', score: 20, maxScore: 29, defectCount: 1, warningCount: 0 },
		{ id: 'schema', score: 18, maxScore: 36, defectCount: 2, warningCount: 0 },
		{ id: 'geo', score: 11, maxScore: 30, defectCount: 1, warningCount: 1 },
	],
});

assert('headline raw is 69.5 / 122', mismatchExample.totalEarnedScore === 69.5 && mismatchExample.totalMaxScore === 122);
assert('headline normalized is 57', mismatchExample.normalizedScore === 57, String(mismatchExample.normalizedScore));
assert('headline grade is C/D', mismatchExample.grade === 'C/D');
assert('headline gradeLabel is 미흡 / 위험', mismatchExample.gradeLabel === '미흡 / 위험');
assert('seo alias maps to seoBasic', mismatchExample.categories.seoBasic.score === 20);
assert('geo alias maps to geoAi', mismatchExample.categories.geoAi.status === 'poor');
assert('security warning badge is 주의', mismatchExample.categories.security.statusLabel === '주의');
assert('security summary is 주의 1건', mismatchExample.categories.security.summaryText === '주의 1건');
assert('seoBasic 20/29 is 주의 (69%)', mismatchExample.categories.seoBasic.statusLabel === '주의');
assert('seoBasic footer is 결함 1건', mismatchExample.categories.seoBasic.summaryText === '결함 1건');

const perf = calculateCategory('performance', { score: 10.5, maxScore: 12, warningCount: 1 });
assert('10.5/12 → 88%', perf.percentage === 88);
assert('10.5/12 + warning → 주의', perf.status === 'warning' && perf.statusLabel === '주의');

const passCard = getCategoryStatusInfo(15, 15, 0, 0);
const calcPass = calculateCategory('security', { score: 15, maxScore: 15 });
assert(
	'getCategoryStatusInfo matches calculator (양호)',
	passCard.statusLabel === calcPass.statusLabel && passCard.summaryText === '정상 / 우수 ✓',
);

const userExample = evaluateAuditData({
	security: { score: 15 },
	performance: { score: 6.5 },
	seoBasic: { score: 18.5, defectCount: 1 },
	schema: { score: 7.5, defectCount: 2 },
	geoAi: { score: 18, defectCount: 1 },
});
assert('user example raw is 65.5 / 122', userExample.totalEarnedScore === 65.5 && userExample.totalMaxScore === 122);
assert('user example headline is 54', userExample.normalizedTotalScore === 54, String(userExample.normalizedTotalScore));
assert(
	'user example percents are 100/54/64/21/60',
	userExample.categories.map((c) => c.percentage).join(',') === '100,54,64,21,60',
	userExample.categories.map((c) => `${c.id}:${c.percentage}`).join(','),
);
assert(
	'user example badges are 양호/주의/주의/미흡/주의',
	userExample.categories.map((c) => c.statusLabel).join(',') === '양호,주의,주의,미흡,주의',
	userExample.categories.map((c) => `${c.id}:${c.statusLabel}`).join(','),
);
assert('CATEGORY_DEFINITIONS max sum is 122', Object.values(CATEGORY_DEFINITIONS).reduce((sum, def) => sum + def.maxScore, 0) === 122);

assert('alias seo → seoBasic', resolveCategoryKey('seo') === 'seoBasic');
assert('alias geo_ai_signals → geoAi', resolveCategoryKey('geo_ai_signals') === 'geoAi');
assert('alias basic_seo → seoBasic', resolveCategoryKey('basic_seo') === 'seoBasic');

const report = {
	url: 'https://example.com/',
	hasSsl: true,
	lang: 'ko' as const,
	score: 69.5,
	maxScore: 122,
	categories: [
		category('security', 10, 15, [check('https', 'pass', 10), check('response-time', 'warning', 5)]),
		category('performance', 10.5, 12, [
			check('page-weight', 'pass', 5),
			check('render-blocking', 'warning', 3),
			check('image-alt', 'pass', 4),
		]),
		category('seo', 20, 29, [
			check('title', 'pass', 5),
			check('meta-description', 'pass', 5),
			check('og-tags', 'fail', 5),
			check('canonical', 'pass', 5),
			check('single-h1', 'pass', 4),
			check('heading-skip', 'warning', 3),
			check('html-lang', 'pass', 2),
		]),
		category('schema', 18, 36, [
			check('jsonld-present', 'pass', 8),
			check('organization', 'pass', 7),
			check('article-fields', 'fail', 6),
			check('faq-howto-schema', 'fail', 6),
			check('news-article', 'warning', 5),
			check('website-schema', 'pass', 4),
		]),
		category('geo', 11, 30, [
			check('llms-txt', 'fail', 6),
			check('ai-bots-allowed', 'pass', 6),
			check('crawlable-text', 'pass', 5),
			check('person-eeat', 'fail', 5),
			check('eeat-author', 'warning', 4),
			check('heading-structure', 'pass', 4),
		]),
	],
} as AuditReport;

const onpage = buildOnPageDiagnostic(report);
const fromOnpage = calculateComprehensiveAuditScoreFromOnpage(onpage, { isHttps: true, lang: 'ko' });
const fromHistory = resolveAuditScoreFromHistory({
	score: report.score,
	maxScore: report.maxScore,
	report,
});

assert(
	'history packet === onpage packet (normalized)',
	fromHistory.normalizedScore === fromOnpage.normalizedScore,
	`${fromHistory.normalizedScore} vs ${fromOnpage.normalizedScore}`,
);
assert(
	'history packet === onpage packet (raw)',
	fromHistory.totalEarnedScore === fromOnpage.totalEarnedScore &&
		fromHistory.totalMaxScore === fromOnpage.totalMaxScore,
);
assert(
	'history grade === onpage grade',
	fromHistory.grade === fromOnpage.grade,
	`${fromHistory.grade} vs ${fromOnpage.grade}`,
);
assert(
	'history category statuses match onpage',
	fromHistory.categoryList.every((cat) => {
		const peer = fromOnpage.categories[cat.id];
		return peer.status === cat.status && peer.statusLabel === cat.statusLabel && peer.percentage === cat.percentage;
	}),
);

const legacy = resolveAuditScoreFromHistory({
	score: 69.5,
	maxScore: 122,
	categories: [
		{ id: 'security', score: 10, maxScore: 15, status: 'WARN' },
		{ id: 'performance', score: 10.5, maxScore: 12, status: 'WARN' },
		{ id: 'seo', score: 20, maxScore: 29, status: 'FAIL' },
		{ id: 'schema', score: 18, maxScore: 36, status: 'FAIL' },
		{ id: 'geo', score: 11, maxScore: 30, status: 'FAIL' },
	],
});
assert('legacy history still normalizes 69.5/122 → 57', legacy.normalizedScore === 57);
assert('legacy history grade is C/D', legacy.grade === 'C/D');
assert('legacy FAIL row badge follows 69% → 주의', legacy.categories.seoBasic.statusLabel === '주의');
assert('legacy FAIL row footer is 결함 1건', legacy.categories.seoBasic.summaryText === '결함 1건');

const driftedHeadline = calculateComprehensiveAuditScore({
	totalEarnedScore: 99,
	totalMaxScore: 122,
	categoryList: [
		{ id: 'security', score: 10, maxScore: 15 },
		{ id: 'performance', score: 10.5, maxScore: 12 },
		{ id: 'seo', score: 20, maxScore: 29 },
		{ id: 'schema', score: 18, maxScore: 36 },
		{ id: 'geo', score: 11, maxScore: 30 },
	],
});
assert(
	'explicit total cannot drift from category sum',
	driftedHeadline.totalEarnedScore === 69.5 && driftedHeadline.normalizedScore === 57,
	`${driftedHeadline.totalEarnedScore} / ${driftedHeadline.normalizedScore}`,
);
assert(
	'onpage packet raw equals category sum',
	fromOnpage.totalEarnedScore ===
		fromOnpage.categoryList.reduce((sum, cat) => sum + cat.score, 0),
);
assert(
	'history raw equals onpage category sum',
	fromHistory.totalEarnedScore === fromOnpage.totalEarnedScore,
);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall audit-score-calculator assertions passed');
