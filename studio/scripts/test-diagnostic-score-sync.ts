/**
 * Admin diagnostic history ↔ live engine score sync + rerun list patch.
 * Run: npx tsx scripts/test-diagnostic-score-sync.ts
 */
import {
	applyDiagnosticRerunToList,
	isDiagnosticRerunTarget,
	scoreToStatus,
	toDiagnosticRecord,
	type DiagnosticRecord,
} from '../lib/admin/diagnostic-management';
import { buildDiagnosticFromReport } from '../lib/admin/diagnostic-from-audit';
import { liveResultToDiagnosticInput } from '../lib/admin/live-diagnostic-persist';
import {
	composeLiveDiagnosticScores,
	LIVE_SCORE_WEIGHTS,
	LIVE_SCORE_WEIGHT_TOTAL,
	scoreLiveDiagnosticFromAuditReport,
} from '../lib/admin/live-diagnostic-scores';
import { buildDiagnosisScoreSnapshot } from '../lib/audit/diagnosis-scores';
import { resolveReportTrack3Score, type PageSpeedSnapshot } from '../lib/audit/pagespeed';
import type { LiveDiagnosticResult } from '../lib/admin/liveDiagnosticTypes';
import type { AuditCheckItem, AuditReport } from '../lib/site-auditor';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail != null ? ` — ${String(detail)}` : ''}`);
}

function check(id: string, status: AuditCheckItem['status']): AuditCheckItem {
	return { id, label: id, status, passed: status === 'pass', weight: 5 };
}

const composed = composeLiveDiagnosticScores({ meta: 26, jsonLd: 40, knowledgeGraph: 4 });
assert('weights are Meta 30 + JSON-LD 40 + KG 30', LIVE_SCORE_WEIGHTS.meta + LIVE_SCORE_WEIGHTS.jsonLd + LIVE_SCORE_WEIGHTS.knowledgeGraph === 100);
assert('weight total is 100', LIVE_SCORE_WEIGHT_TOTAL === 100);
assert('26+40+4 overall is 70', composed.overall === 70, composed.overall);
assert('schema 40/40 → 100', composed.schema === 100);
assert('KG 4/30 → 13', composed.knowledgeGraph === 13);
assert(
	'geo uses the same 0.55/0.45 mix as the live engine',
	composed.geo === Math.round(70 * 0.55 + 13 * 0.45),
	composed.geo,
);

const full = composeLiveDiagnosticScores({ meta: 30, jsonLd: 40, knowledgeGraph: 30 });
assert('perfect pie is 100', full.overall === 100);

const clinicJsonLd = JSON.stringify({
	'@context': 'https://schema.org',
	'@type': ['MedicalClinic', 'MedicalBusiness'],
	name: '나인원의원',
	url: 'http://nineoneclinic.com/',
	telephone: '053-000-0000',
	address: { '@type': 'PostalAddress', addressLocality: '대구 동구' },
	sameAs: ['https://blog.naver.com/nineone'],
});

const report = {
	url: 'http://nineoneclinic.com/',
	lang: 'ko',
	fetchedAt: '2026-08-24T00:00:00.000Z',
	httpStatus: 200,
	responseTimeMs: 120,
	pageSizeBytes: 80_000,
	score: 75,
	maxScore: 122,
	status: 'FAIR',
	statusLabel: '보통',
	hasSsl: false,
	schemaCoverage: 70,
	geoCitationScore: 48,
	siteMeta: {
		domain: 'nineoneclinic.com',
		brandName: '나인원의원',
		category: '피부과',
		industryType: 'MEDICAL',
		ogTitle: '나인원의원',
		ogImage: 'http://nineoneclinic.com/og.jpg',
		title: '나인원의원 | 대구 동구 피부과',
		metaDescription: '대구 동구 울트라클리어엘리트',
		targetUrl: 'http://nineoneclinic.com/',
	},
	metrics: {
		titleLength: 24,
		metaDescriptionLength: 40,
		h1Count: 1,
		headingSkipDetected: false,
		imagesTotal: 4,
		imagesMissingAlt: 1,
		imageAltCoveragePct: 75,
		jsonLdBlockCount: 1,
		schemaTypes: ['MedicalClinic', 'MedicalBusiness'],
		bodyTextLength: 800,
		renderBlockingScripts: 0,
		documentTitle: '나인원의원 | 대구 동구 피부과',
		pageTitle: '나인원의원',
		metaDescription: '대구 동구 울트라클리어엘리트',
		ogTitle: '나인원의원',
		jsonLdSnippets: [clinicJsonLd],
	},
	categories: [],
	findings: [],
	checklist: [check('canonical', 'pass'), check('title', 'pass')],
	collectedUrls: ['https://map.naver.com/p/entry/place/123'],
	footerText: '나인원의원 대구 동구 https://blog.naver.com/nineone',
} as AuditReport;

const fromLive = scoreLiveDiagnosticFromAuditReport(report);
const scanSnapshot = buildDiagnosisScoreSnapshot(report, null, 'ko', {
	coreWebVitalsScore100: resolveReportTrack3Score(report),
});
const history = buildDiagnosticFromReport(report, { id: 'diag-nineone', createdAt: '2026-08-01 09:00' });
assert(
	'audit diagnostic totalScore === result-page measuredScore (no Track 3 yet)',
	history.totalScore === scanSnapshot.measuredScore,
	`${history.totalScore} vs ${scanSnapshot.measuredScore}`,
);
assert('audit diagnostic geoScore === external trust', history.geoScore === scanSnapshot.externalTrustScore);

const psiDesktop = {
	url: report.url,
	strategy: 'desktop',
	fetchedAt: '2026-08-24T00:00:18.000Z',
	categories: [{ id: 'performance', score: 40, tier: 'poor' }],
} as PageSpeedSnapshot;
const psiMobile = {
	url: report.url,
	strategy: 'mobile',
	fetchedAt: '2026-08-24T00:00:18.000Z',
	categories: [{ id: 'performance', score: 20, tier: 'poor' }],
} as PageSpeedSnapshot;
const withPsi = { ...report, pageSpeedDesktop: psiDesktop, pageSpeedMobile: psiMobile };
const track3 = resolveReportTrack3Score(withPsi);
const psiSnapshot = buildDiagnosisScoreSnapshot(withPsi, null, 'ko', { coreWebVitalsScore100: track3 });
const historyWithPsi = buildDiagnosticFromReport(withPsi, { id: 'diag-nineone', createdAt: '2026-08-24 10:00' });
assert('Track 3 average is 30', track3 === 30, track3);
assert(
	'Track 3 backfill updates diagnostic totalScore to the result hero',
	historyWithPsi.totalScore === psiSnapshot.measuredScore,
	`${historyWithPsi.totalScore} vs ${psiSnapshot.measuredScore}`,
);

const liveResult = {
	id: 'LIVE-20260824-100000',
	url: 'http://nineoneclinic.com/',
	canonicalUrl: 'http://nineoneclinic.com/',
	siteName: '나인원의원',
	domain: 'nineoneclinic.com',
	industry: 'medical',
	targetFocus: '대구 동구 / 울트라클리어엘리트',
	scannedAt: '2026-08-24 10:00',
	scores: {
		overall: fromLive.overall,
		schema: fromLive.schema,
		knowledgeGraph: fromLive.knowledgeGraph,
		geo: fromLive.geo,
	},
	issues: [],
	jsonLd: {},
	jsonLdPretty: '{}',
	headInjectSnippet: '',
	summary: 'live',
	detected: { types: ['MedicalClinic'], blockCount: 1, hasMedicalBusiness: true, hasPhysician: false, hasOrganization: true, sameAs: [] },
	scoreBreakdown: fromLive.scoreBreakdown,
} as LiveDiagnosticResult;

const liveWrite = liveResultToDiagnosticInput(liveResult, 'admin@redue.ai');
assert('live persist totalScore === live overall', liveWrite.totalScore === fromLive.overall);
assert('live persist geoScore === live geo', liveWrite.geoScore === fromLive.geo);
assert('live persist schemaScore === live schema', liveWrite.schemaScore === fromLive.schema);

const staleList: DiagnosticRecord[] = [
	{
		id: 'diag-nineone',
		siteName: '나인원의원',
		domain: 'nineoneclinic.com',
		category: 'Medical',
		totalScore: 75,
		geoScore: 68,
		schemaScore: 80,
		status: 'warning',
		issues: ['지식그래프 미연동'],
		requestedBy: 'dr.bae@nineoneclinic.com',
		createdAt: '2026-08-01 09:00',
		reportShareUrl: '/audit/result?id=diag-nineone',
	},
];

const rerunRow = toDiagnosticRecord({
	...history,
	id: 'diag-nineone',
	createdAt: '2026-08-24 10:00',
	totalScore: historyWithPsi.totalScore,
	geoScore: historyWithPsi.geoScore,
	schemaScore: historyWithPsi.schemaScore,
	status: scoreToStatus(historyWithPsi.totalScore),
});
const patched = applyDiagnosticRerunToList(staleList, rerunRow);
assert('rerun list no longer shows 75', patched[0]?.totalScore !== 75);
assert('rerun list shows the measured overall', patched[0]?.totalScore === historyWithPsi.totalScore, patched[0]?.totalScore);
assert('rerun list geo/schema match the drawer', patched[0]?.geoScore === rerunRow.geoScore && patched[0]?.schemaScore === rerunRow.schemaScore);
assert('rerun createdAt is refreshed', patched[0]?.createdAt === '2026-08-24 10:00');
assert('list and drawer scores are identical', patched[0]?.totalScore === rerunRow.totalScore);

assert('firestore id is not a rerun URL', !isDiagnosticRerunTarget('diag-nineone'));
assert('bare host is a rerun URL', isDiagnosticRerunTarget('nineoneclinic.com'));
assert('http URL is a rerun URL', isDiagnosticRerunTarget('http://nineoneclinic.com/'));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall assertions passed');
