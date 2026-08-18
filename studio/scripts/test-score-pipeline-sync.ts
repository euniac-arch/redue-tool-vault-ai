/**
 * End-to-end score pipeline: 5-category sum = 122 raw, 100-point conversion,
 * GEO category 5 ↔ AI-trust defects, history ↔ result parity.
 * Run: npx tsx scripts/test-score-pipeline-sync.ts
 */
import { calculateComprehensiveAuditScoreFromOnpage, normalizeTo100 } from '../lib/audit/auditScoreCalculator';
import { countAuditDefects, countAuditWarnings, countAuditVerdicts } from '../lib/audit/latest-audit-payload';
import { buildOnPageDiagnostic } from '../lib/audit/onpage-diagnostic';
import { resolveAuditScoreFromHistory, resolveAuditScoreFromReport } from '../lib/audit/resolveAuditScore';
import { resolveAiBotsAllowed } from '../lib/audit/robots-ai-bots';
import { buildDiagnosisScoreSnapshot } from '../lib/audit/diagnosis-scores';
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
	checklist: [] as AuditCheckItem[],
	metrics: {
		titleLength: 20,
		metaDescriptionLength: 80,
		h1Count: 1,
		headingSkipDetected: true,
		imagesTotal: 4,
		imagesMissingAlt: 0,
		imageAltCoveragePct: 100,
		jsonLdBlockCount: 1,
		schemaTypes: ['Organization'],
		bodyTextLength: 400,
		renderBlockingScripts: 6,
		hasLlmsTxt: false,
		aiBotAccess: { gptbot: true, perplexitybot: true, claudebot: true, 'google-extended': true },
	},
} as AuditReport;
report.checklist = report.categories.flatMap((c) => c.checks);

const onpage = buildOnPageDiagnostic(report);
const categorySum = onpage.categories.reduce((sum, cat) => sum + cat.rawScore, 0);
const snapshot = buildDiagnosisScoreSnapshot(report, null, 'ko');
const fromReport = resolveAuditScoreFromReport(report);
const fromHistory = resolveAuditScoreFromHistory({ score: report.score, maxScore: report.maxScore, report });
const fromOnpage = calculateComprehensiveAuditScoreFromOnpage(onpage, { isHttps: true, lang: 'ko' });

assert('category maxes are 15+12+29+36+30', onpage.categories.map((c) => c.maxScore).join('+') === '15+12+29+36+30');
assert('category max sum is 122', onpage.categories.reduce((sum, cat) => sum + cat.maxScore, 0) === 122);
assert('category raw sum === onpage total', categorySum === onpage.totalRawScore, `${categorySum} vs ${onpage.totalRawScore}`);
assert('headline raw === category sum', snapshot.rawTechnicalScore === categorySum);
assert('122→100 is Math.round(raw/122*100)', snapshot.technicalScore === Math.round((categorySum / 122) * 100));
assert('normalizeTo100 matches', snapshot.technicalScore === normalizeTo100(categorySum, 122));

const geoCat = onpage.categories.find((c) => c.id === 'geo')!;
assert('GEO category max is 30', geoCat.maxScore === 30);
assert(
	'GEO card defects are fail-only',
	geoCat.defectCount === 2 && geoCat.warningCount === 1,
	`${geoCat.defectCount}/${geoCat.warningCount}`,
);
assert(
	'GEO section packet matches category 5 card',
	snapshot.geoAiMeasured.rawScore === geoCat.rawScore &&
		snapshot.geoAiMeasured.maxScore === geoCat.maxScore &&
		snapshot.geoAiMeasured.score100 === geoCat.score100 &&
		snapshot.geoAiMeasured.defectCount === geoCat.defectCount &&
		snapshot.geoAiMeasured.warningCount === geoCat.warningCount,
);

const verdicts = countAuditVerdicts(report);
assert('defectCount is fail-only (not warnings)', verdicts.defectCount === 5, String(verdicts.defectCount));
assert('warningCount is warning-only', verdicts.warningCount === 4, String(verdicts.warningCount));
assert('countAuditDefects === fail total', countAuditDefects(report) === verdicts.defectCount);
assert('countAuditWarnings === warning total', countAuditWarnings(report) === verdicts.warningCount);
assert(
	'category defect sum === global fail count',
	onpage.categories.reduce((sum, cat) => sum + cat.defectCount, 0) === verdicts.defectCount,
);

assert('history normalized === result normalized', fromHistory.normalizedScore === fromReport.normalizedScore);
assert('history raw === result raw', fromHistory.totalEarnedScore === fromReport.totalEarnedScore);
assert('history === onpage calculator', fromHistory.normalizedScore === fromOnpage.normalizedScore);
assert(
	'history GEO category === result GEO category',
	fromHistory.categories.geoAi.score === fromOnpage.categories.geoAi.score &&
		fromHistory.categories.geoAi.defectCount === fromOnpage.categories.geoAi.defectCount,
);

assert('all four bots allowed → true', resolveAiBotsAllowed({
	gptbot: true,
	perplexitybot: true,
	claudebot: true,
	'google-extended': true,
}) === true);
assert('ClaudeBot blocked → false (matches category 5)', resolveAiBotsAllowed({
	gptbot: true,
	perplexitybot: true,
	claudebot: false,
	'google-extended': true,
}) === false);
assert('Google-Extended blocked → false', resolveAiBotsAllowed({
	gptbot: true,
	perplexitybot: true,
	claudebot: true,
	'google-extended': false,
}) === false);
assert('missing robots.txt → allowed', resolveAiBotsAllowed(undefined, true) === true);
assert('checklist fail without access map → false', resolveAiBotsAllowed(undefined, false) === false);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall score-pipeline-sync assertions passed');
