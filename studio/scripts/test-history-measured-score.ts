/**
 * Result-page 종합점수 ↔ 최근진단내역 종합점수.
 * Track 3 (PSI, ≤20s) must land on the same `blendMeasuredScore` the hero uses.
 * Run: npx tsx scripts/test-history-measured-score.ts
 */
import { buildDiagnosisScoreSnapshot } from '../lib/audit/diagnosis-scores';
import {
	applyLocalMeasuredScorePatches,
	applyMeasuredScorePatchToEntries,
	reportToHistoryEntry,
	resolveHistoryMeasuredHeadline,
	type AuditHistoryEntry,
} from '../lib/audit-history-storage';
import { resolveReportTrack3Score, type PageSpeedSnapshot } from '../lib/audit/pagespeed';
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

function psiSnapshot(strategy: 'mobile' | 'desktop', performance: number): PageSpeedSnapshot {
	return {
		url: 'http://nineoneclinic.com/',
		strategy,
		fetchedAt: '2026-08-24T00:00:18.000Z',
		categories: [{ id: 'performance', score: performance, tier: performance >= 90 ? 'good' : 'needs-improvement' }],
		vitals: [],
		renderBlocking: [],
		images: [],
		fonts: [],
		cacheResources: [],
		cacheTotalWastedBytes: null,
		lcpElement: null,
	} as PageSpeedSnapshot;
}

const baseReport = {
	url: 'https://nineoneclinic.com/',
	lang: 'ko',
	fetchedAt: '2026-08-24T00:00:00.000Z',
	httpStatus: 200,
	responseTimeMs: 120,
	pageSizeBytes: 80_000,
	score: 75,
	maxScore: 122,
	status: 'FAIR',
	statusLabel: '보통',
	hasSsl: true,
	schemaCoverage: 70,
	geoCitationScore: 48,
	siteMeta: {
		domain: 'nineoneclinic.com',
		brandName: '나인원의원',
		category: '피부과',
		industryType: 'MEDICAL',
		ogTitle: '나인원의원',
		ogImage: 'https://nineoneclinic.com/og.jpg',
		title: '나인원의원 | 대구 동구 피부과',
		metaDescription: '대구 동구 울트라클리어엘리트',
		targetUrl: 'https://nineoneclinic.com/',
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
		schemaTypes: ['MedicalClinic'],
		bodyTextLength: 800,
		renderBlockingScripts: 0,
		documentTitle: '나인원의원 | 대구 동구 피부과',
		pageTitle: '나인원의원',
		metaDescription: '대구 동구 울트라클리어엘리트',
		ogTitle: '나인원의원',
	},
	categories: [],
	findings: [],
	checklist: [check('canonical', 'pass'), check('title', 'pass'), check('https', 'pass')],
} as AuditReport;

const scanSnapshot = buildDiagnosisScoreSnapshot(baseReport, null, 'ko');
const scanEntry = reportToHistoryEntry('audit-1', baseReport, baseReport.fetchedAt);

assert(
	'scan-time history measuredScore === result hero without Track 3',
	scanEntry.measuredScore === scanSnapshot.measuredScore,
	`${scanEntry.measuredScore} vs ${scanSnapshot.measuredScore}`,
);
assert('scan-time CWV is null until PSI lands', scanEntry.coreWebVitalsScore == null);
assert(
	'history badge uses scan-time measuredScore before PSI',
	resolveHistoryMeasuredHeadline(scanEntry).score === scanSnapshot.measuredScore,
);

const desktop = psiSnapshot('desktop', 82);
const mobile = psiSnapshot('mobile', 64);
const track3 = resolveReportTrack3Score({ pageSpeedDesktop: desktop, pageSpeedMobile: mobile });
assert('Track 3 is 50:50 mobile/desktop', track3 === 73, track3);

const withPsi: AuditReport = { ...baseReport, pageSpeedDesktop: desktop, pageSpeedMobile: mobile };
const heroAfterPsi = buildDiagnosisScoreSnapshot(withPsi, null, 'ko', {
	coreWebVitalsScore100: track3,
});
const historyAfterBackfill = reportToHistoryEntry('audit-1', withPsi, baseReport.fetchedAt);

assert(
	'backfilled history measuredScore === result hero with Track 3',
	historyAfterBackfill.measuredScore === heroAfterPsi.measuredScore,
	`${historyAfterBackfill.measuredScore} vs ${heroAfterPsi.measuredScore}`,
);
assert(
	'history badge after backfill === hero',
	resolveHistoryMeasuredHeadline(historyAfterBackfill).score === heroAfterPsi.measuredScore,
);
assert(
	'Track 3 changes the composite (not the scan-time fallback)',
	heroAfterPsi.measuredScore !== scanSnapshot.measuredScore,
	`${heroAfterPsi.measuredScore} vs ${scanSnapshot.measuredScore}`,
);

const apiStale = reportToHistoryEntry('audit-1', baseReport, baseReport.fetchedAt);
const localPatched: AuditHistoryEntry = {
	...scanEntry,
	measuredScore: heroAfterPsi.measuredScore,
	measuredGrade: heroAfterPsi.grade,
	coreWebVitalsScore: track3,
	report: withPsi,
};
const merged = applyLocalMeasuredScorePatches([apiStale], [localPatched]);
assert(
	'signed-in API row without PSI inherits the result-page Track 3 composite',
	resolveHistoryMeasuredHeadline(merged[0]!).score === heroAfterPsi.measuredScore,
	resolveHistoryMeasuredHeadline(merged[0]!).score,
);

const patchedInPlace = applyMeasuredScorePatchToEntries([apiStale], {
	id: 'audit-1',
	measuredScore: heroAfterPsi.measuredScore,
	measuredGrade: heroAfterPsi.grade,
	coreWebVitalsScore: track3,
	pageSpeedDesktop: desktop,
	pageSpeedMobile: mobile,
});
assert(
	'live ≤20s score patch matches the result hero exactly',
	resolveHistoryMeasuredHeadline(patchedInPlace[0]!).score === heroAfterPsi.measuredScore,
);
assert(
	'score patch does not touch a different history id',
	applyMeasuredScorePatchToEntries([apiStale], {
		id: 'other',
		measuredScore: 1,
		measuredGrade: heroAfterPsi.grade,
		coreWebVitalsScore: 1,
	})[0]?.measuredScore === apiStale.measuredScore,
);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall assertions passed');
