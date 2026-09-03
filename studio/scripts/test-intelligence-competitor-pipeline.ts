/**
 * Competitor Discovery → Observed → Confirmed → SOV / Intelligence / Gap.
 * Live answers own the roster. Mock names are never promoted as observed.
 * Run: npx tsx scripts/test-intelligence-competitor-pipeline.ts
 */
import {
	clearAsiCompetitorStore,
	competitorKey,
	overlayLiveCompetitors,
	rebuildAsiCompetitorRegistry,
	resolveSharedCompetitorNames,
	stageAsiCompetitor,
	visibleCompetitorNames,
} from '../lib/ai-search-intelligence/competitors';
import { resolveAsiObservationState } from '../lib/ai-search-intelligence/observation-state';
import { buildCompetitorGapSnapshot } from '../lib/ai-search-intelligence/competitor-gap/analyze';
import { appendAsiCitationStore, clearAsiCitationStore } from '../lib/ai-search-intelligence/citations/store';
import { buildMockRecommendationSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-recommendation';
import { buildMockWarRoomSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-war-room';
import { aggregateAsiWarRoom } from '../lib/ai-search-intelligence/core/aggregate-war-room';
import { appendAsiSovStore, clearAsiSovStore } from '../lib/ai-search-intelligence/sov/store';
import { overlayLiveSov } from '../lib/ai-search-intelligence/sov/overlay';
import type { AIResponse, AsiEngineId, AsiSovObservation } from '../lib/ai-search-intelligence/types';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const domain = 'nineoneclinic.com';
const mockSeed = buildMockRecommendationSnapshot({ url: `https://${domain}` });
const brand = mockSeed?.site.brandName || '나인원의원';
const aliases = [brand, 'nineoneclinic', '나인원의원'];

function liveResponse(partial: Partial<AIResponse> & Pick<AIResponse, 'provider' | 'query'>): AIResponse {
	return {
		answer: '덴서티를 추천합니다.',
		mentions: ['덴서티', brand],
		recommendations: ['덴서티'],
		citations: [],
		confidence: 0.7,
		timestamp: '2026-08-30T00:00:00.000Z',
		source: 'live',
		...partial,
	};
}

function reset() {
	clearAsiCompetitorStore();
	clearAsiCitationStore();
	clearAsiSovStore();
}

assert('one mention is observed', stageAsiCompetitor({ mentionCount: 1, queryCount: 1, providerCount: 1 }) === 'observed');
assert(
	'two queries confirm',
	stageAsiCompetitor({ mentionCount: 2, queryCount: 2, providerCount: 1 }) === 'confirmed',
);
assert('audit-only stays candidate', stageAsiCompetitor({ mentionCount: 0, queryCount: 0, providerCount: 0 }) === 'candidate');
assert('legal suffix folds', competitorKey('메디컬라운지의원') === competitorKey('메디컬라운지'));
assert(
	'NO_DATA before any answers',
	resolveAsiObservationState({ analyzed: false, validResponseCount: 0, competitorCount: 0 }) === 'NO_DATA',
);
assert(
	'INSUFFICIENT_SAMPLE is not no-competitor',
	resolveAsiObservationState({ analyzed: true, validResponseCount: 5, competitorCount: 0 }) === 'INSUFFICIENT_SAMPLE',
);
assert(
	'NO_COMPETITOR_OBSERVED needs 20 valid answers',
	resolveAsiObservationState({ analyzed: true, validResponseCount: 20, competitorCount: 0 }) === 'NO_COMPETITOR_OBSERVED',
);
assert(
	'19 valid answers stay insufficient',
	resolveAsiObservationState({ analyzed: true, validResponseCount: 19, competitorCount: 0 }) === 'INSUFFICIENT_SAMPLE',
);
assert(
	'COMPETITORS_FOUND even with a short sample',
	resolveAsiObservationState({ analyzed: true, validResponseCount: 2, competitorCount: 1 }) === 'COMPETITORS_FOUND',
);

reset();
const mock = mockSeed;
assert('mock snapshot invents no competitor names', (mock?.competitors.length ?? 1) === 0);
assert('mock snapshot is NO_DATA', mock?.observationState === 'NO_DATA');

const unchanged = overlayLiveCompetitors(mock!);
assert('no live clears mock competitors', unchanged.competitors.length === 0);
assert('cleared mock roster is NO_DATA', unchanged.observationState === 'NO_DATA');

appendAsiCitationStore(
	domain,
	[liveResponse({ provider: 'chatgpt', query: '대구 흉터 추천' })],
	{ brand, siteUrl: `https://${domain}`, aliases },
);
appendAsiSovStore(domain, [liveResponse({ provider: 'chatgpt', query: '대구 흉터 추천' })], { brand, aliases });

const liveOverlay = overlayLiveCompetitors(mock!);
assert('live replaces mock names', liveOverlay.competitors.every((row) => row.name !== '메디컬라운지'));
assert('live shows observed 덴서티', liveOverlay.competitors.some((row) => row.name === '덴서티'));
assert('live roster is COMPETITORS_FOUND', liveOverlay.observationState === 'COMPETITORS_FOUND');
const shared = resolveSharedCompetitorNames({
	domain,
	brand,
	aliases,
	responses: [liveResponse({ provider: 'chatgpt', query: '대구 흉터 추천' })],
});
const gapFromShared = buildCompetitorGapSnapshot({
	site: mock!.site,
	responses: [liveResponse({ provider: 'chatgpt', query: '대구 흉터 추천' })],
	source: 'live',
	boundFromAudit: false,
	gaps: [],
	aliases,
	knownCompetitors: shared,
});
assert(
	'intelligence and gap share the same names',
	liveOverlay.competitors.map((row) => row.name).join() ===
		gapFromShared.competitors.map((row) => row.name).join() &&
		visibleCompetitorNames(domain).join() === shared.join() &&
		shared.includes('덴서티'),
);

reset();
appendAsiCitationStore(
	domain,
	[
		{
			...liveResponse({ provider: 'chatgpt', query: '대구 흉터 추천' }),
			mentions: [brand],
			recommendations: [brand],
			answer: `${brand}를 추천합니다.`,
		},
	],
	{ brand, siteUrl: `https://${domain}`, aliases },
);
appendAsiSovStore(
	domain,
	[
		{
			...liveResponse({ provider: 'chatgpt', query: '대구 흉터 추천' }),
			mentions: [brand],
			recommendations: [brand],
			answer: `${brand}를 추천합니다.`,
		},
	],
	{ brand, aliases },
);
const emptyOverlay = overlayLiveCompetitors(mock!);
assert('live brand-only clears mock roster', emptyOverlay.competitors.length === 0);

reset();
rebuildAsiCompetitorRegistry(domain, {
	brand,
	aliases,
	auditNames: ['서울탑클리닉'],
	responses: [liveResponse({ provider: 'gemini', query: '대구 흉터 추천' })],
});
const roster = rebuildAsiCompetitorRegistry(domain, { brand, aliases, auditNames: ['서울탑클리닉'] });
assert(
	'audit name stays candidate until mentioned',
	roster.some((row) => row.name === '서울탑클리닉' && row.stage === 'candidate'),
);
assert(
	'candidate is not visible on intelligence',
	!emptyOverlay.competitors.some((row) => row.name === '서울탑클리닉'),
);

reset();
const war = buildMockWarRoomSnapshot({ url: `https://${domain}` });
assert('mock war room invents no competitor names', (war?.competitors.length ?? 1) === 0);
assert('mock war room is NO_DATA', war?.observationState === 'NO_DATA');

const liveRows: AsiSovObservation[] = (['chatgpt', 'gemini'] as AsiEngineId[]).map((provider) => ({
	query: '대구 흉터 추천',
	category: 'recommend',
	provider,
	brandMentioned: false,
	competitorMentions: ['덴서티'],
	recommended: false,
	rank: null,
	position: null,
	citations: [],
	timestamp: '2026-08-30T00:00:00.000Z',
	source: 'live',
}));
for (const row of liveRows) {
	appendAsiSovStore(
		domain,
		[
			liveResponse({
				provider: row.provider,
				query: row.query,
				mentions: ['덴서티'],
				recommendations: ['덴서티'],
			}),
		],
		{ brand, aliases },
	);
}
const aggregated = aggregateAsiWarRoom(war!);
assert('war room live roster drops mock names', aggregated.competitors.every((row) => row.name !== '메디컬라운지'));
assert('war room live roster shows 덴서티', aggregated.competitors.some((row) => row.name === '덴서티'));

const small: AsiSovObservation[] = (['chatgpt', 'gemini', 'perplexity', 'claude'] as AsiEngineId[]).map((provider) => ({
	query: '대구 흉터 추천',
	category: 'recommend',
	provider,
	brandMentioned: provider === 'chatgpt',
	competitorMentions: ['덴서티'],
	recommended: provider === 'chatgpt',
	rank: null,
	position: null,
	citations: [],
	timestamp: '2026-08-30T00:00:00.000Z',
	source: 'live',
}));
const sparseSov = overlayLiveSov(mock!, small);
assert('sparse live keeps insufficient flag', sparseSov.sov.sufficient === false && sparseSov.sov.computedFrom === 'live');

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
