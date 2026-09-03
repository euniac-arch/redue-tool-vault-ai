/**
 * Intelligence Core models — OBSERVED vs DERIVED + mock/live same shape.
 * Run: npx tsx scripts/test-intelligence-core-models.ts
 */
import {
	INTELLIGENCE_CORE_PROVENANCE,
	alertFromDelta,
	buildIntelligenceCore,
	emptyIntelligenceCore,
	toAIObservation,
	toIntelligenceQuery,
} from '../lib/ai-search-intelligence/core';
import type { AIResponse } from '../lib/ai-search-intelligence/types';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const concepts = ['query', 'observation', 'evidence', 'competitor', 'opportunity', 'action', 'visibility', 'alert'] as const;
assert(
	'eight core concepts catalogued',
	concepts.every((key) => Boolean(INTELLIGENCE_CORE_PROVENANCE[key])),
);

const observedMustStay = [
	INTELLIGENCE_CORE_PROVENANCE.observation.brandMention,
	INTELLIGENCE_CORE_PROVENANCE.observation.recommendation,
	INTELLIGENCE_CORE_PROVENANCE.observation.citations,
	INTELLIGENCE_CORE_PROVENANCE.observation.competitors,
	INTELLIGENCE_CORE_PROVENANCE.evidence.url,
	INTELLIGENCE_CORE_PROVENANCE.competitor.mention,
];
assert(
	'AI-returned facts stay OBSERVED',
	observedMustStay.every((item) => item === 'observed'),
);

const derivedMustStay = [
	INTELLIGENCE_CORE_PROVENANCE.visibility.visibilityScore,
	INTELLIGENCE_CORE_PROVENANCE.visibility.shareOfVoice,
	INTELLIGENCE_CORE_PROVENANCE.opportunity.estimatedImpact,
	INTELLIGENCE_CORE_PROVENANCE.competitor.rank,
	INTELLIGENCE_CORE_PROVENANCE.query.priority,
	INTELLIGENCE_CORE_PROVENANCE.alert.severity,
];
assert(
	'REDUE calculations stay DERIVED',
	derivedMustStay.every((item) => item === 'derived'),
);

const empty = emptyIntelligenceCore();
assert(
	'mock/live empty bundle has all keys',
	['queries', 'observations', 'evidence', 'competitors', 'opportunities', 'actions', 'visibility', 'alerts'].every(
		(key) => key in empty,
	),
);

const live: AIResponse = {
	provider: 'gemini',
	query: '부산 치과 추천',
	answer: '한빛치과를 추천합니다. https://hanbit.example',
	mentions: ['한빛치과', '서울탑클리닉'],
	recommendations: ['한빛치과'],
	citations: [{ source: 'official', url: 'https://hanbit.example', type: 'official', relevance: 0, authority: 0 }],
	confidence: 0.72,
	timestamp: '2026-03-01T00:00:00.000Z',
	source: 'live',
};

const mock: AIResponse = { ...live, source: 'mock', provider: 'chatgpt' };
const liveObs = toAIObservation(live, { brand: '한빛치과' });
const mockObs = toAIObservation(mock, { brand: '한빛치과' });
assert('live/mock observation keys match', Object.keys(liveObs).join() === Object.keys(mockObs).join());
assert('mention is observed boolean', liveObs.brandMention.provenance === 'observed' && liveObs.brandMention.value === true);
assert('citations are observed urls', liveObs.citations.value.includes('https://hanbit.example'));

const query = toIntelligenceQuery({ query: '부산 치과 추천', intent: 'recommend' }, { location: '부산', service: '치과' });
const bundle = buildIntelligenceCore({
	brand: '한빛치과',
	queries: [query],
	responses: [live],
});
assert('bundle query maps from AIQuery fields', bundle.queries[0]?.text === '부산 치과 추천');
assert('bundle competitor from observed mention', bundle.competitors.some((row) => row.competitor.value === '서울탑클리닉'));
assert('visibility score not observed', bundle.visibility?.visibilityScore.provenance === 'derived');

const alert = alertFromDelta({
	type: 'visibility_drop',
	message: 'visibility dropped',
	previousValue: 40,
	currentValue: 18,
});
assert(
	'alert values are observed measurements',
	alert.severity === 'critical' &&
		alert.previousValue.provenance === 'observed' &&
		alert.currentValue.provenance === 'observed',
);
assert('alert type stays derived', INTELLIGENCE_CORE_PROVENANCE.alert.type === 'derived');

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
