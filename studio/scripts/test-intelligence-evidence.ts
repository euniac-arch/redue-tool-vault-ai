/**
 * Evidence mock + War Room alignment + adapter port.
 * Run: npx tsx scripts/test-intelligence-evidence.ts
 */
import { createAsiEngine } from '../lib/ai-search-intelligence/adapters/create-engine';
import { buildMockEvidenceSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-evidence';
import { buildMockWarRoomSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-war-room';
import {
	ASI_CITATION_KINDS,
	ASI_MONITOR_RANGES,
} from '../lib/ai-search-intelligence/types';

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
const evidence = buildMockEvidenceSnapshot({ url });
const war = buildMockWarRoomSnapshot({ url });

assert('builds evidence', Boolean(evidence));
assert('nine citation kinds', evidence?.citations.length === ASI_CITATION_KINDS.length);
assert(
	'one of each kind',
	ASI_CITATION_KINDS.every((kind) => evidence?.citations.some((item) => item.kind === kind)),
);
assert(
	'citation fields',
	Boolean(
		evidence?.citations.every(
			(item) =>
				item.source &&
				item.url &&
				item.kind &&
				typeof item.relevance === 'number' &&
				typeof item.authority === 'number' &&
				item.relation &&
				item.ownership,
		),
	),
);
assert('url-only generation is NO_DATA', evidence?.queryGeneration?.status === 'NO_DATA');
assert(
	'url-only does not invent fallback context',
	Boolean(
		evidence?.questions.every((item) => !/해당 업종|현지|핵심 서비스/.test(item.query)) &&
			evidence.questionInputs.industry === '' &&
			evidence.questionInputs.target === '',
	),
);
assert('url-only brand queries stay honest', (evidence?.questions.length ?? 0) >= 1);
assert('visibility matches war room', evidence?.monitorLatest.visibilityScore === war?.kpis.visibility);
assert('recommendation rate matches war room', evidence?.monitorLatest.recommendationRate === war?.kpis.recommendationRate);
assert('sov matches war room', evidence?.monitorLatest.shareOfVoice === war?.kpis.shareOfVoice);
assert('citation count is nine', evidence?.monitorLatest.citationCount === 9);
assert('mock citation report exists', evidence?.citationReport.computedFrom === 'mock' && evidence.citationReport.available);
assert('empty query probe on generate', evidence?.queryProbe.current === null && evidence.queryProbe.compare.length === 0);
assert(
	'monitor ranges',
	ASI_MONITOR_RANGES.every((range) => (evidence?.monitor[range].length ?? 0) >= 4),
);
assert(
	'monitor points have five metrics',
	Boolean(
		evidence?.monitor['7d'].every(
			(point) =>
				typeof point.mention === 'number' &&
				typeof point.recommendationRate === 'number' &&
				typeof point.shareOfVoice === 'number' &&
				typeof point.citationCount === 'number' &&
				typeof point.visibilityScore === 'number',
		),
	),
);

const custom = buildMockEvidenceSnapshot({
	url,
	questions: { industry: '치과', location: '부산', service: '임플란트', target: '시니어' },
});
assert('custom generation is QUERY_GENERATED', custom?.queryGeneration?.status === 'QUERY_GENERATED');
assert('custom questions include inputs', Boolean(custom?.questions.some((item) => item.query.includes('부산') && item.query.includes('임플란트'))));
assert('custom generates at least 10 queries', (custom?.questions.length ?? 0) >= 10);
assert(
	'custom covers multiple intents',
	new Set(custom?.questions.map((item) => item.intent)).size >= 4,
);
assert('rejects bad url', buildMockEvidenceSnapshot({ url: 'nope' }) === null);

const again = buildMockEvidenceSnapshot({ url: 'https://www.sunshineclinic.kr' });
assert('deterministic visibility', evidence?.monitorLatest.visibilityScore === again?.monitorLatest.visibilityScore);

void createAsiEngine('mock')
	.loadEvidence({ url })
	.then((viaAdapter) => {
		assert('adapter returns same sov', viaAdapter?.monitorLatest.shareOfVoice === evidence?.monitorLatest.shareOfVoice);
		assert('adapter returns same visibility', viaAdapter?.monitorLatest.visibilityScore === evidence?.monitorLatest.visibilityScore);
		if (failed) {
			console.error(`\n${failed} failed`);
			process.exit(1);
		}
		console.log('\nall passed');
	});
