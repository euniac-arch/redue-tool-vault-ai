/**
 * Score-integrity SSOT: 122↔100 proportion, no double HTTPS penalty,
 * Track1/Track2/CWV blend with a fixed security penalty (not a hard cap),
 * checklist raw === card raw, radar security shrinks on HTTP.
 * Run: npx tsx scripts/test-score-integrity.ts
 */
import { buildDiagnosisScoreSnapshot } from '../lib/audit/diagnosis-scores';
import {
	ONPAGE_MAX_SCORE,
	buildOnPageDiagnostic,
	earnedPointsForCheck,
	normalizeChecklistItems,
	normalizeScore100,
	rawTechnicalScoreFromChecks,
} from '../lib/audit/onpage-diagnostic';
import {
	HTTPS_CHECK_ID,
	HTTPS_ENGINE_SCORE_CAP,
	HTTPS_PERCENTILE_FLOOR,
	HTTPS_RAW_POINTS,
	HTTPS_SECURITY_PENALTY,
	blendMeasuredScore,
	calculateComprehensiveScores,
	resolveIsHttps,
	topPercentileFromScore,
} from '../lib/audit/scoreCalculator';
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

function check(id: string, status: AuditCheckItem['status'], weight: number, label = id): AuditCheckItem {
	return { id, label, status, passed: status === 'pass', weight };
}

function category(id: AuditCategory['id'], score: number, maxScore: number, checks: AuditCheckItem[]): AuditCategory {
	return { id, label: id, score, maxScore, status: 'PASS', statusNote: '', checks };
}

function liveCategories(httpsPass: boolean): AuditCategory[] {
	const seoChecks = [
		check('title', 'pass', 5),
		check('meta-description', 'pass', 5),
		check('og-tags', 'pass', 5),
		check('canonical', 'pass', 5),
		check('single-h1', 'pass', 4),
		check('heading-skip', 'pass', 3),
		check('html-lang', 'pass', 2),
	];
	const securityChecks = [
		check(HTTPS_CHECK_ID, httpsPass ? 'pass' : 'fail', HTTPS_RAW_POINTS),
		check('response-time', 'pass', 5),
	];
	const perfChecks = [
		check('page-weight', 'pass', 5),
		check('render-blocking', 'pass', 3),
		check('image-alt', 'pass', 4),
	];
	return [
		category('security', httpsPass ? 15 : 5, 15, securityChecks),
		category('performance', 12, 12, perfChecks),
		category('seo', 29, 29, seoChecks),
		category('schema', 36, 36, [
			check('jsonld-present', 'pass', 8),
			check('organization', 'pass', 7),
			check('article-fields', 'pass', 6),
			check('news-article', 'pass', 5),
			check('website-schema', 'pass', 4),
			check('faq-howto-schema', 'pass', 6),
		]),
		category('geo', 30, 30, [
			check('llms-txt', 'pass', 6),
			check('ai-bots-allowed', 'pass', 6),
			check('person-eeat', 'pass', 5),
			check('crawlable-text', 'pass', 5),
			check('eeat-author', 'pass', 4),
			check('heading-structure', 'pass', 4),
		]),
	];
}

function liveReport(url: string): AuditReport {
	const httpsPass = resolveIsHttps({ url });
	const categories = liveCategories(httpsPass);
	const checklist = categories.flatMap((c) => c.checks);
	const score = categories.reduce((sum, c) => sum + c.score, 0);
	return {
		url,
		lang: 'ko',
		fetchedAt: '2026-08-16T00:00:00.000Z',
		httpStatus: 200,
		responseTimeMs: 80,
		pageSizeBytes: 20_000,
		score,
		maxScore: 122,
		status: 'EXCELLENT',
		statusLabel: '최적화 완료',
		hasSsl: httpsPass,
		categories,
		checklist,
		findings: [],
	};
}

const httpsConverted = calculateComprehensiveScores({
	url: 'https://secure.example/',
	rawTechnicalScore: 122,
	maxRawScore: 122,
	technicalScore: 100,
	geoScore: 90,
	schemaScore100: 100,
	ragScore: 80,
});
assert('HTTPS raw 122 stays 122', httpsConverted.rawTechnicalScore === 122);
assert('HTTPS 122/122 → technical 100', httpsConverted.technicalScore === 100);
assert(
	'HTTPS total is the 40/40/20 blend (cwv falls back to ragScore=80 → 92)',
	httpsConverted.totalScore === 92,
	String(httpsConverted.totalScore),
);
assert('HTTPS grade is S', httpsConverted.grade === 'S');
assert('HTTPS radar security is 95', httpsConverted.radarScores.security === 95);
assert('HTTPS penalty flag is off', httpsConverted.securityPenaltyApplied === false);
assert(
	'HTTPS technical equals round(raw/max*100)',
	httpsConverted.technicalScore === normalizeScore100(httpsConverted.rawTechnicalScore, httpsConverted.maxRawScore),
);

const httpConverted = calculateComprehensiveScores({
	url: 'http://plain.example/',
	rawTechnicalScore: 112,
	maxRawScore: 122,
	technicalScore: normalizeScore100(112, 122),
	geoScore: 90,
	schemaScore100: 100,
	ragScore: 80,
});
const expectedTech = normalizeScore100(112, 122);
assert(
	'HTTP technical is 112/122*100 with no extra −15',
	httpConverted.technicalScore === expectedTech,
	String(httpConverted.technicalScore),
);
assert(
	'HTTP geo stays the measured 90 (no extra −10)',
	httpConverted.geoScore === 90,
	String(httpConverted.geoScore),
);
assert(
	'HTTP composite applies a fixed −15 penalty (89 → 74), not a hard cap to 78',
	httpConverted.totalScore === 74 && httpConverted.grade === 'B',
	`${httpConverted.totalScore} ${httpConverted.grade}`,
);
assert('HTTP security cap flag is on', httpConverted.securityCapped === true);
assert('HTTP cannot be S or A', httpConverted.grade !== 'S' && httpConverted.grade !== 'A');
assert('HTTP radar security shrinks to 20', httpConverted.radarScores.security === 20);
assert('HTTP radar seo matches unpenalized technical', httpConverted.radarScores.seo === httpConverted.technicalScore);
assert('HTTP radar geoSignal matches geo', httpConverted.radarScores.geoSignal === httpConverted.geoScore);
assert('HTTP penalty flag is on', httpConverted.securityPenaltyApplied === true);
assert(
	'HTTP percentile reflects the real composite (74) — the 25 floor only raises weaker percentiles, so 26 stays 26',
	httpConverted.percentile === Math.max(HTTPS_PERCENTILE_FLOOR, topPercentileFromScore(74)),
	String(httpConverted.percentile),
);

// Regression guard for the "항상 78점" bug: two different Track1/Track2/CWV
// inputs must not collapse onto an identical composite once both exceed 78.
const siteA = blendMeasuredScore({ track1: 92, track2: 84, isHttps: false });
const siteB = blendMeasuredScore({ track1: 84, track2: 82, isHttps: false });
assert(
	'different Track1/Track2 inputs no longer collapse onto an identical composite',
	siteA.totalScore !== siteB.totalScore,
	`siteA=${siteA.totalScore} siteB=${siteB.totalScore}`,
);

const httpDoublePenaltyCase = calculateComprehensiveScores({
	url: 'http://plain.example/',
	rawTechnicalScore: 100,
	maxRawScore: 122,
	technicalScore: 82,
	geoScore: 84,
});
assert(
	'100/122 → technical 82 (no second −15)',
	httpDoublePenaltyCase.technicalScore === 82,
	String(httpDoublePenaltyCase.technicalScore),
);
assert(
	'100/122 composite blends to 68 via the fixed −15 penalty, not double-penalized to 67 nor capped at 78',
	httpDoublePenaltyCase.totalScore === 68 && httpDoublePenaltyCase.grade === 'C/D',
	`${httpDoublePenaltyCase.totalScore} ${httpDoublePenaltyCase.grade}`,
);

const httpsLive = liveReport('https://secure.example/');
const httpLive = liveReport('http://plain.example/');
const httpsOnpage = buildOnPageDiagnostic(httpsLive);
const httpOnpage = buildOnPageDiagnostic(httpLive);

assert('live HTTPS raw is 122', httpsOnpage.totalRawScore === ONPAGE_MAX_SCORE, String(httpsOnpage.totalRawScore));
assert(
	'live HTTP raw is 112',
	httpOnpage.totalRawScore === ONPAGE_MAX_SCORE - HTTPS_RAW_POINTS,
	String(httpOnpage.totalRawScore),
);

const httpsItems = normalizeChecklistItems(httpsLive);
const httpItems = normalizeChecklistItems(httpLive);
const httpsHttpsRow = httpsItems.find((c) => c.id === HTTPS_CHECK_ID);
const httpHttpsRow = httpItems.find((c) => c.id === HTTPS_CHECK_ID);
assert('HTTPS row earns 10', earnedPointsForCheck(httpsHttpsRow!) === HTTPS_RAW_POINTS);
assert('HTTPS row max is 10', httpsHttpsRow?.weight === HTTPS_RAW_POINTS);
assert('HTTP row earns 0 (Fail)', earnedPointsForCheck(httpHttpsRow!) === 0 && httpHttpsRow?.status === 'fail');
assert('HTTP HTTPS slot max is 10', httpHttpsRow?.weight === HTTPS_RAW_POINTS);

assert(
	'HTTPS checklist raw === card raw',
	rawTechnicalScoreFromChecks(httpsItems, true) === httpsOnpage.totalRawScore,
	`${rawTechnicalScoreFromChecks(httpsItems, true)} vs ${httpsOnpage.totalRawScore}`,
);
assert(
	'HTTP checklist raw === card raw',
	rawTechnicalScoreFromChecks(httpItems, false) === httpOnpage.totalRawScore,
	`${rawTechnicalScoreFromChecks(httpItems, false)} vs ${httpOnpage.totalRawScore}`,
);

const httpsSnap = buildDiagnosisScoreSnapshot(httpsLive, null, 'ko');
const httpSnap = buildDiagnosisScoreSnapshot(httpLive, null, 'ko');

assert('snapshot raw matches onpage', httpSnap.rawTechnicalScore === httpOnpage.totalRawScore);
assert(
	'snapshot technical equals the raw/max proportion',
	httpSnap.technicalScore === expectedTech,
	String(httpSnap.technicalScore),
);
const httpSnapExpectedBlend = blendMeasuredScore({
	track1: httpSnap.technicalScore,
	track2: httpSnap.externalTrustScore,
	coreWebVitals: httpSnap.scoreBreakdown.coreWebVitals,
	isHttps: httpSnap.isHttps,
});
assert(
	'snapshot measured matches the Track1/Track2/CWV blend minus the fixed security penalty',
	httpSnap.measuredScore === httpSnapExpectedBlend.totalScore,
	`snapshot=${httpSnap.measuredScore} expected=${httpSnapExpectedBlend.totalScore}`,
);
assert('snapshot securityCapped flag is on for HTTP', httpSnap.securityCapped === true);
assert('snapshot grade is B or below', httpSnap.grade === 'B' || httpSnap.grade === 'C/D');
assert('snapshot radar security is 5/15 = 33', httpSnap.radarScores.security === 33);
assert('snapshot onpage is the same 122 packet', httpSnap.onpage.totalRawScore === httpOnpage.totalRawScore);
assert(
	'snapshot technical equals detailed.technicalScore',
	httpSnap.technicalScore === httpSnap.detailed.technicalScore,
);
assert(
	'snapshot measured equals detailed.totalScore',
	httpSnap.measuredScore === httpSnap.detailed.totalScore,
);
const httpsSnapExpectedBlend = blendMeasuredScore({
	track1: httpsSnap.technicalScore,
	track2: httpsSnap.externalTrustScore,
	coreWebVitals: httpsSnap.scoreBreakdown.coreWebVitals,
	isHttps: httpsSnap.isHttps,
});
assert(
	'HTTPS snapshot measured matches the blend with no security penalty (no hard cap involved)',
	httpsSnap.measuredScore === httpsSnapExpectedBlend.totalScore && httpsSnapExpectedBlend.securityPenalty === 0,
	`snapshot=${httpsSnap.measuredScore} expected=${httpsSnapExpectedBlend.totalScore}`,
);
assert('HTTPS snapshot keeps S/A possible', httpsSnap.grade === 'S' || httpsSnap.grade === 'A' || httpsSnap.grade === 'B');
assert('HTTPS snapshot radar security matches perf/infra 100', httpsSnap.radarScores.security === 100);
assert('HTTPS snapshot radar seo matches SEO category 100', httpsSnap.radarScores.seo === 100);
assert('HTTPS snapshot radar schema matches schema category 100', httpsSnap.radarScores.schema === 100);
assert(
	'snapshot.scores is the same packet as detailed',
	httpSnap.scores.totalScore === httpSnap.detailed.totalScore &&
		httpSnap.scores.rawScore122 === httpSnap.rawTechnicalScore &&
		httpSnap.scores.technicalScore === httpSnap.technicalScore &&
		httpSnap.scores.geoScore === httpSnap.externalTrustScore,
);
assert(
	'auditScore.normalizedScore === technicalScore',
	httpSnap.auditScore.normalizedScore === httpSnap.technicalScore,
	`${httpSnap.auditScore.normalizedScore} vs ${httpSnap.technicalScore}`,
);
assert(
	'auditScore raw totals match snapshot',
	httpSnap.auditScore.totalEarnedScore === httpSnap.rawTechnicalScore &&
		httpSnap.auditScore.totalMaxScore === httpSnap.maxRawScore,
	`${httpSnap.auditScore.totalEarnedScore}/${httpSnap.auditScore.totalMaxScore}`,
);
assert(
	'5-category sum === headline raw',
	httpSnap.onpage.categories.reduce((sum, cat) => sum + cat.rawScore, 0) === httpSnap.rawTechnicalScore,
	String(httpSnap.onpage.categories.reduce((sum, cat) => sum + cat.rawScore, 0)),
);
assert(
	'122→100 formula is round(raw/max*100)',
	httpSnap.technicalScore === Math.round((httpSnap.rawTechnicalScore / httpSnap.maxRawScore) * 100),
);
assert(
	'geoAiMeasured matches category 5 card',
	httpSnap.geoAiMeasured.rawScore === httpSnap.onpage.categories.find((c) => c.id === 'geo')?.rawScore &&
		httpSnap.geoAiMeasured.defectCount === httpSnap.onpage.categories.find((c) => c.id === 'geo')?.defectCount,
);
assert(
	'HTTP engineScores match snapshot.engines',
	httpSnap.engines.every((engine) => httpSnap.scores.engineScores[engine.engine] === engine.score),
	httpSnap.engines.map((e) => `${e.engine}:${e.score}/${httpSnap.scores.engineScores[e.engine]}`).join(', '),
);
assert(
	'HTTP engineScores are capped at 64',
	Object.values(httpSnap.scores.engineScores).every((n) => n <= HTTPS_ENGINE_SCORE_CAP),
	JSON.stringify(httpSnap.scores.engineScores),
);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall score-integrity assertions passed');
