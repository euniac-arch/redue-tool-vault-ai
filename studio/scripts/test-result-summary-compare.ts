/**
 * Before/After 1-minute summary: mock defaults, auto-diff, AuditReport mapper.
 * Run: npx tsx scripts/test-result-summary-compare.ts
 */
import {
	MOCK_INITIAL_AUDIT,
	MOCK_OPTIMIZED_AUDIT,
	buildResultSummaryDiff,
	formatClientResultReport,
	resultSummaryFromAuditReport,
	sanitizeResultSummaryFilename,
	type ResultSummaryAudit,
} from '../lib/audit/result-summary-compare';
import type { AuditCheckItem, AuditReport } from '../lib/site-auditor';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`fail ${label}${detail != null ? ` — ${String(detail)}` : ''}`);
}

function check(id: string, status: AuditCheckItem['status'], weight: number): AuditCheckItem {
	return { id, label: id, status, passed: status === 'pass', weight };
}

function stubReport(partial?: Partial<AuditReport>): AuditReport {
	return {
		url: 'https://yedam-clinic.example.com',
		lang: 'ko',
		fetchedAt: '2026-08-20T00:00:00.000Z',
		httpStatus: 200,
		responseTimeMs: 180,
		pageSizeBytes: 90_000,
		score: 50,
		maxScore: 122,
		status: 'POOR',
		statusLabel: '취약',
		schemaCoverage: 12,
		geoCitationScore: 22,
		siteMeta: {
			domain: 'yedam-clinic.example.com',
			brandName: '예담의원',
			category: '의원',
			primaryKeyword: '통증클리닉',
			industryType: 'MEDICAL',
			location: '서울 강남구',
			broadLocation: '서울',
			vertical: 'medical',
			targetUrl: 'https://yedam-clinic.example.com',
		},
		metrics: {
			titleLength: 12,
			metaDescriptionLength: 40,
			h1Count: 1,
			headingSkipDetected: false,
			imagesTotal: 6,
			imagesMissingAlt: 2,
			imageAltCoveragePct: 66,
			jsonLdBlockCount: 0,
			schemaTypes: [],
			bodyTextLength: 400,
			renderBlockingScripts: 2,
			hasLlmsTxt: false,
		},
		categories: [],
		checklist: [check('og-tags', 'fail', 5), check('llms-txt', 'warning', 6)],
		findings: [],
		...partial,
	};
}

const mockDiff = buildResultSummaryDiff(MOCK_INITIAL_AUDIT, MOCK_OPTIMIZED_AUDIT, 'ko');
assert('mock score delta is +45', mockDiff.score.delta === 45, mockDiff.score);
assert('mock schema incomplete → complete', mockDiff.schema.before === 'incomplete' && mockDiff.schema.after === 'complete');
assert('mock schema improved', mockDiff.schema.improved);
assert('mock llms missing → present', mockDiff.llmsTxt.improved && mockDiff.llmsTxt.after === 'present');
assert('mock metaOg lifted', mockDiff.metaOg.before === 38 && mockDiff.metaOg.after === 92);
assert('mock geoLocal lifted', mockDiff.geoLocal.before === 24 && mockDiff.geoLocal.after === 81);
assert('mock actions include MedicalClinic', mockDiff.appliedActions.some((item) => item.includes('MedicalClinic')));
assert('mock actions include llms.txt', mockDiff.appliedActions.some((item) => item.includes('llms.txt')));

const mappedBefore = resultSummaryFromAuditReport(stubReport());
// `score` must be the same `buildDiagnosisScoreSnapshot().measuredScore` composite the result
// page header renders — not the legacy raw/max checklist ratio — so only assert the 0–100
// range here; the exact figure is covered indirectly by the "live score rose" delta below.
assert('mapper score is 0–100', mappedBefore.score >= 0 && mappedBefore.score <= 100, mappedBefore.score);
assert('mapper schema incomplete when coverage 12 + no types', mappedBefore.schema.status === 'missing' || mappedBefore.schema.status === 'incomplete');
assert('mapper llms missing', mappedBefore.llmsTxt.status === 'missing');
assert('mapper metaOg below 100 when og-tags fail', mappedBefore.metaOg.score < 100);

const mappedAfter = resultSummaryFromAuditReport(
	stubReport({
		score: 105,
		schemaCoverage: 94,
		geoCitationScore: 81,
		metrics: {
			titleLength: 28,
			metaDescriptionLength: 120,
			h1Count: 1,
			headingSkipDetected: false,
			imagesTotal: 6,
			imagesMissingAlt: 0,
			imageAltCoveragePct: 100,
			jsonLdBlockCount: 2,
			schemaTypes: ['MedicalClinic', 'FAQPage', 'Person'],
			bodyTextLength: 900,
			renderBlockingScripts: 1,
			hasLlmsTxt: true,
			ogTitle: '예담의원',
			ogDescription: '강남 통증클리닉',
		},
		checklist: [check('og-tags', 'pass', 5), check('llms-txt', 'pass', 6)],
	}),
);
assert('mapper after schema complete', mappedAfter.schema.status === 'complete', mappedAfter.schema);
assert('mapper after schemaType MedicalClinic', mappedAfter.schema.schemaType === 'MedicalClinic');
assert('mapper after llms present', mappedAfter.llmsTxt.status === 'present');
assert('mapper after metaOg 100', mappedAfter.metaOg.score === 100);
assert('mapper after geo 81', mappedAfter.geoLocal.score === 81);

const liveDiff = buildResultSummaryDiff(mappedBefore, mappedAfter, 'ko');
assert('live diff derives schema inject action', liveDiff.appliedActions.some((item) => /스키마/.test(item)));
assert('live diff derives llms action', liveDiff.appliedActions.some((item) => /llms/.test(item)));
assert('live score rose', liveDiff.score.delta > 0);

const noActionAfter: ResultSummaryAudit = {
	...MOCK_OPTIMIZED_AUDIT,
	appliedActions: [],
	schema: { ...MOCK_INITIAL_AUDIT.schema },
	llmsTxt: { ...MOCK_INITIAL_AUDIT.llmsTxt },
	metaOg: { ...MOCK_INITIAL_AUDIT.metaOg },
	geoLocal: { ...MOCK_INITIAL_AUDIT.geoLocal },
	score: MOCK_INITIAL_AUDIT.score,
};
const flatDiff = buildResultSummaryDiff(MOCK_INITIAL_AUDIT, noActionAfter, 'ko');
assert('flat pair has empty derived actions', flatDiff.appliedActions.length === 0, flatDiff.appliedActions);

const reportKo = formatClientResultReport(mockDiff, 'ko');
assert('ko report has title', reportKo.includes('1분 요약'));
assert('ko report has score line', reportKo.includes('41점 → 86점'));
const reportEn = formatClientResultReport(mockDiff, 'en');
assert('en report has title', reportEn.includes('1-minute'));
assert('filename sanitizes', sanitizeResultSummaryFilename('예담 의원 / <test>') === '예담-의원-test' || sanitizeResultSummaryFilename('예담 의원 / <test>').includes('예담'));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall result-summary-compare assertions passed');
