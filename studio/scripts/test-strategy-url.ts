import {
	buildStrategyStudioHref,
	readStrategyStudioParams,
	sameStrategySite,
} from '../lib/strategy/strategy-url';

let failed = 0;
function assert(label: string, ok: boolean, detail = '') {
	if (ok) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`fail  ${label}${detail ? ` — ${detail}` : ''}`);
}

assert(
	'writes auditId and url',
	buildStrategyStudioHref('abc', '대구 피부과', 'https://clinic.example/') ===
		'/strategy?auditId=abc&url=https%3A%2F%2Fclinic.example%2F&keyword=%EB%8C%80%EA%B5%AC+%ED%94%BC%EB%B6%80%EA%B3%BC',
);
assert('empty stays bare /strategy', buildStrategyStudioHref() === '/strategy');
assert('legacy id is still read', readStrategyStudioParams(new URLSearchParams('id=legacy')).auditId === 'legacy');
assert(
	'auditId wins over id',
	readStrategyStudioParams(new URLSearchParams('id=old&auditId=new')).auditId === 'new',
);
assert('same site ignores www and trailing slash', sameStrategySite('https://www.clinic.example/', 'https://clinic.example'));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nstrategy-url assertions passed');
