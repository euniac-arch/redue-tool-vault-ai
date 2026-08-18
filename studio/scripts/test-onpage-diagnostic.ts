/**
 * Verifies the 122-point on-page diagnostic math, 100-point headline,
 * 5-category hierarchy (15+12+29+36+30), and Pass / Warning / Fail verdicts.
 * Run: npx tsx scripts/test-onpage-diagnostic.ts
 */
import {
	CATEGORY_MAX_SCORES,
	GROUP_MAX_SCORES,
	ONPAGE_MAX_SCORE,
	buildOnPageDiagnostic,
	diagnosticGradeFromScore,
	getCategoryStatusInfo,
	normalizeChecklistItems,
	normalizeScore100,
	resolveDiagnosticStatus,
	roundRawScore,
	scoreFromChecks,
} from '../lib/audit/onpage-diagnostic';
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
	return {
		id,
		label: id,
		score,
		maxScore,
		status: 'PASS',
		statusNote: '',
		checks,
	};
}

const weightSum =
	CATEGORY_MAX_SCORES.security +
	CATEGORY_MAX_SCORES.performance +
	CATEGORY_MAX_SCORES.seo +
	CATEGORY_MAX_SCORES.schema +
	CATEGORY_MAX_SCORES.geo;

assert('category max scores sum to 122', weightSum === ONPAGE_MAX_SCORE, String(weightSum));
assert(
	'5-group max scores sum to 122',
	GROUP_MAX_SCORES.security +
		GROUP_MAX_SCORES.performance +
		GROUP_MAX_SCORES.seo +
		GROUP_MAX_SCORES.schema +
		GROUP_MAX_SCORES.geo ===
		ONPAGE_MAX_SCORE,
);
assert('security group is 15', GROUP_MAX_SCORES.security === 15);
assert('performance/a11y group is 12', GROUP_MAX_SCORES.performance === 12);
assert('SEO max is 29', CATEGORY_MAX_SCORES.seo === 29);
assert('schema max is 36', CATEGORY_MAX_SCORES.schema === 36);
assert('GEO max is 30', CATEGORY_MAX_SCORES.geo === 30);

assert('54.5 / 122 → 45', normalizeScore100(54.5, 122) === 45, String(normalizeScore100(54.5, 122)));
assert('0 / 122 → 0', normalizeScore100(0, 122) === 0);
assert('122 / 122 → 100', normalizeScore100(122, 122) === 100);
assert('roundRawScore keeps one decimal', roundRawScore(54.55) === 54.6);

assert('90+ → pass', resolveDiagnosticStatus(90, 0, 0) === 'pass');
assert('100 → pass', resolveDiagnosticStatus(100, 0, 0) === 'pass');
assert('89 → warning', resolveDiagnosticStatus(89, 0, 0) === 'warning');
assert('50 → warning', resolveDiagnosticStatus(50, 0, 0) === 'warning');
assert('88 + warning count still warning (rate)', resolveDiagnosticStatus(88, 0, 1) === 'warning');
assert('64 + defect still warning (rate badge)', resolveDiagnosticStatus(64, 1, 0) === 'warning');
assert('90 + defect still pass (rate badge)', resolveDiagnosticStatus(90, 1, 0) === 'pass');
assert('45 → fail', resolveDiagnosticStatus(45, 0, 0) === 'fail');
assert('49 → fail', resolveDiagnosticStatus(49, 0, 0) === 'fail');
assert('70 + 3 fail → warning (rate)', resolveDiagnosticStatus(70, 3, 1) === 'warning');
assert('59 → warning (50–89)', resolveDiagnosticStatus(59, 0, 0) === 'warning');

const failByDefect = getCategoryStatusInfo(90, 100, 1, 0);
assert('badge/footer: 90% + 결함 → 양호 + 결함 1건', failByDefect.statusLabel === '양호' && failByDefect.summaryText === '결함 1건');
const failByScore = getCategoryStatusInfo(45, 100, 0, 0);
assert('badge/footer: 45점 → 미흡 + 달성률 미흡', failByScore.statusLabel === '미흡' && failByScore.summaryText === '달성률 미흡');
const warnByWarning = getCategoryStatusInfo(88, 100, 0, 1);
assert('badge/footer: 88% + 주의 → 주의 + 주의 1건', warnByWarning.statusLabel === '주의' && warnByWarning.summaryText === '주의 1건');
const warnByScore = getCategoryStatusInfo(70, 100, 0, 0);
assert('badge/footer: 70점 → 주의 + 보완 권장', warnByScore.statusLabel === '주의' && warnByScore.summaryText === '보완 권장');
const passInfo = getCategoryStatusInfo(90, 100, 0, 0);
assert('badge/footer: 90점 무이슈 → 양호 + 정상 / 우수 ✓', passInfo.statusLabel === '양호' && passInfo.summaryText === '정상 / 우수 ✓');
const seo64 = getCategoryStatusInfo(18.5, 29, 1, 0);
assert('SEO 18.5/29 (64%) + 결함 → 주의', seo64.statusLabel === '주의' && seo64.summaryText === '결함 1건');
const geo60 = getCategoryStatusInfo(18, 30, 1, 0);
assert('GEO 18/30 (60%) + 결함 → 주의', geo60.statusLabel === '주의' && geo60.summaryKind === 'defect');
const schema21 = getCategoryStatusInfo(7.5, 36, 2, 0);
assert('스키마 7.5/36 (21%) → 미흡', schema21.statusLabel === '미흡' && schema21.summaryCount === 2);
const mismatchGuard = getCategoryStatusInfo(88, 100, 0, 1);
assert('no 양호+주의 엇갈림', mismatchGuard.status === 'warning' && mismatchGuard.summaryKind === 'warning');
const defectGuard = getCategoryStatusInfo(90, 100, 1, 2);
assert('90% badge stays 양호; footer keeps 결함', defectGuard.status === 'pass' && defectGuard.summaryKind === 'defect' && defectGuard.summaryCount === 1);

assert('grade 45 → F', diagnosticGradeFromScore(45) === 'F');
assert('grade 60 → D', diagnosticGradeFromScore(60) === 'D');
assert('grade 75 → C', diagnosticGradeFromScore(75) === 'C');
assert('grade 82 → B', diagnosticGradeFromScore(82) === 'B');
assert('grade 91 → A', diagnosticGradeFromScore(91) === 'A');

const exampleReport = {
	url: 'https://example.com/',
	hasSsl: true,
	lang: 'ko',
	score: 20,
	maxScore: 122,
	categories: [
		category('seo', 99, 37, [
			check('title', 'pass', 5),
			check('meta-description', 'fail', 5),
			check('og-tags', 'warning', 5),
			check('html-lang', 'pass', 2),
		]),
		category('security', 99, 15, [
			check('https', 'pass', 10),
			check('response-time', 'pass', 5),
		]),
		category('performance', 99, 12, [
			check('page-weight', 'warning', 5),
			check('image-alt', 'fail', 4),
		]),
		category('schema', 99, 36, [check('jsonld-present', 'fail', 8), check('organization', 'warning', 7)]),
		category('geo', 99, 30, [
			check('faq-howto-schema', 'fail', 6),
			check('ai-bots-allowed', 'warning', 6),
			check('llms-txt', 'warning', 6),
		]),
	],
} as Pick<AuditReport, 'score' | 'maxScore' | 'categories' | 'lang' | 'url' | 'hasSsl'>;

const diagnostic = buildOnPageDiagnostic(exampleReport);
const seoEarned = 5 + 0 + 2.5 + 2;
const securityEarned = 10 + 5;
const perfEarned = 2.5 + 0;
const schemaEarned = 0 + 3.5;
const geoEarned = 0 + 3 + 3;
const exampleRaw = seoEarned + securityEarned + perfEarned + schemaEarned + geoEarned;
assert('example raw is rebucketed by item id', diagnostic.totalRawScore === exampleRaw, String(diagnostic.totalRawScore));
assert(
	'example headline matches raw/122',
	diagnostic.normalizedScore === normalizeScore100(exampleRaw, ONPAGE_MAX_SCORE),
	String(diagnostic.normalizedScore),
);
assert('example max is definition total', diagnostic.maxPossibleScore === ONPAGE_MAX_SCORE);
assert('five detail categories', diagnostic.categories.length === 5);
assert('five summary groups', diagnostic.groups.length === 5);
assert(
	'no category earned exceeds max',
	diagnostic.categories.every((c) => c.rawScore <= c.maxScore),
	diagnostic.categories.map((c) => `${c.id}:${c.rawScore}/${c.maxScore}`).join(', '),
);

const security = diagnostic.groups.find((g) => g.id === 'security');
assert('security max = 15', security?.maxScore === 15);
assert('security raw = 15', security?.rawScore === 15, String(security?.rawScore));
const perf = diagnostic.groups.find((g) => g.id === 'performance');
assert('performance max = 12', perf?.maxScore === 12);
assert('performance raw = 2.5', perf?.rawScore === 2.5, String(perf?.rawScore));

const seo = diagnostic.categories.find((c) => c.id === 'seo');
assert('seo 9.5/29 (<50) is Fail even if stored PASS', seo?.status === 'fail', seo?.status);
assert('seo defect/warning counts', seo?.defectCount === 1 && seo.warningCount === 1);
assert(
	'each category exposes measured checks',
	diagnostic.categories.every((c) => Array.isArray(c.checks)),
);
assert('seo checks include fail and warning rows', (seo?.checks.length ?? 0) >= 2);
assert('seo max is 29 not stored 37', seo?.maxScore === 29, String(seo?.maxScore));
assert('seo earned clamped below max', (seo?.rawScore ?? 99) <= 29);

const schemaCat = diagnostic.categories.find((c) => c.id === 'schema');
assert('schema max is 36 not stored 35', schemaCat?.maxScore === 36, String(schemaCat?.maxScore));
assert('schema earned 3.5 ≤ 36', (schemaCat?.rawScore ?? 99) <= 36);

const highScoreWithFail = buildOnPageDiagnostic({
	lang: 'ko',
	score: 28,
	maxScore: 122,
	categories: [
		category('seo', 28, 29, [
			check('title', 'pass', 5),
			check('meta-description', 'fail', 5),
			check('og-tags', 'pass', 5),
			check('canonical', 'pass', 5),
			check('single-h1', 'pass', 4),
			check('heading-skip', 'pass', 3),
			check('html-lang', 'pass', 2),
		]),
	],
});
const highSeo = highScoreWithFail.categories.find((c) => c.id === 'seo');
assert(
	'~83/100 category with 1 Fail is Warning (rate badge)',
	highSeo?.status === 'warning' && (highSeo?.score100 ?? 0) >= 80,
	`${highSeo?.status} / ${highSeo?.score100}`,
);

const warningOnly = buildOnPageDiagnostic({
	lang: 'en',
	score: 26,
	maxScore: 122,
	categories: [
		category('seo', 26, 29, [
			check('title', 'pass', 5),
			check('meta-description', 'pass', 5),
			check('og-tags', 'pass', 5),
			check('canonical', 'pass', 5),
			check('single-h1', 'pass', 4),
			check('heading-skip', 'warning', 3),
			check('html-lang', 'pass', 2),
		]),
	],
});
const warnSeo = warningOnly.categories.find((c) => c.id === 'seo');
assert('90+ with warnings only is Pass (rate badge)', warnSeo?.status === 'pass', warnSeo?.status);
assert('EN status text is English', /solid|fundamentals/i.test(warnSeo?.statusText || ''), warnSeo?.statusText);

assert(
	'score identity: raw/122*100',
	diagnostic.normalizedScore === normalizeScore100(diagnostic.totalRawScore, ONPAGE_MAX_SCORE),
);
assert('scoreFromChecks pass+warn', scoreFromChecks([check('a', 'pass', 8), check('b', 'warning', 4)]) === 10);

const clinicNewsFail = {
	lang: 'ko' as const,
	score: 32,
	maxScore: 122,
	siteMeta: {
		domain: 'clinic.example',
		brandName: '햇살의원',
		category: '정형외과',
		industryType: 'MEDICAL',
		location: '안성',
		broadLocation: '경기',
		vertical: 'medical' as const,
		targetUrl: 'https://clinic.example',
	},
	metrics: {
		titleLength: 12,
		metaDescriptionLength: 80,
		h1Count: 1,
		headingSkipDetected: false,
		imagesTotal: 2,
		imagesMissingAlt: 0,
		imageAltCoveragePct: 100,
		jsonLdBlockCount: 1,
		schemaTypes: ['MedicalClinic', 'FAQPage'],
		bodyTextLength: 400,
		renderBlockingScripts: 0,
	},
	categories: [
		category('seo', 29, 29, [check('title', 'pass', 5)]),
		category('performance', 15, 15, [check('ttfb', 'pass', 6)]),
		category(
			'schema',
			25,
			37,
			[
				check('jsonld', 'pass', 8),
				check('organization', 'pass', 7),
				{ id: 'news-article', label: 'NewsArticle', status: 'fail' as const, passed: false, weight: 5, why: 'NewsArticle 누락' },
			],
		),
		category('accessibility', 15, 15, [check('lang', 'pass', 5)]),
		category('geo', 26, 26, [check('faq', 'pass', 7)]),
	],
};
const remapped = normalizeChecklistItems(clinicNewsFail);
const newsItem = remapped.find((c) => c.id === 'news-article');
assert('clinic NewsArticle fail remaps off fail', newsItem?.status !== 'fail', newsItem?.status);
assert('clinic NewsArticle label is core schema', /MedicalClinic|LocalBusiness/.test(newsItem?.label || ''), newsItem?.label);
assert('clinic NewsArticle why is pass rationale', /통과|not required/i.test(newsItem?.why || ''), newsItem?.why);

const clinicDiag = buildOnPageDiagnostic(clinicNewsFail);
assert(
	'clinic remap scores schema jsonld+org+core+faq = 26 / 36',
	clinicDiag.categories.find((c) => c.id === 'schema')?.rawScore === 26,
	String(clinicDiag.categories.find((c) => c.id === 'schema')?.rawScore),
);
assert(
	'clinic schema max is 36',
	clinicDiag.categories.find((c) => c.id === 'schema')?.maxScore === 36,
);
assert(
	'clinic headline matches raw/122',
	clinicDiag.normalizedScore === normalizeScore100(clinicDiag.totalRawScore, clinicDiag.maxPossibleScore),
);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall onpage-diagnostic assertions passed');
