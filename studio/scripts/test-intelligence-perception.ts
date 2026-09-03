/**
 * Perception mock + War Room score alignment.
 * Run: npx tsx scripts/test-intelligence-perception.ts
 */
import { buildMockPerceptionSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-perception';
import { buildMockWarRoomSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-war-room';
import { buildPerceptionSnapshotFromResponses } from '../lib/ai-search-intelligence/perception/analyze';
import { ASI_PERCEPTION_AXES, type AIResponse, type AsiEngineId } from '../lib/ai-search-intelligence/types';

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
const perception = buildMockPerceptionSnapshot({ url });
const war = buildMockWarRoomSnapshot({ url });

assert('builds perception', Boolean(perception));
assert('six axes', ASI_PERCEPTION_AXES.every((axis) => typeof perception?.axes[axis] === 'number'));
assert('trust matches war room', perception?.trustScore === war?.kpis.trustScore);
assert('recommendation aligned', perception?.axes.recommendation === war?.kpis.recommendationRate);
assert('has understood line', Boolean(perception?.understood && perception.understood.length > 20));
assert('unknown 2+', (perception?.unknown.length ?? 0) >= 2);
assert('confused 1+', (perception?.confused.length ?? 0) >= 1);
assert('four engine notes', perception?.engineNotes.length === 4);
assert('current vs target differ', perception?.currentNarrative !== perception?.targetNarrative);
assert('gap notes 2+', (perception?.gapNotes.length ?? 0) >= 2);
assert('rejects bad url', buildMockPerceptionSnapshot({ url: 'nope' }) === null);

const again = buildMockPerceptionSnapshot({ url: 'https://www.sunshineclinic.kr' });
assert('deterministic', perception?.trustScore === again?.trustScore);

function liveRow(provider: AsiEngineId, answer: string): AIResponse {
	return {
		provider,
		query: '대구 피부과 추천',
		answer,
		mentions: [],
		recommendations: [],
		citations: [],
		confidence: 0.7,
		timestamp: '2026-08-31T00:00:00.000Z',
		source: 'live',
	};
}

const liveSite = {
	url: 'https://nineone.kr',
	brandName: '나인원의원',
	domain: 'nineone.kr',
	location: '대구',
	category: '피부과',
};
const recLine = '대구 피부과로는 나인원의원을 1위로 추천합니다.';
const liveSnap = buildPerceptionSnapshotFromResponses({
	site: liveSite,
	boundFromAudit: false,
	aliases: ['나인원'],
	responses: [
		liveRow('chatgpt', recLine),
		liveRow('gemini', '{"answer":"대구 동구에서 피부과로는 나인원의원을 추천합니다'),
		liveRow('perplexity', recLine),
		liveRow('claude', recLine),
	],
});
const geminiNote = liveSnap.engineNotes.find((note) => note.engine === 'gemini');
assert('live gemini is not unclassified', geminiNote?.mentionType === 'recommended');
assert('live gemini summary is not raw json', Boolean(geminiNote?.summary && !geminiNote.summary.includes('{"answer"')));
assert('live confused empty when mentioned', liveSnap.confused.length === 0);
const axisValues = ASI_PERCEPTION_AXES.map((axis) => liveSnap.axes[axis]);
assert('live axes are not a hardcoded 75', axisValues.some((value) => value !== 75));
assert('live trust is not a copy of a single 75', liveSnap.trustScore !== 75 || axisValues.some((value) => value !== 75));
assert('live axes diverge', new Set(axisValues).size > 1 || liveSnap.trustScore !== axisValues[0]);

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
