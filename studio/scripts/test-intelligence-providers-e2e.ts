/**
 * STEP 19-B — Real provider Query → Adapter → AI → Parser → Observation → persist.
 * Never prints API key values. Run from studio/: npx tsx scripts/test-intelligence-providers-e2e.ts
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { POST } from '../app/api/intelligence/route';
import { toAIObservation } from '../lib/ai-search-intelligence/core/from-asi';
import { isAsiPersistEnabled } from '../lib/ai-search-intelligence/persist/enabled';
import { clearAsiPersistedHistory, readPersistedResponses } from '../lib/ai-search-intelligence/persist/repository';
import { queryAsiProviders } from '../lib/ai-search-intelligence/providers/compose';
import { createAsiLiveAdapters, createAsiProviders } from '../lib/ai-search-intelligence/providers/create-providers';
import { extractJsonObject, parseProviderAnswer } from '../lib/ai-search-intelligence/providers/normalize';
import {
	hasAsiProviderKey,
	readAsiProviderKey,
	resolveAsiMode,
} from '../lib/ai-search-intelligence/providers/resolve-mode';
import { runAsiQueryPlan } from '../lib/ai-search-intelligence/providers/query-plan';
import { ASI_ENGINES, type AIResponse, type AsiEngineId } from '../lib/ai-search-intelligence/types';

const SITE = {
	url: 'https://sunshineclinic.kr',
	brand: 'Sunshine',
	domain: 'sunshineclinic.kr',
	location: '대구',
	category: '피부과',
};

const QUERY = '대구 피부과 추천';
const PUBLIC_KEY_ENV = /NEXT_PUBLIC_(OPENAI|GEMINI|PERPLEXITY|ANTHROPIC|ASI)_API_KEY/;
const SECRET_SHAPE = /\b(sk-[a-zA-Z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|pplx-[a-zA-Z0-9_-]{12,}|sk-ant-[a-zA-Z0-9_-]{12,})\b/;

type Verdict = 'CONNECTED' | 'PARTIAL' | 'MOCK' | 'FAILED';

type ProviderReport = {
	id: AsiEngineId;
	vendor: string;
	keyPresent: boolean;
	keyLength: number;
	configuredMode: string;
	healthOk: boolean;
	healthCode: string;
	healthClass: string;
	source: string;
	error: string | null;
	errorClass: string;
	answerChars: number;
	parsedJson: boolean;
	mentions: number;
	recommendations: number;
	citations: number;
	citationHosts: string[];
	observationOk: boolean;
	httpHost: string | null;
	verdict: Verdict;
};

function loadDotEnvFile(path: string) {
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

function loadDotEnv() {
	const studio = resolve(process.cwd());
	const root = resolve(process.cwd(), '..');
	loadDotEnvFile(join(studio, '.env'));
	loadDotEnvFile(join(studio, '.env.local'));
	loadDotEnvFile(join(root, '.env'));
}

function walk(dir: string, out: string[] = []): string[] {
	if (!existsSync(dir)) return out;
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (/\.(ts|tsx|js|jsx)$/.test(name)) out.push(full);
	}
	return out;
}

function classifyError(code: string | null | undefined): string {
	const raw = (code || '').toLowerCase();
	if (!raw) return 'none';
	if (raw === 'missing_key' || raw === 'api_key') return 'invalid_key';
	if (raw === 'provider_timeout' || raw.includes('timeout')) return 'timeout';
	if (raw === 'rate_limit' || raw.includes('429')) return 'rate_limit';
	if (raw === 'invalid_response' || raw === 'empty') return 'malformed_response';
	if (raw === 'network_error') return 'network_error';
	if (raw === 'blocked' || raw === 'unavailable' || raw === 'http_error') return 'provider_error';
	return 'provider_error';
}

function hostOf(url: string): string | null {
	if (url.includes('api.openai.com')) return 'api.openai.com';
	if (url.includes('generativelanguage.googleapis.com')) return 'generativelanguage.googleapis.com';
	if (url.includes('api.perplexity.ai')) return 'api.perplexity.ai';
	if (url.includes('api.anthropic.com')) return 'api.anthropic.com';
	return null;
}

function redactSample(text: string): string {
	const cleaned = text.replace(SECRET_SHAPE, '[redacted]').replace(/\s+/g, ' ').trim();
	return cleaned.slice(0, 120);
}

function verdictFor(input: {
	mode: string;
	source: string;
	error: string | null;
	answerChars: number;
	parsedJson: boolean;
	healthOk: boolean;
}): Verdict {
	if (input.mode === 'mock' || input.source === 'mock') return 'MOCK';
	if (input.source === 'fallback') return 'PARTIAL';
	if (input.error) return 'FAILED';
	if (input.source === 'live' && input.answerChars > 0 && input.healthOk) {
		return input.parsedJson ? 'CONNECTED' : 'PARTIAL';
	}
	if (input.source === 'live' && input.answerChars > 0) return 'PARTIAL';
	return 'FAILED';
}

function envFlag(name: string): string {
	const value = (process.env[name] || '').trim();
	return value ? value : '(unset)';
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

loadDotEnv();

const configuredMode = resolveAsiMode();
const configuredKeys = Object.fromEntries(
	ASI_ENGINES.map((id) => {
		const present = hasAsiProviderKey(id);
		return [id, { present, length: present ? readAsiProviderKey(id).length : 0 }];
	}),
);

console.log('========== STEP 19-B configured runtime ==========');
console.log(`ASI_MODE raw=${envFlag('ASI_MODE')} resolved=${configuredMode}`);
console.log(`ASI_PERSIST raw=${envFlag('ASI_PERSIST')} persistEnabled=${isAsiPersistEnabled()}`);
console.log(`MOCK_OPENAI=${envFlag('MOCK_OPENAI')} MOCK_GEMINI=${envFlag('MOCK_GEMINI')} MOCK_PERPLEXITY=${envFlag('MOCK_PERPLEXITY')} MOCK_CLAUDE=${envFlag('MOCK_CLAUDE')}`);
for (const id of ASI_ENGINES) {
	const row = configuredKeys[id];
	console.log(`key ${id}: present=${row.present} length=${row.length}`);
}
console.log(
	`NEXT_PUBLIC LLM keys in process: ${
		['NEXT_PUBLIC_OPENAI_API_KEY', 'NEXT_PUBLIC_GEMINI_API_KEY', 'NEXT_PUBLIC_PERPLEXITY_API_KEY', 'NEXT_PUBLIC_ANTHROPIC_API_KEY']
			.filter((name) => Boolean((process.env[name] || '').trim()))
			.join(',') || 'none'
	}`,
);

const clientFiles = walk(resolve(process.cwd(), 'components/ai-search-intelligence'));
const clientSrc = clientFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
console.log(`client NEXT_PUBLIC LLM key: ${PUBLIC_KEY_ENV.test(clientSrc) ? 'LEAK' : 'none'}`);
console.log(`client vendor HTTP host: ${/api\.openai\.com|api\.anthropic\.com|api\.perplexity\.ai|generativelanguage\.googleapis\.com/.test(clientSrc) ? 'LEAK' : 'none'}`);

void (async () => {
	const reports: ProviderReport[] = [];
	const httpHosts: Record<AsiEngineId, string | null> = {
		chatgpt: null,
		gemini: null,
		perplexity: null,
		claude: null,
	};

	await withEnv({ ASI_MODE: 'live' }, async () => {
		console.log('\n========== forced ASI_MODE=live E2E ==========');
		console.log(`resolved mode=${resolveAsiMode()} persistEnabled=${isAsiPersistEnabled()}`);

		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			const host = hostOf(url);
			if (host) {
				if (url.includes('api.openai.com')) httpHosts.chatgpt = host;
				if (url.includes('generativelanguage.googleapis.com')) httpHosts.gemini = host;
				if (url.includes('api.perplexity.ai')) httpHosts.perplexity = host;
				if (url.includes('api.anthropic.com')) httpHosts.claude = host;
			}
			if (SECRET_SHAPE.test(url)) {
				console.error('SECURITY url contained secret-shaped token');
			}
			return originalFetch(input, init);
		}) as typeof fetch;

		try {
			const adapters = createAsiLiveAdapters();
			const factory = createAsiProviders();
			console.log(`factory count=${factory.length} liveAdapters=${adapters.map((item) => item.id).join(',')}`);
			console.log(`factory uses mock names=${factory.some((item) => item.name === 'Mock')}`);

			const healthById = new Map<AsiEngineId, Awaited<ReturnType<(typeof adapters)[number]['healthCheck']>>>();
			for (const adapter of adapters) {
				const health = await adapter.healthCheck();
				healthById.set(adapter.id, health);
				console.log(
					`health ${adapter.id}/${adapter.name}: ok=${health.ok} code=${health.code} class=${classifyError(health.code)} available=${health.available}`,
				);
			}

			clearAsiPersistedHistory(SITE.domain);
			const started = Date.now();
			const responses = await queryAsiProviders({
				query: QUERY,
				url: SITE.url,
				brand: SITE.brand,
				location: SITE.location,
				category: SITE.category,
			});
			console.log(`queryAsiProviders ms=${Date.now() - started} rows=${responses.length}`);

			for (const adapter of adapters) {
				const response = responses.find((item) => item.provider === adapter.id);
				const health = healthById.get(adapter.id);
				const parsed = parseProviderAnswer(response?.answer || '');
				const json = extractJsonObject(response?.answer || '');
				const observation = response
					? toAIObservation(response, { brand: SITE.brand, aliases: [SITE.brand, 'sunshine'] })
					: null;
				const error = response?.meta?.error || null;
				const source = response?.source || 'none';
				const report: ProviderReport = {
					id: adapter.id,
					vendor: adapter.name,
					keyPresent: hasAsiProviderKey(adapter.id),
					keyLength: hasAsiProviderKey(adapter.id) ? readAsiProviderKey(adapter.id).length : 0,
					configuredMode: resolveAsiMode(),
					healthOk: Boolean(health?.ok),
					healthCode: health?.code || 'missing',
					healthClass: classifyError(health?.code),
					source,
					error,
					errorClass: classifyError(error),
					answerChars: (response?.answer || '').length,
					parsedJson: Boolean(json && typeof json.answer === 'string'),
					mentions: parsed.mentions.length,
					recommendations: parsed.recommendations.length,
					citations: parsed.citations.length,
					citationHosts: parsed.citations.map((item) => item.source).slice(0, 5),
					observationOk: Boolean(
						observation &&
							observation.answer.provenance === 'observed' &&
							typeof observation.brandMention.value === 'boolean',
					),
					httpHost: httpHosts[adapter.id],
					verdict: verdictFor({
						mode: resolveAsiMode(),
						source,
						error,
						answerChars: (response?.answer || '').length,
						parsedJson: Boolean(json && typeof json.answer === 'string'),
						healthOk: Boolean(health?.ok),
					}),
				};
				reports.push(report);
				console.log(`--- ${adapter.id} (${adapter.name}) ---`);
				console.log(
					`verdict=${report.verdict} source=${report.source} http=${report.httpHost || 'none'} error=${report.error || 'none'} class=${report.errorClass}`,
				);
				console.log(
					`answerChars=${report.answerChars} json=${report.parsedJson} mentions=${report.mentions} recs=${report.recommendations} citations=${report.citations} observation=${report.observationOk}`,
				);
				if (report.citationHosts.length) console.log(`citationHosts=${report.citationHosts.join(',')}`);
				if (response?.answer) console.log(`answerSample=${redactSample(response.answer)}`);
				if (observation) {
					console.log(
						`observation keys=${Object.keys(observation).join(',')} brandMention=${observation.brandMention.value} recommended=${observation.recommendation.value} confidence=${observation.confidence.value}`,
					);
				}
			}

			const plan = await runAsiQueryPlan({
				queries: [QUERY],
				url: SITE.url,
				brand: SITE.brand,
				domain: SITE.domain,
				location: SITE.location,
				category: SITE.category,
				limit: 1,
			});
			const persisted = readPersistedResponses(SITE.domain);
			console.log('\n========== query plan + persist ==========');
			console.log(
				`planRows=${plan.length} cacheHit=${plan[0]?.cacheHit ?? false} available=${(plan[0]?.available || []).join(',') || 'none'} unavailable=${(plan[0]?.unavailable || []).map((item) => `${item.provider}:${item.error}`).join(',') || 'none'}`,
			);
			console.log(`persistEnabled=${isAsiPersistEnabled()} persistedResponses=${persisted.length} prismaAsiTable=none file=.data/asi/${SITE.domain}/observation.json`);

			const isolation = await withEnv({ GEMINI_API_KEY: undefined, GOOGLE_GENERATIVE_AI_API_KEY: undefined, GOOGLE_API_KEY: undefined, GOOGLE_AI_API_KEY: undefined }, async () => {
				const rows = await queryAsiProviders({
					query: QUERY,
					url: SITE.url,
					brand: SITE.brand,
					location: SITE.location,
					category: SITE.category,
				});
				return {
					count: rows.length,
					geminiError: rows.find((item) => item.provider === 'gemini')?.meta?.error || null,
					othersLive: rows.filter((item) => item.provider !== 'gemini' && item.source === 'live' && !item.meta?.error).length,
					batchOk: rows.length === 4,
				};
			});
			console.log('\n========== isolation ==========');
			console.log(
				`batchCount=${isolation.count} batchOk=${isolation.batchOk} geminiWithoutKey=${isolation.geminiError} othersStillLive=${isolation.othersLive}`,
			);

			const apiRes = await POST(
				new Request('http://localhost/api/intelligence', {
					method: 'POST',
					headers: { 'content-type': 'application/json', 'accept-language': 'ko' },
					body: JSON.stringify({
						operation: 'brand-perception',
						url: SITE.url,
						query: QUERY,
					}),
				}),
			);
			const apiBody = (await apiRes.json()) as {
				success?: boolean;
				data?: { snapshot?: { source?: string; axes?: unknown[] } };
				error?: { code?: string; message?: string };
				meta?: { mode?: string; requestId?: string };
			};
			const apiText = JSON.stringify(apiBody);
			console.log('\n========== /api/intelligence brand-perception ==========');
			console.log(
				`status=${apiRes.status} success=${apiBody.success} mode=${apiBody.meta?.mode || 'n/a'} snapshotSource=${apiBody.data?.snapshot?.source || 'n/a'} error=${apiBody.error?.code || 'none'}`,
			);
			console.log(`envelopeLeaksSecret=${SECRET_SHAPE.test(apiText) || apiText.includes('API_KEY')}`);
			console.log(`snapshotHasAxes=${Array.isArray(apiBody.data?.snapshot?.axes)}`);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	console.log('\n========== configured mode (no ASI_MODE override) ==========');
	const mockPath = createAsiProviders();
	const mockSample = await mockPath[0].query({
		query: QUERY,
		url: SITE.url,
		brand: SITE.brand,
	});
	console.log(
		`resolved=${resolveAsiMode()} sampleSource=${mockSample.source} sampleFallback=${mockSample.meta?.fallback ?? false} sampleError=${mockSample.meta?.error || 'none'}`,
	);

	console.log('\n========== VERDICTS ==========');
	for (const row of reports) {
		console.log(`${row.id}\t${row.verdict}\tsource=${row.source}\terror=${row.error || 'none'}\tclass=${row.errorClass}`);
	}

	const mockRuntime = configuredMode === 'mock';
	console.log(`configuredRuntime=${mockRuntime ? 'MOCK' : configuredMode.toUpperCase()}`);
})();
