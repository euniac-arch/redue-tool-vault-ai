/**
 * Recommendation mock + War Room alignment + adapter port.
 * Run: npx tsx scripts/test-intelligence-recommendation.ts
 */
import { createAsiEngine } from '../lib/ai-search-intelligence/adapters/create-engine';
import { buildMockRecommendationSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-recommendation';
import { buildMockWarRoomSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-war-room';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const url = 'https://sunshineclinic.kr';
const rec = buildMockRecommendationSnapshot({ url });
const war = buildMockWarRoomSnapshot({ url });

assert('builds recommendation', Boolean(rec));
assert('four engine results', rec?.testResults.length === 4);
assert('sov matches war room', rec?.sov.overall === war?.kpis.shareOfVoice);
assert('potential matches recommendation rate', rec?.simulator.potential === war?.kpis.recommendationRate);
assert(
	'mock competitors stay empty on both boards',
	(rec?.competitors.length ?? 1) === 0 && (war?.competitors.length ?? 1) === 0,
);
assert('mock recommendation state is NO_DATA', rec?.observationState === 'NO_DATA');
assert('five penalties', rec?.simulator.penalties.length === 5);
const penaltySum = rec?.simulator.penalties.reduce((sum, item) => sum + item.points, 0) ?? 0;
assert('penalties explain remainder', penaltySum === 100 - (rec?.simulator.potential ?? 0), String(penaltySum));
assert('has default query', Boolean(rec?.defaultQuery.includes('추천')));
assert(
	'query changes test ranks',
	JSON.stringify(buildMockRecommendationSnapshot({ url, query: '다른 질문' })?.testResults) !==
		JSON.stringify(rec?.testResults),
);
assert('rejects bad url', buildMockRecommendationSnapshot({ url: 'nope' }) === null);

void createAsiEngine('mock')
	.loadRecommendation({ url })
	.then((again) => {
		assert('adapter returns same sov', again?.sov.overall === rec?.sov.overall);
		if (failed) {
			console.error(`\n${failed} failed`);
			process.exit(1);
		}
		console.log('\nall passed');
	});
