/**
 * Live-first Share of Voice engine: extract → count → insufficient guard.
 * Run: npx tsx scripts/test-intelligence-sov.ts
 */
import { buildMockRecommendationSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-recommendation';
import { buildMockWarRoomSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-war-room';
import { calculateAsiSov, ASI_SOV_MIN_SAMPLE } from '../lib/ai-search-intelligence/sov/calculate';
import { classifyAsiSovQuery } from '../lib/ai-search-intelligence/sov/classify';
import { buildAsiSovCoverage, mergeCitationResponsesIntoSovStore } from '../lib/ai-search-intelligence/sov/coverage';
import { extractAsiSovObservation } from '../lib/ai-search-intelligence/sov/extract';
import { overlayLiveSov } from '../lib/ai-search-intelligence/sov/overlay';
import { buildAsiQuerySet } from '../lib/ai-search-intelligence/sov/query-set';
import { appendAsiSovStore, clearAsiSovStore, readAsiSovStore } from '../lib/ai-search-intelligence/sov/store';
import { appendAsiCitationStore, clearAsiCitationStore } from '../lib/ai-search-intelligence/citations/store';
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

function observation(partial: Partial<AsiSovObservation> & Pick<AsiSovObservation, 'query' | 'provider'>): AsiSovObservation {
	return {
		category: 'recommend',
		brandMentioned: false,
		competitorMentions: [],
		recommended: false,
		rank: null,
		position: null,
		citations: [],
		timestamp: new Date().toISOString(),
		source: 'live',
		...partial,
	};
}

function response(partial: Partial<AIResponse> & Pick<AIResponse, 'provider' | 'query'>): AIResponse {
	return {
		answer: '나인원의원이 3위입니다.',
		mentions: ['나인원의원', '서울탑클리닉'],
		recommendations: ['서울탑클리닉', '메디컬라운지', '나인원의원'],
		citations: [{ source: 'site', url: 'https://nineone.kr', type: 'official', relevance: 70, authority: 70 }],
		confidence: 0.8,
		timestamp: new Date().toISOString(),
		source: 'live',
		...partial,
	};
}

assert('classify recommend', classifyAsiSovQuery('대구 피부과 추천') === 'recommend');
assert('classify compare', classifyAsiSovQuery('대구 피부과 비교') === 'compare');
assert('classify purchase', classifyAsiSovQuery('피부과 비용 얼마') === 'purchase');
assert('classify solve', classifyAsiSovQuery('흉터 치료 효과 없으면') === 'solve');
assert('classify local', classifyAsiSovQuery('대구 동구 피부과') === 'local');
assert('classify discovery fallback', classifyAsiSovQuery('대구 덴서티') === 'discovery');

const extracted = extractAsiSovObservation(
	response({ provider: 'chatgpt', query: '대구 피부과 추천' }),
	{ brand: '나인원의원' },
);
assert('extract brand mention', extracted?.brandMentioned === true);
assert('extract competitor', extracted?.competitorMentions.includes('서울탑클리닉') === true);
assert('extract recommended', extracted?.recommended === true);
assert('extract rank 3', extracted?.rank === 3);
assert('extract position', extracted?.position === 1);
assert('extract skips error', extractAsiSovObservation(
	response({ provider: 'gemini', query: 'q', answer: '', mentions: [], recommendations: [], meta: { mode: 'live', provider: 'gemini', engine: 'gemini', fallback: false, error: 'timeout' } }),
	{ brand: '나인원의원' },
) === null);

const small = ['chatgpt', 'gemini', 'perplexity', 'claude'].map((provider) =>
	observation({
		provider: provider as AsiEngineId,
		query: '대구 피부과 추천',
		brandMentioned: provider === 'chatgpt',
		recommended: provider === 'chatgpt',
		competitorMentions: ['서울탑클리닉'],
	}),
);
const sparse = calculateAsiSov(small);
assert('min sample is 8', ASI_SOV_MIN_SAMPLE === 8);
assert('4 responses are insufficient', sparse.sufficient === false && sparse.mention.value === null);
assert('sparse keeps sample size', sparse.sampleSize === 4);

const rows: AsiSovObservation[] = [];
for (let i = 0; i < 12; i += 1) {
	const provider = (['chatgpt', 'gemini', 'perplexity', 'claude'] as const)[i % 4];
	rows.push(
		observation({
			provider,
			query: i < 6 ? '대구 피부과 추천' : '대구 피부과 비교',
			category: i < 6 ? 'recommend' : 'compare',
			brandMentioned: i % 3 === 0,
			recommended: i % 4 === 0,
			competitorMentions: i % 2 === 0 ? ['서울탑클리닉'] : ['메디컬라운지', '라온의원'],
			timestamp: new Date(Date.now() - (i < 8 ? 2 : 20) * 24 * 60 * 60 * 1000).toISOString(),
		}),
	);
}
const report = calculateAsiSov(rows);
assert('12 responses are sufficient', report.sufficient === true && report.mention.value != null);
assert(
	'mention SOV is brand / universe',
	report.mention.brandCount / report.mention.universeCount === (report.mention.value ?? -1) / 100 ||
		Math.abs((report.mention.brandCount / report.mention.universeCount) * 100 - (report.mention.value ?? 0)) < 1,
);
assert('recommendation has sample size', report.recommendation.sampleSize === 12);
assert('has 4 providers', report.byProvider.length === 4);
assert('has 6 categories', report.byCategory.length === 6);
assert('has 3 periods', report.byPeriod.length === 3);
assert('7d sample <= 30d sample', (report.byPeriod[0]?.mention.sampleSize ?? 0) <= (report.byPeriod[2]?.mention.sampleSize ?? 0));

const url = 'https://sunshineclinic.kr';
const mock = buildMockRecommendationSnapshot({ url });
const war = buildMockWarRoomSnapshot({ url });
assert('mock sov still matches war room', mock?.sov.overall === war?.kpis.shareOfVoice);
assert('mock computedFrom is mock', mock?.sov.computedFrom === 'mock');
assert('mock sample size is 0', mock?.sov.sampleSize === 0);

if (mock) {
	const unchanged = overlayLiveSov(mock, []);
	assert('no live keeps mock overall', unchanged.sov.overall === mock.sov.overall);
	assert('no live stays mock', unchanged.sov.computedFrom === 'mock');

	const sparseOverlay = overlayLiveSov(mock, small);
	assert('sparse live does not replace overall', sparseOverlay.sov.overall === mock.sov.overall);
	assert('sparse live marks insufficient', sparseOverlay.sov.sufficient === false);
	assert('sparse live stores sample size', sparseOverlay.sov.sampleSize === 4);

	const liveOverlay = overlayLiveSov(mock, rows);
	assert('sufficient live replaces overall', liveOverlay.sov.computedFrom === 'live' && liveOverlay.sov.sufficient);
	assert('live overall equals mention value', liveOverlay.sov.overall === liveOverlay.sov.mention.value);
	assert('sufficient coverage is calculable', liveOverlay.sov.coverage.calculable === true);
	assert('sparse coverage is not calculable', sparseOverlay.sov.coverage.calculable === false);

	const honestEmpty = overlayLiveSov(mock, [], { honestLive: true });
	assert('honest empty is live', honestEmpty.sov.computedFrom === 'live');
	assert('honest empty does not invent mention SOV', honestEmpty.sov.mention.value === null);
	assert('honest empty is not calculable', honestEmpty.sov.coverage.calculable === false);

	const honestSparse = overlayLiveSov(mock, small, { honestLive: true });
	assert('honest sparse does not keep mock overall as a score', honestSparse.sov.mention.value === null);
	assert('honest sparse stays not calculable', honestSparse.sov.coverage.calculable === false);
}

const set = buildAsiQuerySet({ brandName: '나인원의원', location: '대구', category: '피부과' });
assert('default query set has 6', set.length === 6);
assert('query set covers recommend', set.some((item) => item.category === 'recommend' && item.query.includes('추천')));
assert('query set covers local', set.some((item) => item.category === 'local'));

clearAsiSovStore();
appendAsiSovStore(
	'nineone.kr',
	[response({ provider: 'chatgpt', query: '대구 피부과 추천', source: 'live' })],
	{ brand: '나인원의원' },
);
assert('store keeps live observation', readAsiSovStore('nineone.kr').length === 1);
assert(
	'store ignores fallback',
	appendAsiSovStore(
		'nineone.kr',
		[response({ provider: 'gemini', query: '대구 피부과 추천', source: 'fallback', answer: 'fallback' })],
		{ brand: '나인원의원' },
	).length === 1,
);

const shortCoverage = buildAsiSovCoverage({
	observations: [
		observation({ provider: 'chatgpt', query: 'q1', competitorMentions: ['덴서티'] }),
		observation({ provider: 'gemini', query: 'q1', competitorMentions: ['덴서티'] }),
		observation({ provider: 'perplexity', query: 'q2', competitorMentions: ['라온의원'] }),
		observation({ provider: 'claude', query: 'q3', competitorMentions: ['서울탑클리닉'] }),
		observation({ provider: 'chatgpt', query: 'q4', competitorMentions: [] }),
	],
	responses: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'].map((query, index) =>
		response({
			provider: index % 2 === 0 ? 'chatgpt' : 'gemini',
			query,
			answer: index < 5 ? '답변' : '',
			mentions: index < 5 ? ['덴서티'] : [],
			recommendations: [],
			meta: index < 5 ? undefined : { mode: 'live', provider: 'chatgpt', engine: 'chatgpt', fallback: false, error: 'timeout' },
		}),
	),
	competitorNames: ['덴서티', '라온의원', '서울탑클리닉'],
});
assert('7 queries stay visible', shortCoverage.queryCount === 7);
assert('5 valid responses counted', shortCoverage.validResponseCount === 5);
assert('3 competitor names counted', shortCoverage.competitorObservationCount === 3);
assert('5 valid responses are not calculable', shortCoverage.calculable === false);

const enoughCoverage = buildAsiSovCoverage({ observations: rows });
assert('12 valid responses are calculable', enoughCoverage.calculable === true && enoughCoverage.validResponseCount === 12);

clearAsiCitationStore();
clearAsiSovStore('merge.example');
const mergeDomain = 'merge.example';
const mergeResponses: AIResponse[] = [];
for (let i = 0; i < 8; i += 1) {
	const provider = (['chatgpt', 'gemini', 'perplexity', 'claude'] as const)[i % 4];
	mergeResponses.push(
		response({
			provider,
			query: i < 4 ? '대구 피부과 추천' : '대구 피부과 비교',
			source: 'live',
		}),
	);
}
appendAsiCitationStore(mergeDomain, mergeResponses, { brand: '나인원의원', siteUrl: 'https://merge.example' });
assert('citation-only store is empty in SOV before merge', readAsiSovStore(mergeDomain).length === 0);
mergeCitationResponsesIntoSovStore(mergeDomain, { brand: '나인원의원' });
assert('merge folds citation answers into SOV', readAsiSovStore(mergeDomain).length === 8);
assert(
	'merged 8 answers are calculable',
	buildAsiSovCoverage({ observations: readAsiSovStore(mergeDomain) }).calculable === true,
);

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
