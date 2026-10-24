/**
 * Live-check engine behavior with a stubbed fetch. No paid API is called.
 * Covers: credit vs rate-limit separation, billing stops fallback, empty body and parse failure
 * are never "not exposed", no-search-evidence, brand mention vs official citation,
 * URL false-positive prevention, engine isolation, and secret hygiene.
 * Run: npx tsx scripts/test-live-check-engines.ts
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { classifyProviderError, extractProviderError, scrubSecrets, stopsModelFallback } from '../lib/audit/live-check-errors';
import { runLiveEngineChecks } from '../lib/audit/live-check-engines';
import { urlMatchesSite } from '../lib/audit/live-check-mentions';
import type { LiveEngineCheckResult } from '../types/live-engine-check';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	realConsole.error(`FAIL ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}`.slice(0, 600) : ''}`);
}

type Call = { host: string; body: Record<string, unknown>; url: string };
type Reply = { status: number; json: unknown } | 'hang' | 'throw';

const realFetch = globalThis.fetch;
const realConsole = { info: console.info, error: console.error, warn: console.warn, log: console.log };
const calls: Call[] = [];
let handler: (call: Call) => Reply = () => ({ status: 500, json: {} });

function quiet() {
	console.info = () => undefined;
	console.error = () => undefined;
	console.warn = () => undefined;
	console.log = () => undefined;
}
function loud() {
	console.info = realConsole.info;
	console.error = realConsole.error;
	console.warn = realConsole.warn;
	console.log = realConsole.log;
}

function stubFetch() {
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		const host = url.includes('perplexity') ? 'perplexity' : url.includes('generativelanguage') ? 'gemini' : url.includes('openai') ? 'openai' : 'anthropic';
		const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
		const call = { host, body, url };
		calls.push(call);
		const out = handler(call);
		if (out === 'throw') throw new TypeError('fetch failed');
		if (out === 'hang') {
			return new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
			});
		}
		return new Response(JSON.stringify(out.json), { status: out.status, headers: { 'Content-Type': 'application/json', 'x-request-id': 'req-test-1' } });
	}) as typeof fetch;
}

process.env.GEMINI_API_KEY = 'test-gemini-key-value';
process.env.PERPLEXITY_API_KEY = 'test-pplx-key-value';
process.env.OPENAI_API_KEY = 'test-openai-key-value';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key-value';
for (const flag of ['MOCK_OPENAI', 'MOCK_GEMINI', 'MOCK_PERPLEXITY', 'MOCK_CLAUDE']) delete process.env[flag];
delete process.env.GEMINI_MODEL;
delete process.env.PERPLEXITY_MODEL;

const input = {
	siteUrl: 'https://sky-clinic.com',
	siteName: '스카이피부과의원',
	targetQuery: '강남 피부과 추천',
	brandAliases: ['스카이피부과의원'],
	ruleScores: { gemini: 61, chatgpt: 62, perplexity: 63, claude: 64 },
};

const pick = (results: LiveEngineCheckResult[], engine: string) => results.find((row) => row.engine === engine);

const pplx = (content: string, citations: string[] = [], searchResults: string[] = []) => ({
	status: 200,
	json: {
		choices: [{ message: { content } }],
		citations,
		search_results: searchResults.map((url) => ({ url, title: 't' })),
	},
});

const gem = (text: string, grounding?: Record<string, unknown>) => ({
	status: 200,
	json: { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP', ...(grounding ? { groundingMetadata: grounding } : {}) }] },
});

function onlyEngines(overrides: Partial<Record<'perplexity' | 'gemini' | 'openai' | 'anthropic', Reply>>) {
	handler = (call) => overrides[call.host as 'perplexity'] ?? { status: 500, json: { error: { message: 'unexpected' } } };
}

async function main() {
	// ── Error classification: provider fields decide, not the HTTP status alone.
	const classify = (status: number, json: unknown) => classifyProviderError(extractProviderError(status, json, 'x'));
	assert('perplexity 401 insufficient_quota is billing, not auth', classify(401, { error: { message: 'Insufficient credits', type: 'insufficient_quota', code: 401 } }) === 'billing');
	assert('gemini 402 RESOURCE_EXHAUSTED prepayment depleted is billing', classify(402, { error: { code: 402, status: 'RESOURCE_EXHAUSTED', message: 'Your prepayment credits are depleted.' } }) === 'billing');
	assert('openai 429 insufficient_quota is billing', classify(429, { error: { type: 'insufficient_quota', message: 'You exceeded your current quota' } }) === 'billing');
	assert('anthropic low credit balance (400) is billing', classify(400, { error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the API' } }) === 'billing');
	assert('plain 429 too many requests is a temporary rate limit', classify(429, { error: { message: 'Too many requests' } }) === 'rate_limit');
	assert('429 with a per-minute window is a rate limit', classify(429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded for requests per minute. Please retry in 20s' } }) === 'rate_limit');
	assert('a real 401 invalid key is auth', classify(401, { error: { message: 'Invalid API key provided' } }) === 'auth');
	assert('404 model not found is model_unavailable', classify(404, { error: { message: 'models/x is not found' } }) === 'model_unavailable');
	assert('400 invalid argument is bad_request', classify(400, { error: { status: 'INVALID_ARGUMENT', message: 'bad field' } }) === 'bad_request');
	assert('503 is a provider error', classify(503, {}) === 'provider_error');
	assert('billing, auth, rate-limit and missing key stop model fallback', (['billing', 'auth', 'rate_limit', 'missing_key'] as const).every((kind) => stopsModelFallback(kind)));
	assert('model_unavailable and empty_body keep model fallback', !stopsModelFallback('model_unavailable') && !stopsModelFallback('empty_body'));
	assert('scrubSecrets removes key-shaped text', !/AIza|sk-|pplx-|Bearer abc/.test(scrubSecrets('key=AIzaSyA1234567890123456789012345 sk-abcdefghijklmnopqrstu pplx-abcdefghijklmnopqrstu Bearer abc.def')));

	// ── Official domain matching by parsed host, never by substring.
	assert('same host matches', urlMatchesSite('https://sky-clinic.com/a', 'https://sky-clinic.com'));
	assert('www is ignored', urlMatchesSite('https://www.sky-clinic.com/a', 'https://sky-clinic.com'));
	assert('a subdomain of the official host matches', urlMatchesSite('https://blog.sky-clinic.com/p', 'https://sky-clinic.com'));
	assert('a lookalike suffix does not match', !urlMatchesSite('https://notsky-clinic.com/', 'https://sky-clinic.com'));
	assert('the official host used as a subdomain of another domain does not match', !urlMatchesSite('https://sky-clinic.com.evil.io/', 'https://sky-clinic.com'));
	assert('the official host in a query string does not match', !urlMatchesSite('https://example.com/?u=sky-clinic.com', 'https://sky-clinic.com'));
	assert('a parent domain does not match a subdomain site', !urlMatchesSite('https://clinic.com/', 'https://sky.clinic.com'));
	assert('a sibling subdomain does not match', !urlMatchesSite('https://other.clinic.com/', 'https://sky.clinic.com'));

	stubFetch();
	quiet();

	// ── A. Credit exhaustion: each engine stops after one call and keeps its estimate.
	calls.length = 0;
	onlyEngines({
		perplexity: { status: 401, json: { error: { message: 'Insufficient credits', type: 'insufficient_quota', code: 401 } } },
		gemini: { status: 402, json: { error: { code: 402, status: 'RESOURCE_EXHAUSTED', message: 'Your prepayment credits are depleted.' } } },
		openai: { status: 500, json: {} },
		anthropic: { status: 500, json: {} },
	});
	let results = await runLiveEngineChecks(input);
	let p = pick(results, 'perplexity');
	let g = pick(results, 'gemini');
	assert('perplexity credit exhaustion is classified billing with HTTP 401 kept', p?.failureKind === 'billing' && p.httpStatus === 401 && p.statusDetail === 'BILLING_ERROR', { kind: p?.failureKind, status: p?.httpStatus, detail: p?.statusDetail });
	assert('gemini credit exhaustion is classified billing with HTTP 402 kept', g?.failureKind === 'billing' && g.httpStatus === 402 && g.statusDetail === 'BILLING_ERROR', { kind: g?.failureKind, status: g?.httpStatus, detail: g?.statusDetail });
	assert('a billing failure keeps the estimated rule score and is not live', p?.isLive === false && p.fallbackToRuleScore === true && p.liveScore === 63 && g?.liveScore === 61);
	assert('a billing failure is request_failed, never a non-exposure verdict', p?.observation === 'request_failed' && g?.observation === 'request_failed' && p.isLiveGrounded === false && p.isCited === false && p.tier !== 'NOT_FOUND');
	assert('the request id and provider code are kept', p?.providerRequestId === 'req-test-1' && Boolean(p.providerErrorCode));
	assert('a billing error does not try another model', calls.filter((c) => c.host === 'perplexity').length === 1 && calls.filter((c) => c.host === 'gemini').length === 1, calls.map((c) => c.host));
	assert('the billing message points the operator at billing', Boolean(p?.error?.includes('결제')) && Boolean(g?.error?.includes('결제')), { p: p?.error, g: g?.error });

	// ── B. Temporary rate limit is a different kind and also stops fallback.
	calls.length = 0;
	onlyEngines({
		perplexity: { status: 429, json: { error: { message: 'Too many requests' } } },
		gemini: { status: 429, json: { error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded for requests per minute. Please retry in 12s' } } },
	});
	results = await runLiveEngineChecks(input);
	p = pick(results, 'perplexity');
	g = pick(results, 'gemini');
	assert('429 rate limits are not billing', p?.failureKind === 'rate_limit' && g?.failureKind === 'rate_limit' && p.statusDetail === 'RATE_LIMIT' && g.statusDetail === 'RATE_LIMIT', { p: p?.failureKind, g: g?.failureKind });
	assert('a rate limit does not try every model', calls.filter((c) => c.host === 'gemini').length === 1);

	// ── C. Search engines with real evidence.
	calls.length = 0;
	onlyEngines({
		perplexity: pplx('강남에는 여러 피부과가 있습니다. 스카이피부과의원도 언급됩니다.', ['https://sky-clinic.com/about', 'https://example.com/list']),
		gemini: gem('강남 피부과 후보를 정리했습니다.', {
			webSearchQueries: ['강남 피부과 추천'],
			groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc', title: 'sky-clinic.com' } }],
			groundingSupports: [{ groundingChunkIndices: [0] }],
		}),
	});
	results = await runLiveEngineChecks(input);
	p = pick(results, 'perplexity');
	g = pick(results, 'gemini');
	assert('perplexity with citations is live and grounded', p?.isLive === true && p.isLiveGrounded === true && p.searchEvidence === true && p.fallbackToRuleScore === false, p);
	assert('perplexity citing the official page is official_cited', p?.observation === 'official_cited' && p.officialCited === true);
	assert('gemini grounding via the domain title is official_cited when the answer uses it', g?.observation === 'official_cited' && g.officialCited === true && g.isLiveGrounded === true, g);
	assert('the search question does not name the audited brand or URL', calls.filter((c) => c.host === 'perplexity' || c.host === 'gemini').every((c) => !JSON.stringify(c.body).includes('스카이피부과의원') && !JSON.stringify(c.body).includes('sky-clinic')));
	assert('gemini declares Google Search grounding and a non-retired model', JSON.stringify(calls.find((c) => c.host === 'gemini')?.body.tools).includes('google_search') && !calls.find((c) => c.host === 'gemini')?.url.includes('gemini-2.0'));
	assert('the api key travels in headers, not in the url', calls.every((c) => !c.url.includes('key=') && !c.url.includes('test-gemini-key-value')));

	// ── D. Brand mentioned but official domain not cited.
	onlyEngines({
		perplexity: pplx('스카이피부과의원이 강남에서 자주 언급됩니다.', ['https://example.com/list', 'https://notsky-clinic.com/']),
		gemini: gem('강남 피부과 정리', { webSearchQueries: ['q'], groundingChunks: [{ web: { uri: 'https://example.com', title: 'example.com' } }], groundingSupports: [{ groundingChunkIndices: [0] }] }),
	});
	results = await runLiveEngineChecks(input);
	p = pick(results, 'perplexity');
	g = pick(results, 'gemini');
	assert('a brand mention without an official citation is brand_mentioned', p?.observation === 'brand_mentioned' && p.brandMentioned === true && p.officialCited === false, { obs: p?.observation, off: p?.officialCited });
	assert('a lookalike domain in citations is not an official citation', p?.officialCited === false);
	assert('valid search without the target is not_observed (a real, grounded non-find)', g?.observation === 'not_observed' && g.isLiveGrounded === true && g.officialCited === false, g);

	// ── E. Official domain only among retrieved results, not cited in the answer.
	onlyEngines({
		perplexity: pplx('강남 피부과 정리 답변', ['https://example.com/list'], ['https://sky-clinic.com/about', 'https://example.com/list']),
		gemini: gem('후보 정리', {
			webSearchQueries: ['q'],
			groundingChunks: [{ web: { uri: 'https://example.com', title: 'example.com' } }, { web: { uri: 'https://x', title: 'sky-clinic.com' } }],
			groundingSupports: [{ groundingChunkIndices: [0] }],
		}),
	});
	results = await runLiveEngineChecks(input);
	p = pick(results, 'perplexity');
	g = pick(results, 'gemini');
	assert('perplexity: official in search_results but not in citations is official_in_results', p?.observation === 'official_in_results' && p.officialCited === false && p.officialInResults === true, { obs: p?.observation });
	assert('gemini: official chunk the answer does not use is official_in_results', g?.observation === 'official_in_results' && g.officialCited === false, { obs: g?.observation });

	// ── F. A 200 with no body is a failure, never a non-exposure.
	onlyEngines({
		perplexity: { status: 200, json: { choices: [{ message: { content: '' } }], citations: [] } },
		gemini: { status: 200, json: { candidates: [{ content: { parts: [] }, finishReason: 'SAFETY' }] } },
	});
	results = await runLiveEngineChecks(input);
	p = pick(results, 'perplexity');
	g = pick(results, 'gemini');
	assert('an empty perplexity body is empty_body', p?.failureKind === 'empty_body' && p.observation === 'empty_body' && p.isLive === false, p);
	assert('an empty gemini body is empty_body and keeps the blocked reason out of the verdict', g?.failureKind === 'empty_body' && g.isLive === false && g.tier !== 'NOT_FOUND', g);
	assert('empty bodies keep the estimate and are not graded', p?.fallbackToRuleScore === true && p.liveScore === 63 && g?.liveScore === 61 && p.isLiveGrounded === false);

	// ── G. A body without any search evidence is not a measurement.
	onlyEngines({
		perplexity: pplx('스카이피부과의원은 강남의 피부과입니다.', [], []),
		gemini: gem('스카이피부과의원은 강남의 피부과입니다.'),
	});
	results = await runLiveEngineChecks(input);
	p = pick(results, 'perplexity');
	g = pick(results, 'gemini');
	assert('perplexity text without citations is no_search_evidence', p?.observation === 'no_search_evidence' && p.searchEvidence === false && p.isLiveGrounded === false && p.fallbackToRuleScore === true, p);
	assert('gemini text without grounding is no_search_evidence', g?.observation === 'no_search_evidence' && g.isLiveGrounded === false && g.liveScore === 61, g);
	assert('no_search_evidence is neither a failure kind nor a non-exposure verdict', p?.failureKind === undefined && p.tier !== 'NOT_FOUND' && p.isCited === false);
	assert('the answer is still recorded as a real body', p?.isLive === true);

	// ── H. ChatGPT and Claude have no citations array. The answer text is checked instead.
	onlyEngines({
		openai: { status: 200, json: { choices: [{ message: { content: JSON.stringify({ isCited: true, mentionType: 'recommended', rank: 1, evidenceSnippet: '스카이피부과의원 추천', reachLevel: 'Level 3', citationUrl: 'https://sky-clinic.com' }) } }] } },
		anthropic: { status: 200, json: { content: [{ type: 'tool_use', name: 'report_citation_check', input: { isCited: true, mentionType: 'recommended', rank: 1, evidenceSnippet: '스카이피부과의원', reachLevel: 'Level 3' } }] } },
	});
	results = await runLiveEngineChecks(input);
	let c = pick(results, 'chatgpt');
	let cl = pick(results, 'claude');
	assert('chatgpt text that contains the official domain is a partial text match, not a search citation', c?.statusDetail === 'TEXT_DOMAIN' && c.observation === 'text_domain' && c.isLive === true && c.isLiveGrounded === true && c.searchEvidence === false && c.officialCited === true && c.liveScore === 80 && c.fallbackToRuleScore === false, c);
	assert('claude text that names the brand but not the domain is a brand text match', cl?.statusDetail === 'TEXT_MENTION' && cl.observation === 'text_mention' && cl.brandMentioned === true && cl.officialCited === false && cl.searchEvidence === false && cl.liveScore === 75 && !cl.failureKind, cl);

	onlyEngines({
		openai: { status: 200, json: { choices: [{ message: { content: '강남에는 여러 피부과가 있습니다. 특정 병원은 확인하지 못했습니다.' } }] } },
		anthropic: { status: 200, json: { content: [{ type: 'text', text: '스카이피부과의원이 언급되지 않았습니다.' }] } },
	});
	results = await runLiveEngineChecks(input);
	c = pick(results, 'chatgpt');
	cl = pick(results, 'claude');
	assert('chatgpt text with neither brand nor domain is NO_CITATION, not an error', c?.statusDetail === 'NO_CITATION' && c.observation === 'answer_no_mention' && c.isLive === true && c.isLiveGrounded === false && c.fallbackToRuleScore === true && c.liveScore === 62 && !c.failureKind && !c.error, c);
	assert('a negated brand sentence is not a text mention', cl?.statusDetail === 'NO_CITATION' && cl.brandMentioned === false && cl.isLiveGrounded === false, cl);

	onlyEngines({
		openai: { status: 200, json: { choices: [{ message: { content: '자세한 안내는 https://notsky-clinic.com 과 https://sky-clinic.com.evil.io 를 보세요.' } }] } },
	});
	results = await runLiveEngineChecks(input);
	c = pick(results, 'chatgpt');
	assert('a lookalike domain in chatgpt text is not an official-domain match', c?.statusDetail === 'NO_CITATION' && c.officialCited === false, c);

	// ── I. Engine isolation: a thrown or hung engine does not change the others.
	onlyEngines({
		perplexity: pplx('스카이피부과의원 안내', ['https://sky-clinic.com']),
		gemini: 'throw',
	});
	results = await runLiveEngineChecks(input);
	g = pick(results, 'gemini');
	p = pick(results, 'perplexity');
	assert('a network error on gemini is network, not non-exposure', g?.failureKind === 'network' && g.isLive === false, g?.failureKind);
	assert('another engine is unaffected by that failure', p?.isLive === true && p.isLiveGrounded === true && p.officialCited === true);
	assert('all four engines always return a result', results.length === 4);

	onlyEngines({ perplexity: pplx('스카이피부과의원', ['https://sky-clinic.com']), gemini: 'hang' });
	const started = Date.now();
	results = await runLiveEngineChecks(input);
	g = pick(results, 'gemini');
	assert('a hung engine times out as timeout within about 15s', g?.failureKind === 'timeout' && Date.now() - started < 18_000 && Date.now() - started >= 14_000, { kind: g?.failureKind, ms: Date.now() - started });
	assert('a timeout does not block the other engines', pick(results, 'perplexity')?.isLiveGrounded === true);

	// ── J. Missing key and secret hygiene.
	delete process.env.PERPLEXITY_API_KEY;
	onlyEngines({ gemini: gem('x', { webSearchQueries: ['q'], groundingChunks: [] }) });
	results = await runLiveEngineChecks(input);
	assert('a missing key is missing_key without any request', pick(results, 'perplexity')?.failureKind === 'missing_key' && !calls.slice(-4).some((call) => call.host === 'perplexity'));
	process.env.PERPLEXITY_API_KEY = 'test-pplx-key-value';
	assert('no result exposes a configured key', !/test-(gemini|pplx|openai|anthropic)-key-value/.test(JSON.stringify(results)));

	// ── K. MOCK flags are ignored in production and never look like a measurement.
	loud();
	quiet();
	process.env.MOCK_PERPLEXITY = 'true';
	calls.length = 0;
	onlyEngines({ perplexity: pplx('스카이피부과의원', ['https://sky-clinic.com']) });
	results = await runLiveEngineChecks(input);
	p = pick(results, 'perplexity');
	assert('outside production a mock result is labeled mock and not grounded', p?.isMock === true && p.observation === 'mock' && p.isLiveGrounded === false && p.fallbackToRuleScore === true && !calls.some((call) => call.host === 'perplexity'), p);
	const env = process.env as Record<string, string | undefined>;
	const previousEnv = env.NODE_ENV;
	env.NODE_ENV = 'production';
	results = await runLiveEngineChecks(input);
	p = pick(results, 'perplexity');
	env.NODE_ENV = previousEnv;
	delete process.env.MOCK_PERPLEXITY;
	assert('in production the MOCK flag is ignored and the real call is made', p?.isMock !== true && calls.some((call) => call.host === 'perplexity') && p?.isLiveGrounded === true, p);

	// ── L. Static guards.
	loud();
	const scoreSource = readFileSync(path.resolve(__dirname, '../lib/audit/live-check-score.ts'), 'utf8');
	assert('timeout constant is 15s', /LIVE_CHECK_TIMEOUT_MS = 15_000/.test(scoreSource));
	const engineSource = readFileSync(path.resolve(__dirname, '../lib/audit/live-check-engines.ts'), 'utf8');
	assert('each engine has its own AbortController and allSettled', engineSource.includes('new AbortController()') && engineSource.includes('Promise.allSettled'));
	assert('no key is placed in a url or logged', !/\?key=\$\{/.test(engineSource) && !/console\.\w+\([^)]*apiKey/.test(engineSource));
	assert('chatgpt and claude raw answers are logged for debugging', engineSource.includes("console.log('[ChatGPT Raw Content]:'") && engineSource.includes("console.log('[Claude Raw Content]:'"));
}

main()
	.catch((error) => {
		failed += 1;
		console.error(error);
	})
	.finally(() => {
		globalThis.fetch = realFetch;
		loud();
		if (failed) {
			console.error(`\n${failed} assertion(s) failed`);
			process.exitCode = 1;
			return;
		}
		console.log('\nall live-check engine assertions passed');
	});
