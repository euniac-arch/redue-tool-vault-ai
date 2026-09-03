/**
 * Guide audit-history picker mapping.
 * Run: npx tsx scripts/test-guide-history-picker.ts
 */
import type { AuditHistoryEntry } from '../lib/audit/history-entry';
import { guideDataFromHistoryEntry, guideDataFromHistoryRow, guideDataFromReport } from '../lib/guide/from-audit';
import {
	filterGuideHistoryRows,
	formatGuideHistoryTime,
	mergeLatestIntoHistory,
	toGuideHistoryRow,
} from '../lib/guide/history-picker';
import type { AuditReport } from '../lib/site-auditor';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}`, detail ?? '');
}

const report = {
	url: 'https://nineoneclinic.com',
	lang: 'ko',
	fetchedAt: '2026-08-31T06:30:00.000Z',
	httpStatus: 200,
	responseTimeMs: 80,
	pageSizeBytes: 1200,
	score: 125,
	maxScore: 125,
	status: 'good',
	statusLabel: '양호',
	categories: [],
	findings: [],
	siteMeta: {
		brandName: '나인원의원',
		location: '대구 동구',
		category: '피부과',
		coreSpecialties: ['울트라클리어', '덴서티'],
	},
} as unknown as AuditReport;

const mapped = guideDataFromReport(report);
assert('maps brand', Boolean(mapped?.brandName.includes('나인원')), mapped?.brandName);
assert('maps keywords', (mapped?.keywords.length || 0) >= 3, mapped?.keywords);
assert('maps 6 engines', mapped?.aiEngineDiagnoses.length === 6);
assert('null report → null', guideDataFromReport(null) === null);
assert('missing url → null', guideDataFromReport({ ...(report as AuditReport), url: '' }) === null);
assert('corrupt entry → null', guideDataFromHistoryEntry({ report: null }) === null);

const entry = {
	id: 'h1',
	url: 'https://nineoneclinic.com',
	score: 125,
	maxScore: 125,
	status: 'good',
	statusLabel: '양호',
	geoScore: 93,
	categories: [],
	fetchedAt: '2026-08-31T06:30:00.000Z',
	createdAt: '2026-08-31T06:30:00.000Z',
	report,
} as AuditHistoryEntry;

const row = toGuideHistoryRow(entry);
assert('row brand', row.brandName.includes('나인원') || row.brandName.includes('nineone'), row.brandName);
assert('row seo 125', row.seoScore === 125);
assert('row trust 93', row.aiTrustScore === 93);
assert('row has report', row.hasReport);
assert('time format', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(formatGuideHistoryTime(entry.createdAt)));

const other = { ...entry, id: 'h2', url: 'https://other.example', report: { ...report, url: 'https://other.example' } };
const merged = mergeLatestIntoHistory([other], {
	auditId: 'latest',
	report,
	defectCount: 0,
	score: 125,
	maxScore: 125,
	savedAt: '2026-08-31T07:00:00.000Z',
});
assert('latest prepended when new site', merged[0]?.url.includes('nineoneclinic'), merged[0]?.url);
assert(
	'same site not duplicated',
	mergeLatestIntoHistory([entry], {
		auditId: 'x',
		report,
		defectCount: 0,
		score: 125,
		maxScore: 125,
		savedAt: '2026-08-31T07:00:00.000Z',
	}).length === 1,
);

const filtered = filterGuideHistoryRows([row], '나인원');
assert('filter brand hit', filtered.length === 1);
assert('filter miss', filterGuideHistoryRows([row], '없는상호').length === 0);

const broken = toGuideHistoryRow({
	...entry,
	id: 'broken',
	report: { url: 'https://broken.example', siteMeta: { brandName: '깨진이력' } } as AuditReport,
});
const recovered = guideDataFromHistoryRow(broken);
assert('broken report still yields guide', Boolean(recovered.brandName && recovered.aiEngineDiagnoses.length === 6), recovered.brandName);
assert('broken report has arrays', Array.isArray(recovered.coreFeatures) && Array.isArray(recovered.keywords));
assert('no-report row still renders', guideDataFromHistoryRow({ ...row, hasReport: false, entry: { ...entry, report: undefined as unknown as AuditReport } }).brandName.length > 0);

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
