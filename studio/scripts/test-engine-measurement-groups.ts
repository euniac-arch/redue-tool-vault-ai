/**
 * Live vs proxy engine grouping — legal/trust split for the report UI.
 * Run: npx tsx scripts/test-engine-measurement-groups.ts
 */
import {
	AI_ENGINE_IDS,
	LIVE_GROUNDING_ENGINE_IDS,
	PROXY_INDEX_ENGINE_IDS,
	isLiveGroundingEngine,
	isProxyIndexEngine,
	liveGroundingOrderIndex,
} from '../types/geo-diagnostic';

let failed = 0;

function assert(ok: boolean, label: string) {
	if (!ok) {
		failed += 1;
		console.error(`fail: ${label}`);
		return;
	}
	console.log(`ok: ${label}`);
}

assert(LIVE_GROUNDING_ENGINE_IDS.length === 4, '4 live-grounding engines');
assert(
	LIVE_GROUNDING_ENGINE_IDS.join(',') === 'chatgpt,perplexity,gemini,claude',
	'live-grounding display order is ChatGPT → Perplexity → Gemini → Claude',
);
assert(
	['claude', 'gemini', 'perplexity', 'chatgpt']
		.sort((a, b) => liveGroundingOrderIndex(a) - liveGroundingOrderIndex(b))
		.join(',') === 'chatgpt,perplexity,gemini,claude',
	'liveGroundingOrderIndex sorts ChatGPT → Perplexity → Gemini → Claude',
);
assert(PROXY_INDEX_ENGINE_IDS.length === 2, '2 proxy engines');
assert(
	LIVE_GROUNDING_ENGINE_IDS.every((id) => isLiveGroundingEngine(id) && !isProxyIndexEngine(id)),
	'live helpers match the live set',
);
assert(
	PROXY_INDEX_ENGINE_IDS.every((id) => isProxyIndexEngine(id) && !isLiveGroundingEngine(id)),
	'proxy helpers match the proxy set',
);
assert(
	AI_ENGINE_IDS.every((id) => isLiveGroundingEngine(id) !== isProxyIndexEngine(id)),
	'every catalog engine is exclusively live or proxy',
);
assert(!isLiveGroundingEngine('copilot') && !isProxyIndexEngine('chatgpt'), 'no cross-labeling');

if (failed) {
	console.error(`failed: ${failed}`);
	process.exit(1);
}
console.log('engine-measurement-groups ok');
