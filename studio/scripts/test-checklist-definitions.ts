/**
 * 24-item checklist SSOT: 122-point total, 5 categories, /llms.txt = 6.
 * Run: npx tsx scripts/test-checklist-definitions.ts
 */
import {
	AUDIT_CHECKLIST_DEFINITIONS,
	CHECKLIST_CATEGORY_MAX,
	CHECKLIST_ITEM_COUNT,
	CHECKLIST_TOTAL_MAX,
	checklistWeightForEngineId,
	maxScoreFromChecklist,
	resolveMaxRawScore,
} from '../lib/audit/checklistDefinitions';
import { LLMS_TXT_CHECK_ID, LLMS_TXT_CHECK_WEIGHT } from '../lib/audit/llms-txt-check';
import { CATEGORY_MAX_SCORES, GROUP_MAX_SCORES, ONPAGE_MAX_SCORE } from '../lib/audit/onpage-diagnostic';
import { calculateMaxRawScore, HTTPS_RAW_POINTS } from '../lib/audit/scoreCalculator';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

assert('24 checklist items', CHECKLIST_ITEM_COUNT === 24 && AUDIT_CHECKLIST_DEFINITIONS.length === 24, String(CHECKLIST_ITEM_COUNT));
assert('definition max is a live reduce', CHECKLIST_TOTAL_MAX === maxScoreFromChecklist(AUDIT_CHECKLIST_DEFINITIONS));
assert('current definition total is 122', CHECKLIST_TOTAL_MAX === 122, String(CHECKLIST_TOTAL_MAX));
assert('ONPAGE_MAX_SCORE tracks definition total', ONPAGE_MAX_SCORE === CHECKLIST_TOTAL_MAX);
assert('empty checklist falls back to definition total', resolveMaxRawScore([]) === CHECKLIST_TOTAL_MAX);
assert('calculator max matches definition total', calculateMaxRawScore() === CHECKLIST_TOTAL_MAX);
assert(
	'5 definition categories sum to 122',
	CHECKLIST_CATEGORY_MAX.security_infra +
		CHECKLIST_CATEGORY_MAX.web_perf_access +
		CHECKLIST_CATEGORY_MAX.basic_seo +
		CHECKLIST_CATEGORY_MAX.schema_data +
		CHECKLIST_CATEGORY_MAX.geo_ai_signals ===
		122,
	JSON.stringify(CHECKLIST_CATEGORY_MAX),
);
assert('security_infra is 15', CHECKLIST_CATEGORY_MAX.security_infra === 15);
assert('web_perf_access is 12', CHECKLIST_CATEGORY_MAX.web_perf_access === 12);
assert('basic_seo is 29', CHECKLIST_CATEGORY_MAX.basic_seo === 29);
assert('schema_data is 36', CHECKLIST_CATEGORY_MAX.schema_data === 36);
assert('geo_ai_signals is 30', CHECKLIST_CATEGORY_MAX.geo_ai_signals === 30);

const llms = AUDIT_CHECKLIST_DEFINITIONS.find((item) => item.id === 'llms_txt');
assert('llms.txt maxScore is 6', llms?.maxScore === 6);
assert('llms.txt engine weight is 6', checklistWeightForEngineId(LLMS_TXT_CHECK_ID) === 6);
assert('LLMS_TXT_CHECK_WEIGHT is 6', LLMS_TXT_CHECK_WEIGHT === 6);
assert('HTTPS slot is 10', HTTPS_RAW_POINTS === 10 && checklistWeightForEngineId('https') === 10);
assert('html lang is 2', checklistWeightForEngineId('html-lang') === 2);
assert('heading structure is 4', checklistWeightForEngineId('heading-structure') === 4);

const diagnosticSum =
	CATEGORY_MAX_SCORES.security +
	CATEGORY_MAX_SCORES.performance +
	CATEGORY_MAX_SCORES.seo +
	CATEGORY_MAX_SCORES.schema +
	CATEGORY_MAX_SCORES.geo;
assert('5 diagnostic categories sum to definition total', diagnosticSum === CHECKLIST_TOTAL_MAX, String(diagnosticSum));
assert(
	'5 diagnostic groups sum to definition total',
	GROUP_MAX_SCORES.security +
		GROUP_MAX_SCORES.performance +
		GROUP_MAX_SCORES.seo +
		GROUP_MAX_SCORES.schema +
		GROUP_MAX_SCORES.geo ===
		CHECKLIST_TOTAL_MAX,
);
assert('security max is 15', CATEGORY_MAX_SCORES.security === 15);
assert('performance/a11y max is 12', CATEGORY_MAX_SCORES.performance === 12);
assert('SEO fundamentals max is 29', CATEGORY_MAX_SCORES.seo === 29);
assert('schema max is 36', CATEGORY_MAX_SCORES.schema === 36);
assert('GEO/AI max is 30', CATEGORY_MAX_SCORES.geo === 30);
assert('viewport is not a scoring row', !AUDIT_CHECKLIST_DEFINITIONS.some((item) => item.id.includes('viewport')));
assert('sitemap is not a scoring row', !AUDIT_CHECKLIST_DEFINITIONS.some((item) => item.id.includes('sitemap')));
const extra = [...AUDIT_CHECKLIST_DEFINITIONS, { id: 'extra', maxScore: 4 }];
assert('adding an item raises the live max', maxScoreFromChecklist(extra) === CHECKLIST_TOTAL_MAX + 4);
assert('complete live list with extra uses live sum', resolveMaxRawScore(extra) === CHECKLIST_TOTAL_MAX + 4);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall checklist-definition assertions passed');
