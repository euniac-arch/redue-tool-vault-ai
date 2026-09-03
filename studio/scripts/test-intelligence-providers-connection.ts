/**
 * STEP 14 — Real AI provider connection.
 *
 * Browser → /api/intelligence → Service → Adapter → OpenAI / Gemini / Perplexity / Anthropic
 * No new HTTP client. full-audit-engine.ts / live-check-score.ts are not in this path.
 *
 * Run: npx tsx scripts/test-intelligence-providers-connection.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createAsiEngine } from '../lib/ai-search-intelligence/adapters/create-engine';
import { createAsiProviders, createAsiLiveAdapters } from '../lib/ai-search-intelligence/providers/create-providers';
import { createOpenAiAsiProvider } from '../lib/ai-search-intelligence/providers/openai-provider';
import { hasAsiProviderKey, hasAnyAsiProviderKey, resolveAsiMode } from '../lib/ai-search-intelligence/providers/resolve-mode';
import { createAsiService } from '../lib/ai-search-intelligence/service/asi-service';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function read(rel: string) {
	return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name === '.next') continue;
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (/\.(ts|tsx)$/.test(name)) out.push(full);
	}
	return out;
}

async function withEnv<T>(patch: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
	const saved: Record<string, string | undefined> = {};
	for (const name of Object.keys(patch)) {
		saved[name] = process.env[name];
		if (patch[name] === undefined) delete process.env[name];
		else process.env[name] = patch[name];
	}
	try {
		return await fn();
	} finally {
		for (const [name, value] of Object.entries(saved)) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
	}
}

const route = read('app/api/intelligence/route.ts');
const service = read('lib/ai-search-intelligence/service/asi-service.ts');
const liveEngine = read('lib/ai-search-intelligence/adapters/live-engine.ts');
const createProviders = read('lib/ai-search-intelligence/providers/create-providers.ts');
const resolveMode = read('lib/ai-search-intelligence/providers/resolve-mode.ts');
const example = read('.env.example');

assert('API route calls runAsiOperation', route.includes('runAsiOperation'));
assert('API route does not import vendor providers', !/openai-provider|gemini-provider|claude-provider|perplexity-provider/.test(route));
assert('service uses createAsiEngine', service.includes('createAsiEngine'));
assert('live engine uses query plan', liveEngine.includes('runAsiQueryPlan'));
assert('live evidence does not call mock loadEvidence', !liveEngine.includes('mockAsiEngine.loadEvidence'));
assert('live evidence starts from empty live base', liveEngine.includes('buildEmptyLiveEvidenceSnapshot'));
assert('live engine uses perception runner', liveEngine.includes('runAsiPerception'));
assert('live engine uses opportunity runner', liveEngine.includes('runAsiOpportunity'));
assert('live engine does not import audit live-check-score', !liveEngine.includes('live-check-score'));
assert('live engine does not import full-audit-engine', !liveEngine.includes('full-audit-engine'));
assert('factory maps chatgpt→OpenAI', createProviders.includes('createOpenAiAsiProvider'));
assert('factory maps gemini→Gemini', createProviders.includes('createGeminiAsiProvider'));
assert('factory maps perplexity→Perplexity', createProviders.includes('createPerplexityAsiProvider'));
assert('factory maps claude→Anthropic', createProviders.includes('createClaudeAsiProvider'));
assert('ASI ignores live-check MOCK_* flags', resolveMode.includes('Those MOCK_* flags must not block'));
assert('gemini reads GOOGLE_AI_API_KEY alias', resolveMode.includes('GOOGLE_AI_API_KEY'));
assert('perplexity reads PPLX_API_KEY alias', resolveMode.includes('PPLX_API_KEY'));
assert('example says MOCK_* is live-check only', example.includes('These do NOT affect AI Search Intelligence'));
assert('service factory is the API entry', typeof createAsiService().loadOpportunity === 'function');

const clientFiles = walk(resolve(process.cwd(), 'components/ai-search-intelligence'));
const clientSrc = clientFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
assert(
	'browser components do not import provider HTTP',
	!/ai-search-intelligence\/providers\/(openai-provider|gemini-provider|claude-provider|perplexity-provider|http|live-query|create-providers)/.test(
		clientSrc,
	),
);
assert('browser components do not call api.openai.com', !clientSrc.includes('api.openai.com'));
assert('browser components do not call api.anthropic.com', !clientSrc.includes('api.anthropic.com'));
assert('browser components do not call api.perplexity.ai', !clientSrc.includes('api.perplexity.ai'));

const KEYS = [
	'ASI_MODE',
	'OPENAI_API_KEY',
	'GEMINI_API_KEY',
	'GOOGLE_GENERATIVE_AI_API_KEY',
	'GOOGLE_API_KEY',
	'GOOGLE_AI_API_KEY',
	'PERPLEXITY_API_KEY',
	'PPLX_API_KEY',
	'ANTHROPIC_API_KEY',
	'MOCK_OPENAI',
	'MOCK_GEMINI',
	'MOCK_PERPLEXITY',
	'MOCK_CLAUDE',
] as const;

void (async () => {
	await withEnv(
		{
			...Object.fromEntries(KEYS.map((name) => [name, undefined])),
			OPENAI_API_KEY: 'asi-step1-auto-live',
		},
		async () => {
			assert('unset ASI_MODE with a key resolves to live', resolveAsiMode() === 'live');
			assert('hasAnyAsiProviderKey is true when OpenAI is set', hasAnyAsiProviderKey() === true);
		},
	);

	await withEnv(
		{
			...Object.fromEntries(KEYS.map((name) => [name, undefined])),
		},
		async () => {
			assert('unset ASI_MODE without keys stays mock', resolveAsiMode() === 'mock');
		},
	);

	await withEnv(
		{
			...Object.fromEntries(KEYS.map((name) => [name, undefined])),
			ASI_MODE: 'live',
			OPENAI_API_KEY: 'asi-step14-test-key',
			MOCK_OPENAI: 'true',
			MOCK_GEMINI: 'true',
			MOCK_PERPLEXITY: 'true',
			MOCK_CLAUDE: 'true',
		},
		async () => {
			assert('ASI_MODE live', resolveAsiMode() === 'live');
			assert('MOCK_OPENAI=true does not hide OpenAI key from ASI', hasAsiProviderKey('chatgpt') === true);
			assert('MOCK_GEMINI=true does not invent a Gemini key', hasAsiProviderKey('gemini') === false);

			const providers = createAsiProviders();
			assert('live factory still returns 4 adapters', providers.length === 4);
			assert('live factory does not use mock names', providers.every((item) => item.name !== 'Mock'));

			const urls: string[] = [];
			const originalFetch = globalThis.fetch;
			globalThis.fetch = (async (input: RequestInfo | URL) => {
				const url = String(input);
				urls.push(url);
				return new Response(
					JSON.stringify({
						choices: [
							{
								message: {
									content: JSON.stringify({
										answer: 'Sunshine를 추천합니다.',
										mentions: ['Sunshine'],
										recommendations: ['Sunshine'],
										citations: [],
									}),
								},
							},
						],
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } },
				);
			}) as typeof fetch;

			try {
				const response = await createOpenAiAsiProvider().query({
					query: `STEP14 connection ${Date.now()}`,
					url: 'https://sunshineclinic.kr',
					brand: 'Sunshine',
					location: '대구',
					category: '흉터 치료',
				});
				assert('OpenAI adapter called api.openai.com', urls.some((item) => item.includes('api.openai.com')));
				assert('live OpenAI answer is not mock-empty', response.source === 'live' && response.answer.includes('Sunshine'));
				assert('live OpenAI is not fallback', response.meta?.fallback === false);
				assert('Gemini/Perplexity/Anthropic were not called without keys', urls.every((item) => item.includes('api.openai.com')));
			} finally {
				globalThis.fetch = originalFetch;
			}

			const adapters = createAsiLiveAdapters();
			assert('live adapters stay the four vendors', adapters.map((item) => item.id).join() === 'chatgpt,gemini,perplexity,claude');
		},
	);

	await withEnv(
		{
			...Object.fromEntries(KEYS.map((name) => [name, undefined])),
			ASI_MODE: 'mock',
			OPENAI_API_KEY: 'asi-step14-test-key',
		},
		async () => {
			const urls: string[] = [];
			const originalFetch = globalThis.fetch;
			globalThis.fetch = (async (input: RequestInfo | URL) => {
				urls.push(String(input));
				return new Response('{}', { status: 500 });
			}) as typeof fetch;
			try {
				const engine = createAsiEngine();
				const perception = await engine.loadPerception({ url: 'https://sunshineclinic.kr' });
				assert('mock mode perception still builds', Boolean(perception?.axes));
				assert('mock mode does not hit vendor HTTP', urls.length === 0);
			} finally {
				globalThis.fetch = originalFetch;
			}
		},
	);

	if (failed) {
		console.error(`\n${failed} failed`);
		process.exit(1);
	}
	console.log('\nall passed');
})();
