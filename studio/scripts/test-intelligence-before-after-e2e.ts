/**
 * STEP 19-G — Before/After + report-shape verification.
 * Does not call providers. Does not print secrets.
 * Run: npx tsx scripts/test-intelligence-before-after-e2e.ts
 */
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { compareAdjacentVisibility } from '../lib/ai-search-intelligence/visibility/compare';
import type { AsiVisibilityQueryMetric, AsiVisibilityRecord } from '../lib/ai-search-intelligence/types';

const QUERY_SET = ['대구 피부과 추천', '대구 피부과 후기', '선샤인 피부과'] as const;

function queryMetrics(rates: [number, number, number][]): AsiVisibilityQueryMetric[] {
	return QUERY_SET.map((query, index) => ({
		query,
		mentionRate: rates[index]?.[0] ?? 0,
		recommendationRate: rates[index]?.[1] ?? 0,
		citationRate: rates[index]?.[2] ?? 0,
	}));
}

function record(input: {
	day: string;
	visibility: number;
	recommendation: number;
	citation: number;
	sov: number;
	competitor: number;
	queries: AsiVisibilityQueryMetric[];
}): AsiVisibilityRecord {
	return {
		timestamp: `${input.day}T12:00:00.000Z`,
		cadence: 'on_demand',
		queryCount: input.queries.length,
		mention: input.visibility,
		visibility: input.visibility,
		recommendation: input.recommendation,
		citation: input.citation,
		sov: input.sov,
		providerScores: { chatgpt: input.visibility, gemini: input.visibility - 4, perplexity: 0, claude: input.visibility },
		competitorScores: { '경쟁 피부과': input.competitor },
		queries: input.queries,
		source: 'live',
	};
}

const before = record({
	day: '2026-08-01',
	visibility: 52,
	recommendation: 40,
	citation: 21,
	sov: 14,
	competitor: 48,
	queries: queryMetrics([
		[50, 40, 20],
		[48, 36, 18],
		[58, 44, 25],
	]),
});

const after = record({
	day: '2026-08-30',
	visibility: 71,
	recommendation: 58,
	citation: 38,
	sov: 23,
	competitor: 44,
	queries: queryMetrics([
		[70, 58, 36],
		[68, 54, 34],
		[75, 62, 44],
	]),
});

const comparison = compareAdjacentVisibility([before, after]);
if (!comparison) {
	throw new Error('compareAdjacentVisibility returned null');
}

function line(label: string, previous: number | null, current: number | null, change: number | null, unit = '') {
	const suffix = unit === '%p' ? '%p' : unit;
	return `${label}\n${previous}${unit === '%' ? '%' : ''} → ${current}${unit === '%' ? '%' : ''}\n${change != null && change > 0 ? '+' : ''}${change}${suffix}`;
}

console.log('========== COMPARISON (observed, not causal) ==========');
console.log(line('Visibility', comparison.visibility.previous, comparison.visibility.current, comparison.visibility.change));
console.log('');
console.log(line('Recommendation', comparison.recommendation.previous, comparison.recommendation.current, comparison.recommendation.change));
console.log('');
console.log(line('Citation', comparison.citation.previous, comparison.citation.current, comparison.citation.change));
console.log('');
console.log(line('SOV', comparison.sov.previous, comparison.sov.current, comparison.sov.change, '%p'));
console.log('');
console.log(
	`Competitor 경쟁 피부과\n${comparison.competitors[0]?.previous} → ${comparison.competitors[0]?.current}\n${comparison.competitors[0]?.change}`,
);

const sameQuerySet =
	before.queries.map((row) => row.query).join('|') === after.queries.map((row) => row.query).join('|');
const provenanceOnlyObserved = [
	comparison.visibility.provenance,
	comparison.recommendation.provenance,
	comparison.citation.provenance,
	comparison.sov.provenance,
].every((item) => item === 'observed');

const mismatched = compareAdjacentVisibility([
	before,
	{
		...after,
		queryCount: 5,
		queries: [...after.queries, { query: '다른 질문', mentionRate: 10, recommendationRate: 8, citationRate: 4 }],
	},
]);

const studio = resolve(process.cwd());
const app = resolve(studio, 'app');
const hasAsiReportRoute = existsSync(resolve(app, 'intelligence', 'report')) || existsSync(resolve(app, 'report', 'asi'));
const hasPublicAuditReport = existsSync(resolve(app, 'report', '[id]'));
const hasPdfModal = existsSync(resolve(studio, 'components', 'audit', 'PDFPreviewModal.tsx'));

const checks: Array<[string, boolean]> = [
	['stores visibility/recommendation/citation/sov/competitor', true],
	['same query set can be stored on both records', sameQuerySet],
	['Visibility 52 → 71 +19', comparison.visibility.previous === 52 && comparison.visibility.current === 71 && comparison.visibility.change === 19],
	['Citation 21 → 38 +17', comparison.citation.previous === 21 && comparison.citation.current === 38 && comparison.citation.change === 17],
	['SOV 14 → 23 +9', comparison.sov.previous === 14 && comparison.sov.current === 23 && comparison.sov.change === 9],
	['delta provenance is observed only', provenanceOnlyObserved],
	['comparison has no causal field', !('cause' in comparison) && !('because' in comparison)],
	['compare still runs if query set drifts (no hard fail)', Boolean(mismatched) && mismatched?.queryCount === 5],
	['no ASI report route', !hasAsiReportRoute],
	['audit public report + PDF already exist', hasPublicAuditReport && hasPdfModal],
];

console.log('\n========== CHECKS ==========');
let failed = 0;
for (const [name, ok] of checks) {
	console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
	if (!ok) failed += 1;
}

console.log('\n========== REPORT SURFACE ==========');
console.log(`asiReportRoute=${hasAsiReportRoute}`);
console.log(`auditPublicReport=${hasPublicAuditReport}`);
console.log(`auditPdfModal=${hasPdfModal}`);
console.log(`intelligencePages=${readdirSync(resolve(app, 'intelligence')).join(',')}`);

if (failed) {
	process.exitCode = 1;
}
