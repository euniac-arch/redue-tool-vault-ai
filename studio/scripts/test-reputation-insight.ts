/**
 * Verifies dynamic GEO diagnosis copy never claims "schema is solid"
 * while on-page defects are still open.
 * Run: npx tsx scripts/test-reputation-insight.ts
 */
import {
	getReputationInsight,
	resolveReputationInsight,
} from '../lib/audit/reputation-insight';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const eightDefectsLowRep = resolveReputationInsight(8, 42, 'ko');
assert('8 defects + low reputation → bothWeak', eightDefectsLowRep.kind === 'bothWeak');
assert(
	'8 defects never says schema is excellent',
	!eightDefectsLowRep.message.includes('우수하나') && !eightDefectsLowRep.message.includes('안정적이나'),
	eightDefectsLowRep.message,
);
assert(
	'bothWeak copy includes defect + score counts',
	eightDefectsLowRep.message.includes('8건') && eightDefectsLowRep.message.includes('42점'),
	eightDefectsLowRep.message,
);

const eightDefectsHighRep = resolveReputationInsight(8, 78, 'ko');
assert('8 defects + high reputation → schemaWeakReputationGood', eightDefectsHighRep.kind === 'schemaWeakReputationGood');
assert(
	'schema-weak copy names the defect count',
	eightDefectsHighRep.message.includes('8건'),
	eightDefectsHighRep.message,
);

const zeroDefectsLowRep = resolveReputationInsight(0, 55, 'ko');
assert('0 defects + low reputation → schemaGoodReputationWeak', zeroDefectsLowRep.kind === 'schemaGoodReputationWeak');
assert(
	'schema-good / reputation-weak copy',
	zeroDefectsLowRep.message.includes('안정적이나'),
	zeroDefectsLowRep.message,
);

const bothGood = resolveReputationInsight(0, 82, 'ko');
assert('0 defects + high reputation → bothGood', bothGood.kind === 'bothGood');
assert('bothGood copy mentions optimization baseline', bothGood.message.includes('최적화 기준'));
assert(
	'two-line split: status is diagnosis, action is the call-to-action',
	eightDefectsLowRep.status.includes('미흡하여') && eightDefectsLowRep.action.includes('시급합니다'),
	`${eightDefectsLowRep.status} | ${eightDefectsLowRep.action}`,
);
assert(
	'joined message keeps a single readable sentence',
	eightDefectsLowRep.message === `${eightDefectsLowRep.status} ${eightDefectsLowRep.action}`,
	eightDefectsLowRep.message,
);
assert(
	'schema-weak action names top-citation loss',
	eightDefectsHighRep.action.includes('AI 상단 인용 손실'),
	eightDefectsHighRep.action,
);

const enBothWeak = getReputationInsight(8, 42, 'en');
assert('EN bothWeak includes counts', enBothWeak.includes('8') && enBothWeak.includes('42'), enBothWeak);
assert('string helper matches object message', getReputationInsight(8, 78, 'ko') === eightDefectsHighRep.message);

const httpCritical = resolveReputationInsight(3, 94, 'ko', { isHttps: false });
assert('HTTP insight kind is httpsCritical', httpCritical.kind === 'httpsCritical');
assert(
	'HTTP insight replaces the “외부 평판은 우수하나” sentence',
	httpCritical.message.includes('[치명적]') &&
		httpCritical.message.includes('HTTPS') &&
		httpCritical.message.includes('3건') &&
		!httpCritical.message.includes('우수하나'),
	httpCritical.message,
);
assert(
	'HTTPS insight keeps the reputation-good sentence',
	getReputationInsight(3, 94, 'ko', { isHttps: true }).includes('우수하나'),
);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall reputation-insight assertions passed');
