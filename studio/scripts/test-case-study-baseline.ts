/**
 * Case-study Before baseline: admin custom + pre-optimization fallback.
 * Run: npx tsx scripts/test-case-study-baseline.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	buildPreOptimizationFallback,
	needsPreOptimizationFallback,
	parseCustomBaseline,
	resolveCaseStudyBaseline,
} from '../lib/case-studies/custom-baseline';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`fail ${label}${detail != null ? ` — ${String(detail)}` : ''}`);
}

const nineoneAfter = { overall: 91, seo: 100, performance: 71, schema: 100, geo: 100 };

assert(
	'90→91 with schema 100 needs fallback',
	needsPreOptimizationFallback({
		beforeOverall: 90,
		afterOverall: 91,
		beforeSchema: 100,
		afterSchema: 100,
	}),
);

assert(
	'58→91 does not need fallback',
	!needsPreOptimizationFallback({
		beforeOverall: 58,
		afterOverall: 91,
		beforeSchema: 0,
		afterSchema: 100,
	}),
);

const synthetic = buildPreOptimizationFallback(nineoneAfter);
assert('synthetic overall is 58', synthetic.overall === 58, synthetic.overall);
assert('synthetic seo is 68', synthetic.seo === 68, synthetic.seo);
assert('synthetic schema is 0', synthetic.schema === 0);
assert('synthetic geo is 58', synthetic.geo === 58, synthetic.geo);
assert('synthetic cwv stays 71', synthetic.performance === 71);

const custom = parseCustomBaseline({ overall: 58, seo: 68, schema: 0, geo: 45 });
assert('parses admin custom baseline', custom?.overall === 58 && custom.seo === 68 && custom.schema === 0);

const resolvedCustom = resolveCaseStudyBaseline({
	customBaseline: { overall: 41, seo: 48, schema: 0, geo: 36 },
	beforeOverall: 90,
	afterOverall: 91,
	beforeAxes: { seo: 100, performance: 66, schema: 100, geo: 100 },
	afterAxes: { seo: 100, performance: 71, schema: 100, geo: 100 },
});
assert('custom baseline wins over synthetic', resolvedCustom.source === 'custom' && resolvedCustom.baseline?.overall === 41);

const resolvedSynthetic = resolveCaseStudyBaseline({
	customBaseline: null,
	beforeOverall: 90,
	afterOverall: 91,
	beforeAxes: { seo: 100, performance: 66, schema: 100, geo: 100 },
	afterAxes: { seo: 100, performance: 71, schema: 100, geo: 100 },
});
assert('falls back to synthetic for 90→91', resolvedSynthetic.source === 'synthetic' && resolvedSynthetic.baseline?.overall === 58);

const root = process.cwd();
const card = readFileSync(join(root, 'components/portfolio/CaseStudyCard.tsx'), 'utf8');
const page = readFileSync(join(root, 'app/api/admin/projects/[id]/case-study/route.ts'), 'utf8');
assert('card floats Verified badge on the top edge', card.includes('absolute -top-3.5 left-6') && card.includes('Verified Real Case'));
assert('card pulse dot is present', card.includes('animate-pulse rounded-full bg-emerald-400'));
assert('card separates tech stack from outcome pills', card.includes('mb-2') && card.includes('SEO 최적화 완료'));
assert('admin route accepts customBaseline', page.includes('customBaseline'));

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall case-study baseline assertions passed');
