/**
 * Provider contract + Mock/live swap without UI changes.
 * Run: npx tsx scripts/test-intelligence-providers.ts
 */
import { createAsiEngine } from '../lib/ai-search-intelligence/adapters/create-engine';
import { overlayLiveRecommendations, toRecommendationResult } from '../lib/ai-search-intelligence/providers/compose';
import { createMockAsiProvider } from '../lib/ai-search-intelligence/providers/mock-provider';
import { resolveAsiMode } from '../lib/ai-search-intelligence/providers/resolve-mode';
import { createAsiService, runAsiService } from '../lib/ai-search-intelligence/service/asi-service';
import type { AIResponse, AsiRecommendationSnapshot } from '../lib/ai-search-intelligence/types';

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
		'default mode is mock, live, or hybrid',
		resolveAsiMode() === 'mock' || resolveAsiMode() === 'live' || resolveAsiMode() === 'hybrid',
	);

	const provider = createMockAsiProvider('chatgpt');
	const response = await provider.query({
		query: '대구 흉터 치료 추천',
		url,
		brand: 'Sunshine',
		location: '대구',
		category: '흉터 치료',
	});

	assert('AIResponse provider', response.provider === 'chatgpt');
	assert('AIResponse query', response.query.includes('흉터'));
	assert('AIResponse answer', response.answer.length > 10);
	assert('AIResponse mentions array', Array.isArray(response.mentions));
	assert('AIResponse recommendations array', Array.isArray(response.recommendations));
	assert('AIResponse citations', response.citations.length >= 1 && Boolean(response.citations[0]?.url));
	assert('AIResponse confidence', response.confidence >= 0 && response.confidence <= 1);
	assert('AIResponse timestamp', Boolean(response.timestamp));
	assert('mock source', response.source === 'mock');
	assert('mock port has name', provider.name.length > 0);
	assert('mock isAvailable', provider.isAvailable() === true);
	assert('mock generateAnswer alias', typeof provider.generateAnswer === 'function');
	assert('mock extractCitations', provider.extractCitations(response.answer, { urls: [url] }).length >= 1);
	const mockHealth = await provider.healthCheck();
	assert('mock health ok', mockHealth.ok && mockHealth.code === 'ok');
	assert('mock meta is not fallback', response.meta?.fallback === false);

	const rec = toRecommendationResult(response, 'Sunshine');
	assert('RecommendationResult provider', rec.provider === 'chatgpt');
	assert('RecommendationResult query', rec.query === response.query);
	assert('RecommendationResult brand', rec.brand === 'Sunshine');
	assert('RecommendationResult has mention flag', typeof rec.mentioned === 'boolean');

	const engine = createAsiEngine('mock');
	const war = await engine.loadWarRoom({ url });
	const perception = await engine.loadPerception({ url });
	assert('engine has war room', Boolean(war?.kpis));
	assert('engine has perception', Boolean(perception?.axes));

	const base = await engine.loadRecommendation({ url, query: '테스트 질문' });
	assert('engine recommendation', Boolean(base?.testResults.length));

	const unchanged = overlayLiveRecommendations(base as AsiRecommendationSnapshot, [response], 'Sunshine');
	assert('mock overlay is no-op', unchanged.testResults[0]?.summary === base?.testResults[0]?.summary);

	const liveResponse: AIResponse = {
		...response,
		source: 'live',
		answer: '라이브 오버레이 답변',
		mentions: ['Sunshine'],
		recommendations: ['Sunshine'],
	};
	const overlaid = overlayLiveRecommendations(base as AsiRecommendationSnapshot, [liveResponse], 'Sunshine');
	assert('live overlay replaces chatgpt row', overlaid.testResults.find((row) => row.engine === 'chatgpt')?.summary === '라이브 오버레이 답변');

	const fallbackResponse: AIResponse = {
		...response,
		source: 'fallback',
		answer: '폴백 답변',
		meta: { mode: 'hybrid', provider: 'openai', engine: 'chatgpt', fallback: true, error: 'missing_key' },
	};
	const fallbackOverlay = overlayLiveRecommendations(base as AsiRecommendationSnapshot, [fallbackResponse], 'Sunshine');
	const fallbackRow = fallbackOverlay.testResults.find((row) => row.engine === 'chatgpt');
	assert('fallback overlay is labeled', fallbackRow?.source === 'fallback' && fallbackRow.fallback === true);
	assert('fallback overlay keeps error', fallbackRow?.error === 'missing_key');

	const viaService = await runAsiService('war-room', { url });
	assert('service matches engine', viaService?.kpis.visibility === war?.kpis.visibility);
	assert('service factory is port', typeof createAsiService().loadEvidence === 'function');

	const liveEngine = createAsiEngine('live');
	const liveRec = await liveEngine.loadRecommendation({ url });
	assert('live engine still returns snapshot', Boolean(liveRec?.simulator));
	assert('live engine exposes SOV coverage', typeof liveRec?.sov.coverage?.queryCount === 'number');
	assert(
		'live engine does not invent SOV when sample is short',
		liveRec?.sov.coverage?.calculable
			? liveRec.sov.mention.value != null
			: liveRec?.sov.mention.value == null && liveRec?.sov.computedFrom === 'live',
	);

	if (failed) {
		console.error(`\n${failed} failed`);
		process.exit(1);
	}
	console.log('\nall passed');
})();
