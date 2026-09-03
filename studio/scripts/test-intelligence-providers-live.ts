/**
 * Live provider factory + overlay. Real HTTP is covered by
 * test-intelligence-providers-connection.ts (STEP 14).
 * This file asserts the live path is wired and still returns snapshots without keys.
 * Run: npx tsx scripts/test-intelligence-providers-live.ts
 */
import { createAsiEngine } from '../lib/ai-search-intelligence/adapters/create-engine';
import { overlayLiveRecommendations, toRecommendationResult } from '../lib/ai-search-intelligence/providers/compose';
import { createAsiProviders } from '../lib/ai-search-intelligence/providers/create-providers';
import { createMockAsiProvider } from '../lib/ai-search-intelligence/providers/mock-provider';
import { asiProviderRuntimeStatus, resolveAsiMode } from '../lib/ai-search-intelligence/providers/resolve-mode';
import { ASI_ENGINES, type AIResponse } from '../lib/ai-search-intelligence/types';

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

void (async () => {
	assert(
		'mode resolver returns mock, live, or hybrid',
		resolveAsiMode() === 'mock' || resolveAsiMode() === 'live' || resolveAsiMode() === 'hybrid',
	);
	assert(
		'every engine has a runtime status',
		ASI_ENGINES.every((id) => {
			const status = asiProviderRuntimeStatus(id);
			return status === 'mock' || status === 'live' || status === 'unavailable';
		}),
	);

	const providers = createAsiProviders();
	assert('factory returns 4 providers', providers.length === 4);
	assert(
		'factory ids match engines',
		providers.map((item) => item.id).join() === ASI_ENGINES.join(),
	);

	const first = await providers[0].query({ query: '대구 흉터 치료 추천', url, brand: 'Sunshine' });
	assert('factory exposes generateAnswer', typeof providers[0].generateAnswer === 'function');
	assert('factory exposes healthCheck', typeof providers[0].healthCheck === 'function');
	assert(
		'live-or-mock query returns AIResponse',
		first.provider === providers[0].id && (first.answer.length > 0 || Boolean(first.meta?.error)),
	);
	assert(
		'live-or-mock source is tagged',
		first.source === 'mock' || first.source === 'live' || first.source === 'fallback',
	);
	assert('response meta has provider + fallback flag', typeof first.meta?.fallback === 'boolean' && Boolean(first.meta?.provider));
	assert('toRecommendationResult works on factory output', toRecommendationResult(first, 'Sunshine').brand === 'Sunshine');

	const mock = createMockAsiProvider('chatgpt');
	const mockRes = await mock.query({ query: '테스트', url, brand: 'Sunshine' });
	const liveResponse: AIResponse = {
		...mockRes,
		source: 'live',
		answer: '라이브 오버레이 답변',
		mentions: ['Sunshine'],
		recommendations: ['Sunshine'],
	};

	const engine = createAsiEngine('live');
	const rec = await engine.loadRecommendation({ url, query: '테스트 질문' });
	assert('live engine returns recommendation', Boolean(rec?.testResults.length));
	assert('live engine returns sov', typeof rec?.sov.overall === 'number');

	const overlaid = overlayLiveRecommendations(rec!, [liveResponse], 'Sunshine');
	assert(
		'live overlay replaces chatgpt summary',
		overlaid.testResults.find((row) => row.engine === 'chatgpt')?.summary === '라이브 오버레이 답변',
	);

	const war = await engine.loadWarRoom({ url });
	assert('live engine returns war room', Boolean(war?.kpis));

	if (failed) {
		console.error(`\n${failed} failed`);
		process.exit(1);
	}
	console.log('\nall passed');
})();
