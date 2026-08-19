/**
 * HTTPS security gate: raw HTTPS slot, pure technical proportion, B-grade hard cap, P0 card.
 * Run: npx tsx scripts/test-https-security-gate.ts
 */
import { buildPrioritizedActions } from '../lib/audit/action-priority';
import { buildDiagnosisScoreSnapshot } from '../lib/audit/diagnosis-scores';
import { calculateTriggerDepths } from '../lib/audit/triggerDepthEngine';
import { buildGeoDiagnosticReportFromAudit } from '../lib/geo/from-visibility';
import { buildOnPageDiagnostic } from '../lib/audit/onpage-diagnostic';
import {
	HTTPS_ENGINE_SCORE_CAP,
	HTTPS_GRADE_HARD_CAP,
	HTTPS_P0_LABEL,
	HTTPS_PERCENTILE_FLOOR,
	HTTPS_RAW_POINTS,
	calculateAuditScores,
	resolveIsHttps,
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

function perfectCategories(httpsPass: boolean): AuditCategory[] {
	const seo = [
		check('title', 'pass', 5),
		check('meta-description', 'pass', 5),
		check('og-tags', 'pass', 5),
		check('canonical', 'pass', 5),
		check('single-h1', 'pass', 4),
		check('heading-skip', 'pass', 3),
		check('html-lang', 'pass', 2),
	];
	const security = [
		check('https', httpsPass ? 'pass' : 'fail', HTTPS_RAW_POINTS),
		check('response-time', 'pass', 5),
	];
	const perf = [
		check('page-weight', 'pass', 5),
		check('render-blocking', 'pass', 3),
		check('image-alt', 'pass', 4),
	];
	return [
		category('security', httpsPass ? 15 : 5, 15, security),
		category('performance', 12, 12, perf),
		category('seo', 29, 29, seo),
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

function report(url: string): AuditReport {
	const httpsPass = resolveIsHttps({ url });
	const categories = perfectCategories(httpsPass);
	return {
		url,
		lang: 'ko',
		fetchedAt: '2026-08-16T00:00:00.000Z',
		httpStatus: 200,
		responseTimeMs: 80,
		pageSizeBytes: 20_000,
		score: httpsPass ? 122 : 112,
		maxScore: 122,
		status: 'EXCELLENT',
		statusLabel: '최적화 완료',
		hasSsl: httpsPass,
		categories,
		checklist: categories.flatMap((c) => c.checks),
		findings: [],
	};
}

assert('https:// is HTTPS', resolveIsHttps({ url: 'https://secure.example/' }) === true);
assert('http:// is not HTTPS', resolveIsHttps({ url: 'http://plain.example/' }) === false);
assert('hasSsl overrides http URL', resolveIsHttps({ url: 'http://plain.example/', hasSsl: true }) === true);
assert('missing URL does not penalize', resolveIsHttps({}) === true);

const httpsScores = calculateAuditScores({
	url: 'https://secure.example/',
	technicalScore: 98,
	geoScore: 98,
});
assert('HTTPS keeps 98 technical', httpsScores.technicalScore === 98);
assert('HTTPS keeps S-range total', httpsScores.totalScore === 98 && httpsScores.grade === 'S');
assert('HTTPS has no security alert', httpsScores.securityCriticalAlert === null);
assert('HTTPS penalty flag is off', httpsScores.securityPenaltyApplied === false);
assert('HTTPS percentile is 2', httpsScores.percentile === 2);

const httpScores = calculateAuditScores({
	url: 'http://plain.example/',
	technicalScore: 98,
	geoScore: 98,
});
assert(
	'HTTP technical stays a pure 98 (no extra −15)',
	httpScores.technicalScore === 98,
	String(httpScores.technicalScore),
);
assert(
	'HTTP geo stays a pure 98 (no extra −10)',
	httpScores.geoScore === 98,
	String(httpScores.geoScore),
);
assert(
	'HTTP composite is hard-capped at 78',
	httpScores.totalScore === HTTPS_GRADE_HARD_CAP && httpScores.grade === 'B',
	`${httpScores.totalScore} ${httpScores.grade}`,
);
assert('HTTP security cap flag is on', httpScores.securityCapped === true);
assert('HTTP security alert is set', Boolean(httpScores.securityCriticalAlert));
assert('HTTP cannot be S or A', httpScores.grade !== 'S' && httpScores.grade !== 'A');
assert('HTTP penalty flag is on', httpScores.securityPenaltyApplied === true);
assert('HTTP percentile is floored at 25', httpScores.percentile === HTTPS_PERCENTILE_FLOOR);

const httpOnpage = buildOnPageDiagnostic(report('http://plain.example/'));
assert(
	'HTTP raw loses the 10-point HTTPS slot',
	httpOnpage.totalRawScore === 122 - HTTPS_RAW_POINTS,
	String(httpOnpage.totalRawScore),
);
assert('HTTP on-page headline is not 100', httpOnpage.normalizedScore < 100);

const httpsOnpage = buildOnPageDiagnostic(report('https://secure.example/'));
assert('HTTPS raw stays 122', httpsOnpage.totalRawScore === 122, String(httpsOnpage.totalRawScore));
assert('HTTPS on-page headline is 100', httpsOnpage.normalizedScore === 100);

const snapshot = buildDiagnosisScoreSnapshot(report('http://plain.example/'), null, 'ko');
assert(
	'snapshot technical is the raw/max proportion (no extra −15)',
	snapshot.technicalScore === Math.round((112 / 122) * 100),
	String(snapshot.technicalScore),
);
const snapshotBlend = Math.round(snapshot.technicalScore * 0.5 + snapshot.externalTrustScore * 0.5);
assert(
	'snapshot securityCapped only when the blend exceeded 78',
	snapshot.securityCapped === snapshotBlend > HTTPS_GRADE_HARD_CAP,
	`${snapshot.securityCapped} blend=${snapshotBlend} measured=${snapshot.measuredScore}`,
);
assert(
	'snapshot measured is at or below the B hard cap',
	snapshot.measuredScore <= HTTPS_GRADE_HARD_CAP,
	String(snapshot.measuredScore),
);
assert('snapshot grade fields are B or below', snapshot.geoGrade !== 'S' && snapshot.technicalGrade !== 'S');
assert('snapshot GEO grade cannot be S or A', snapshot.geoGrade !== 'S' && snapshot.geoGrade !== 'A');
assert('snapshot GEO percentile is not top 6%', snapshot.geoPercentile > 6);
assert(
	'snapshot GEO card score === calculator geoScore',
	snapshot.reputation.overview.score === snapshot.detailed.geoScore &&
		snapshot.externalTrustScore === snapshot.detailed.geoScore,
	`${snapshot.reputation.overview.score} vs ${snapshot.detailed.geoScore}`,
);
assert(
	'snapshot GEO diagnosis is the HTTPS critical sentence',
	snapshot.reputation.overview.summary.includes('[치명적]') &&
		snapshot.reputation.overview.summary.includes('HTTPS'),
	snapshot.reputation.overview.summary,
);
assert(
	'HTTP engines are capped at 64 (no 상위 노출)',
	snapshot.engines.every((engine) => engine.score <= HTTPS_ENGINE_SCORE_CAP && engine.status !== 'optimal'),
	snapshot.engines.map((e) => `${e.engine}:${e.score}:${e.status}`).join(', '),
);
assert(
	'HTTP engine Why leads with the HTTPS critical cause',
	snapshot.engines.every((engine) => engine.analysisReason.includes('[치명적]') && engine.analysisReason.includes('HTTPS')),
	snapshot.engines.map((e) => e.analysisReason).join(' | '),
);
assert('snapshot measured cannot be S/A', snapshot.measuredScore < 80);
assert('snapshot exposes HTTPS alert', Boolean(snapshot.securityCriticalAlert));
assert('snapshot isHttps is false', snapshot.isHttps === false);

const triggerDepths = calculateTriggerDepths(
	'테스트브랜드',
	'서울',
	'서비스',
	snapshot.scores.engineScores,
	snapshot.isHttps,
);
assert(
	'HTTP trigger depths lock every engine at Level 1',
	Object.values(triggerDepths).every((sim) => sim.currentLevel === 1 && sim.isLockedBySecurity),
);
assert(
	'HTTP trigger tags lead with security warnings',
	Object.values(triggerDepths).every(
		(sim) => sim.tags[0] === '#HTTPS보안미적용' && sim.tags[1] === '#비보안출처_추천제한',
	),
);
const httpDiagnostic = buildGeoDiagnosticReportFromAudit(report('http://plain.example/'), 'ko');
assert(
	'HTTP GEO diagnostic stays at brand-only Level 1',
	httpDiagnostic.engines.every((engine) => engine.depthLevel === 1 && engine.currentStatus?.isLockedBySecurity),
);

const actions = buildPrioritizedActions(
	[
		check('https', 'fail', 10, HTTPS_P0_LABEL.ko),
		check('title', 'fail', 5),
		check('faq-howto-schema', 'fail', 7),
	],
	{ newsVertical: false },
);
assert('P0 HTTPS card is first', actions[0]?.id === 'https' && actions[0]?.priority === 'P0', actions[0]?.id);
assert('P0 label is the HTTPS SSL card', actions[0]?.label === HTTPS_P0_LABEL.ko);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall HTTPS security-gate assertions passed');
