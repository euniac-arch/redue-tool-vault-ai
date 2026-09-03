/**
 * Per-provider health: missing key is a config error; a present key is pinged (not skipped).
 * Run: npx tsx scripts/test-intelligence-providers-health.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createAsiLiveAdapters } from '../lib/ai-search-intelligence/providers/create-providers';
import { createOpenAiAsiProvider } from '../lib/ai-search-intelligence/providers/openai-provider';
import { hasAsiProviderKey, readAsiProviderKey } from '../lib/ai-search-intelligence/providers/resolve-mode';
import { ASI_ENGINES } from '../lib/ai-search-intelligence/types';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const KEY_NAMES = [
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
	'ASI_MODE',
] as const;

function loadDotEnv() {
	const path = resolve(process.cwd(), '.env');
	if (!existsSync(path)) return;
	for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq < 1) continue;
		const name = trimmed.slice(0, eq).trim();
		if (!name || process.env[name]) continue;
		process.env[name] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
	}
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

function clearLiveKeys(): Record<string, string | undefined> {
	return Object.fromEntries(KEY_NAMES.map((name) => [name, undefined]));
}

loadDotEnv();

void (async () => {
	await withEnv({ ...clearLiveKeys(), ASI_MODE: 'live' }, async () => {
		const adapters = createAsiLiveAdapters();
		assert('live adapters are 4', adapters.length === 4);
		for (const adapter of adapters) {
			const health = await adapter.healthCheck();
			assert(`${adapter.id} health without key is missing_key`, health.code === 'missing_key' && !health.ok);
			assert(`${adapter.id} missing-key error is actionable`, health.error === 'API Key missing or provider unavailable');
			assert(`${adapter.id} isAvailable is false without key`, adapter.isAvailable() === false);
		}

		const liveRes = await createOpenAiAsiProvider().query({
			query: 'health missing key',
			url: 'https://sunshineclinic.kr',
			brand: 'Sunshine',
		});
		assert('live mode missing key is not silent mock', liveRes.source === 'live' && liveRes.meta?.fallback === false);
		assert('live mode missing key has empty answer', liveRes.answer === '');
		assert('live mode missing key uses actionable error', liveRes.meta?.error === 'API Key missing or provider unavailable');
		assert('live mode missing key is unavailable', liveRes.meta?.unavailable === true);
		assert('live mode missing key keeps code', liveRes.meta?.code === 'missing_key');
		assert('live meta mode/provider', liveRes.meta?.mode === 'live' && liveRes.meta?.provider === 'openai');
	});

	await withEnv({ ...clearLiveKeys(), ASI_MODE: 'hybrid' }, async () => {
		const hybrid = await createOpenAiAsiProvider().query({
			query: 'health hybrid fallback',
			url: 'https://sunshineclinic.kr',
			brand: 'Sunshine',
		});
		assert('hybrid missing key uses fallback source', hybrid.source === 'fallback');
		assert('hybrid missing key sets fallback true', hybrid.meta?.fallback === true);
		assert('hybrid missing key does not invent mock answer', hybrid.answer === '');
		assert('hybrid missing key is unavailable', hybrid.meta?.unavailable === true);
		assert('hybrid missing key still reports error', hybrid.meta?.error === 'missing_key');
		assert('hybrid meta mode is hybrid', hybrid.meta?.mode === 'hybrid' && hybrid.meta?.provider === 'openai');
	});

	const pingEnv: Record<string, string | undefined> = {
		MOCK_OPENAI: 'false',
		MOCK_GEMINI: 'false',
		MOCK_PERPLEXITY: 'false',
		MOCK_CLAUDE: 'false',
		ASI_MODE: 'live',
	};

	await withEnv(pingEnv, async () => {
		const adapters = createAsiLiveAdapters();
		assert('factory ids stay ASI_ENGINES', adapters.map((item) => item.id).join() === ASI_ENGINES.join());

		for (const adapter of adapters) {
			const configured = hasAsiProviderKey(adapter.id) && Boolean(readAsiProviderKey(adapter.id));
			const health = await adapter.healthCheck();
			if (!configured) {
				assert(`${adapter.id} ping path reports missing_key`, health.code === 'missing_key' && !health.ok);
				console.log(`    ${adapter.id} (${adapter.name}): not configured`);
				continue;
			}
			assert(`${adapter.id} live health attempted`, health.code !== 'missing_key' && health.code !== 'blocked');
			assert(`${adapter.id} live health ok`, health.ok === true, health.code);
			console.log(`    ${adapter.id} (${adapter.name}): connected`);
		}
	});

	if (failed) {
		console.error(`\n${failed} failed`);
		process.exit(1);
	}
	console.log('\nall passed');
})();
