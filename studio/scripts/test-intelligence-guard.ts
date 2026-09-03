/**
 * Cost / rate-limit guard: cap, retry, cache, cancel, metrics. Never logs keys.
 * Run: npx tsx scripts/test-intelligence-guard.ts
 */
import { AsiServiceError } from '../lib/ai-search-intelligence/api/errors';
import { createAsiRequestId, logAsiRequest, redactAsiSecrets } from '../lib/ai-search-intelligence/api/log';
import { capAsiQueries, chunkAsiBatch, runAsiBatches } from '../lib/ai-search-intelligence/guard/batch';
import { abortAsiRun, beginAsiRun } from '../lib/ai-search-intelligence/guard/cancel';
import { asiQueryCacheKey, readAsiQueryCache, writeAsiQueryCache } from '../lib/ai-search-intelligence/guard/cache';
import { runWithAsiRequestContext, throwIfAsiAborted } from '../lib/ai-search-intelligence/guard/context';
import { guardAsiProviderCall } from '../lib/ai-search-intelligence/guard/execute';
import { clearAsiGuardState } from '../lib/ai-search-intelligence/guard/index';
import { ASI_GUARD, asiBackoffMs } from '../lib/ai-search-intelligence/guard/limits';
import { readAsiUsageReport, recordAsiHttpRequest, recordAsiUsage } from '../lib/ai-search-intelligence/guard/metrics';
import { consumeAsiHttpRateLimit, takeAsiRateLimit } from '../lib/ai-search-intelligence/guard/rate-limit';
import { asiShouldRetry, withAsiRetry } from '../lib/ai-search-intelligence/guard/retry';
import type { AIResponse } from '../lib/ai-search-intelligence/types';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function liveAnswer(partial: Partial<AIResponse> = {}): AIResponse {
	return {
		provider: 'chatgpt',
		query: '대구 피부과 추천',
		answer: '선샤인클리닉을 추천합니다.',
		mentions: ['선샤인클리닉'],
		recommendations: ['선샤인클리닉'],
		citations: [],
		confidence: 0.7,
		timestamp: '2026-08-30T00:00:00.000Z',
		source: 'live',
		meta: { mode: 'live', provider: 'openai', engine: 'chatgpt', fallback: false },
		...partial,
	};
}

clearAsiGuardState();

assert('request id prefix', createAsiRequestId().startsWith('asi_'));
assert('batch size is 10', ASI_GUARD.batchSize === 10);
assert('query concurrency is 5', ASI_GUARD.queryConcurrency === 5);
assert('max queries is 10', ASI_GUARD.maxQueriesPerRequest === 10);
assert('max retries is 1', ASI_GUARD.maxRetries === 1);
assert('backoff grows', asiBackoffMs(0) === 400 && asiBackoffMs(1) === 800 && asiBackoffMs(8) === ASI_GUARD.backoffMaxMs);
assert('provider timeouts differ', ASI_GUARD.providerTimeoutMs.perplexity > ASI_GUARD.providerTimeoutMs.chatgpt);
assert('cap queries', capAsiQueries(Array.from({ length: 25 }, (_, i) => `q${i}`)).length === 10);
assert('chunk 12 → 10 + 2', chunkAsiBatch(Array.from({ length: 12 }, (_, i) => i)).map((row) => row.length).join(',') === '10,2');

assert('no retry on rate_limit', asiShouldRetry(new AsiServiceError('rate_limit')) === false);
assert('no retry on cancelled', asiShouldRetry(new AsiServiceError('cancelled')) === false);
assert('retry network', asiShouldRetry(new AsiServiceError('network_error')) === true);

void (async () => {
	let tries = 0;
	const slept: number[] = [];
	const ok = await withAsiRetry(
		async () => {
			tries += 1;
			if (tries === 1) throw new AsiServiceError('network_error');
			return 'done';
		},
		{ sleep: async (ms) => { slept.push(ms); } },
	);
	assert('retry then success', ok === 'done' && tries === 2);
	assert('exponential backoff used', slept[0] === 400);

	let rateTries = 0;
	try {
		await withAsiRetry(async () => {
			rateTries += 1;
			throw new AsiServiceError('rate_limit');
		}, { sleep: async () => undefined });
		assert('rate_limit must throw', false);
	} catch (error) {
		assert('rate_limit not retried', error instanceof AsiServiceError && error.code === 'rate_limit' && rateTries === 1);
	}

	const first = takeAsiRateLimit('t', 2, 60_000, 1_000);
	const second = takeAsiRateLimit('t', 2, 60_000, 1_100);
	const third = takeAsiRateLimit('t', 2, 60_000, 1_200);
	assert('rate window allows 2', first.ok && second.ok && !third.ok);

	try {
		for (let i = 0; i < ASI_GUARD.httpPerMinute + 1; i += 1) consumeAsiHttpRateLimit('burst', 10_000 + i);
		assert('http burst blocked', false);
	} catch (error) {
		assert('http over limit is rate_limit', error instanceof AsiServiceError && error.code === 'rate_limit');
	}

	let calls = 0;
	const made = await guardAsiProviderCall({
		provider: 'chatgpt',
		query: '대구 피부과 추천',
		url: 'https://sunshineclinic.kr',
		live: true,
		run: async () => {
			calls += 1;
			return liveAnswer();
		},
	});
	const cached = await guardAsiProviderCall({
		provider: 'chatgpt',
		query: '대구 피부과 추천',
		url: 'https://sunshineclinic.kr',
		live: true,
		run: async () => {
			calls += 1;
			return liveAnswer({ answer: 'should not run' });
		},
	});
	assert('duplicate query uses cache', calls === 1 && cached.meta?.cacheHit === true && cached.answer === made.answer);

	const key = asiQueryCacheKey('gemini', 'https://x.test', '동일 질문');
	writeAsiQueryCache(key, liveAnswer({ provider: 'gemini', query: '동일 질문' }));
	assert('cache read hit', readAsiQueryCache(key)?.provider === 'gemini');

	const controller = beginAsiRun('asi_cancel_test');
	abortAsiRun('asi_cancel_test', 'cancelled');
	assert('cancel aborts run', controller.signal.aborted === true);
	try {
		throwIfAsiAborted(controller.signal);
		assert('aborted throw', false);
	} catch (error) {
		assert('cancel code', error instanceof AsiServiceError && error.code === 'cancelled');
	}

	const rows = await runAsiBatches(
		['a', 'b', 'c'],
		async (item) => item,
		{ size: 2 },
	);
	assert('batches preserve result order', rows.join('') === 'abc');
	const started: number[] = [];
	await runAsiBatches(
		[30, 30, 30],
		async () => {
			started.push(Date.now());
			await new Promise((resolve) => setTimeout(resolve, 50));
		},
		{ concurrency: 3 },
	);
	assert('batch items overlap', started.length === 3 && started[2] - started[0] < 40);

	const cancelledRun = beginAsiRun('asi_batch_cancel');
	abortAsiRun('asi_batch_cancel', 'cancelled');
	try {
		await runWithAsiRequestContext({ requestId: 'asi_batch_cancel', clientKey: 't', signal: cancelledRun.signal }, () =>
			runAsiBatches(['x', 'y'], async (item) => item, { signal: cancelledRun.signal }),
		);
		assert('cancelled batch must throw', false);
	} catch (error) {
		assert('batch respects cancel', error instanceof AsiServiceError && error.code === 'cancelled');
	}

	clearAsiGuardState();
	recordAsiHttpRequest();
	recordAsiUsage({ provider: 'chatgpt', ok: true, ms: 120 });
	recordAsiUsage({ provider: 'gemini', ok: false, ms: 80, error: 'provider_timeout', timeout: true });
	recordAsiUsage({ provider: 'chatgpt', ok: true, ms: 0, cacheHit: true });
	const usage = readAsiUsageReport();
	assert('usage date is utc', /^\d{4}-\d{2}-\d{2}$/.test(usage.date));
	assert('usage requests', usage.requests === 1);
	assert('usage provider calls', usage.providerCalls === 2);
	assert('usage cache hits', usage.cacheHits === 1);
	assert('usage failure rate', usage.failureRate === 0.5);
	assert('usage avg ms', usage.avgMs === 100);
	assert('provider error is code only', usage.byProvider.gemini.lastError === 'provider_timeout');
	const serialized = JSON.stringify(usage);
	assert('usage has no api key field', !serialized.toLowerCase().includes('key') && !serialized.includes('sk-'));

	const leaked = redactAsiSecrets('Authorization: Bearer sk-proj-SECRET key=abc123');
	assert('log redacts bearer and key', leaked.includes('[redacted]') && !leaked.includes('sk-proj-SECRET') && !leaked.includes('abc123'));
	const logs: string[] = [];
	const original = console.info;
	console.info = (line: string) => {
		logs.push(String(line));
	};
	logAsiRequest('asi_log', 'info', { apiKey: 'sk-proj-SHOULD-NOT', token: 'secret-token', queryCount: 2 });
	console.info = original;
	assert('request log keeps requestId', logs[0]?.includes('asi_log'));
	assert('request log redacts apiKey', Boolean(logs[0]?.includes('[redacted]') && !logs[0]?.includes('SHOULD-NOT')));

	if (failed) {
		console.error(`\n${failed} failed`);
		process.exit(1);
	}
	console.log('\nall passed');
})();
