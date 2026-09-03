/**
 * STEP 21 — AI Search Simulator.
 * Queries come from Target Context or the user. No site-specific hardcoding.
 * Run: npx tsx scripts/test-intelligence-simulator.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildMockRecommendationSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-recommendation';
import { buildSearchSimulation } from '../lib/ai-search-intelligence/recommendation/simulate';
import { exampleSearchQuery } from '../lib/ai-search-intelligence/target/query-pool';
import type { AIResponse, AsiEngineId } from '../lib/ai-search-intelligence/types';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function live(
	partial: Partial<AIResponse> & Pick<AIResponse, 'provider' | 'query' | 'answer'>,
): AIResponse {
	return {
		mentions: [],
		recommendations: [],
		citations: [],
		confidence: 0.7,
		timestamp: '2026-08-30T12:00:00.000Z',
		source: 'live',
		...partial,
	};
}

const hotel = {
	url: 'https://harborinn.example',
	brandName: 'Harbor Inn',
	domain: 'harborinn.example',
	location: '제주',
	category: '호텔',
};

const legal = {
	url: 'https://northlaw.example',
	brandName: 'North Law',
	domain: 'northlaw.example',
	location: '서울',
	category: '법률사무소',
};

assert(
	'hotel example uses hotel context',
	exampleSearchQuery({ ...hotel, services: ['오션뷰'] }).includes('제주') &&
		exampleSearchQuery({ ...hotel, services: ['오션뷰'] }).includes('호텔'),
);
assert('hotel example is not a clinic default', !/피부과|흉터|나인원/.test(exampleSearchQuery({ ...hotel, services: [] })));
assert(
	'legal example uses legal context',
	exampleSearchQuery({ ...legal, services: ['계약'] }).includes('서울') &&
		exampleSearchQuery({ ...legal, services: ['계약'] }).includes('법률사무소'),
);
assert('empty context example stays empty', exampleSearchQuery({ brandName: '', services: [] }) === '');

const recommended = buildSearchSimulation({
	query: '제주에서 호텔 잘하는 곳 추천해줘',
	site: hotel,
	aliases: ['Harbor Inn'],
	responses: [
		live({
			provider: 'gemini',
			query: '제주에서 호텔 잘하는 곳 추천해줘',
			answer: '제주 호텔로는 Harbor Inn과 Grand Harbor를 추천합니다.',
			mentions: ['Harbor Inn', 'Grand Harbor'],
			recommendations: ['Harbor Inn', 'Grand Harbor'],
			citations: [{ source: '공식', url: 'https://harborinn.example/rooms', type: 'official', relevance: 80, authority: 70 }],
		}),
	],
});
assert('live run is observed', recommended.runStatus === 'observed');
assert('target recommended', recommended.targetStatus === 'RECOMMENDED');
assert('keeps competitor from answer', recommended.entities.some((item) => item.name === 'Grand Harbor' && item.role === 'competitor'));
assert('keeps citation url', recommended.citationAvailable && recommended.citations[0]?.url === 'https://harborinn.example/rooms');
assert('does not invent a clinic competitor', recommended.entities.every((item) => !/덴서티|메디컬라운지/.test(item.name)));

const missing = buildSearchSimulation({
	query: '서울에서 법률사무소 추천해줘',
	site: legal,
	responses: [
		live({
			provider: 'chatgpt' as AsiEngineId,
			query: '서울에서 법률사무소 추천해줘',
			answer: '서울에서는 Seoul Counsel을 주로 추천합니다.',
			mentions: ['Seoul Counsel'],
			recommendations: ['Seoul Counsel'],
		}),
	],
});
assert('other brand is NOT_FOUND for target', missing.targetStatus === 'NOT_FOUND');
assert('no citation when provider sent none', missing.citationAvailable === false && missing.citations.length === 0);

const failedRun = buildSearchSimulation({
	query: '테스트',
	site: hotel,
	responses: [
		{
			provider: 'gemini',
			query: '테스트',
			answer: '',
			mentions: [],
			recommendations: [],
			citations: [],
			confidence: 0,
			timestamp: '2026-08-30T12:00:00.000Z',
			source: 'fallback',
			meta: { mode: 'live', provider: 'gemini', engine: 'gemini', fallback: true, error: 'api_key' },
		},
	],
});
assert('provider error is NO_DATA not NOT_FOUND', failedRun.targetStatus === 'NO_DATA');
assert('provider error runStatus is error or fallback', failedRun.runStatus === 'error' || failedRun.runStatus === 'fallback');

const mockSnap = buildMockRecommendationSnapshot({ url: 'https://harborinn.example' });
assert('mock snapshot has simulation', Boolean(mockSnap?.simulation));
assert('mock simulation is not observed', mockSnap?.simulation?.runStatus === 'mock_preview');
assert('mock does not invent citations', mockSnap?.simulation?.citationAvailable === false);
assert('mock default query uses 추천', Boolean(mockSnap?.defaultQuery.includes('추천')));

const panel = readFileSync(join(process.cwd(), 'components/ai-search-intelligence/recommendation/RecommendSimulatorPanel.tsx'), 'utf8');
assert('panel has query input', panel.includes('asi-simulator-query') && panel.includes('textarea'));
assert('panel blocks empty query', panel.includes('!query.trim()'));
assert('panel keeps derived potential', panel.includes('recommendationPotential'));
assert('panel shows observed answer', panel.includes('actualAnswer'));
assert('client does not call providers', !panel.includes('OPENAI') && !panel.includes('GEMINI_API'));

const engineRoots = [
	join(process.cwd(), 'lib', 'ai-search-intelligence', 'recommendation', 'simulate.ts'),
	join(process.cwd(), 'lib', 'ai-search-intelligence', 'recommendation', 'recent-queries.ts'),
	join(process.cwd(), 'components', 'ai-search-intelligence', 'recommendation', 'RecommendSimulatorPanel.tsx'),
];

function walk(path: string): string[] {
	const stat = statSync(path);
	if (stat.isFile()) return [path];
	return readdirSync(path).flatMap((name) => {
		const next = join(path, name);
		return statSync(next).isDirectory() ? walk(next) : [next];
	});
}

const banned = /nineoneclinic|나인원의원|메디컬라운지|덴서티|흉터/;
const src = engineRoots.flatMap(walk).map((file) => readFileSync(file, 'utf8')).join('\n');
assert('simulator logic has no test-target hardcoding', !banned.test(src));
assert('client has no NEXT_PUBLIC provider keys', !/NEXT_PUBLIC_(OPENAI|GEMINI|PERPLEXITY|ANTHROPIC)_API_KEY/.test(src));

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
