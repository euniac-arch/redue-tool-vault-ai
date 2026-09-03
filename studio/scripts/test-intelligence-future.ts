/**
 * Agent Readiness mock + War Room alignment + adapter port.
 * Run: npx tsx scripts/test-intelligence-future.ts
 */
import { createAsiEngine } from '../lib/ai-search-intelligence/adapters/create-engine';
import { buildMockAgentReadinessSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-agent-readiness';
import { buildMockWarRoomSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-war-room';
import { ASI_READINESS_CRITERIA } from '../lib/ai-search-intelligence/types';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const FORBIDDEN = /이용할 수 있|수행할 수 있|예약을 완료|보장이 아닙니다/;

const url = 'https://sunshineclinic.kr';
const ready = buildMockAgentReadinessSnapshot({ url });
const war = buildMockWarRoomSnapshot({ url });

assert('builds readiness', Boolean(ready));
assert('eleven criteria', ready?.items.length === ASI_READINESS_CRITERIA.length);
assert(
	'one of each criterion',
	ASI_READINESS_CRITERIA.every((id) => ready?.items.some((item) => item.id === id)),
);
assert(
	'item fields',
	Boolean(
		ready?.items.every(
			(item) =>
				typeof item.score === 'number' &&
				item.status &&
				item.issue.length > 8 &&
				item.fix.length > 8 &&
				!FORBIDDEN.test(item.issue) &&
				!FORBIDDEN.test(item.fix),
		),
	),
);
assert('overall matches war room', ready?.overall === war?.kpis.agentReadiness);
assert(
	'status counts add up',
	(ready?.statusCounts.ready ?? 0) + (ready?.statusCounts.partial ?? 0) + (ready?.statusCounts.gap ?? 0) === 11,
);
assert('rejects bad url', buildMockAgentReadinessSnapshot({ url: 'nope' }) === null);

const again = buildMockAgentReadinessSnapshot({ url: 'https://www.sunshineclinic.kr' });
assert('deterministic overall', ready?.overall === again?.overall);

void createAsiEngine('mock')
	.loadAgentReadiness({ url })
	.then((viaAdapter) => {
		assert('adapter returns same overall', viaAdapter?.overall === ready?.overall);
		assert('adapter returns 11 items', viaAdapter?.items.length === 11);
		if (failed) {
			console.error(`\n${failed} failed`);
			process.exit(1);
		}
		console.log('\nall passed');
	});
