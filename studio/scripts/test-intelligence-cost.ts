/**
 * STEP 11 — cost defenses: concurrency, monthly usage, safe errors, no public keys.
 * Run: npx tsx scripts/test-intelligence-cost.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AsiServiceError, asiSafeErrorMessage } from '../lib/ai-search-intelligence/api/errors';
import { actorFromTier } from '../lib/ai-search-intelligence/entitlement/actor-model';
import {
	assertAsiMonthlyBudget,
	clearAsiAccountUsage,
	readAsiAccountUsage,
	recordAsiAccountProviderCall,
	recordAsiAccountQueries,
} from '../lib/ai-search-intelligence/guard/account-usage';
import { acquireAsiConcurrency, clearAsiConcurrency, readAsiConcurrency, releaseAsiConcurrency } from '../lib/ai-search-intelligence/guard/concurrency';
import { ASI_GUARD } from '../lib/ai-search-intelligence/guard/limits';
import { errorAsiResponse } from '../lib/ai-search-intelligence/providers/live-query';

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

assert('query cap exists', ASI_GUARD.maxQueriesPerRequest === 10);
assert('retry limit exists', ASI_GUARD.maxRetries === 1);
assert('timeout exists', ASI_GUARD.requestTimeoutMs === 45_000);
assert('cache ttl exists', ASI_GUARD.cacheTtlMs > 0);
assert('backoff exists', ASI_GUARD.backoffBaseMs > 0 && ASI_GUARD.backoffMaxMs > ASI_GUARD.backoffBaseMs);
assert('concurrent user cap exists', ASI_GUARD.maxConcurrentPerUser === 2);
assert('concurrent global cap exists', ASI_GUARD.maxConcurrentGlobal === 8);

clearAsiConcurrency();
acquireAsiConcurrency('user:a');
acquireAsiConcurrency('user:a');
try {
	acquireAsiConcurrency('user:a');
	assert('third concurrent must throw', false);
} catch (error) {
	assert('concurrent over cap is rate_limit', error instanceof AsiServiceError && error.code === 'rate_limit');
}
releaseAsiConcurrency('user:a');
releaseAsiConcurrency('user:a');
assert('concurrency released', readAsiConcurrency('user:a').user === 0 && readAsiConcurrency('user:a').global === 0);

clearAsiAccountUsage();
const guest = actorFromTier('guest');
const usage0 = readAsiAccountUsage('guest:local', guest.limits);
assert('account usage starts at 0', usage0.queriesUsed === 0 && usage0.providerCalls === 0);
assert('account usage is estimated', usage0.estimated === true && usage0.estimatedUsage === 0);
assert('guest monthly query cap', usage0.queriesLimit === 10);
recordAsiAccountQueries('guest:local', 10);
recordAsiAccountProviderCall('guest:local');
const usage1 = readAsiAccountUsage('guest:local', guest.limits);
assert('queries used increment', usage1.queriesUsed === 10);
assert('estimated usage tracks provider calls', usage1.estimatedUsage === 1 && usage1.estimated === true);
try {
	assertAsiMonthlyBudget('guest:local', guest.limits, 1);
	assert('over monthly queries must throw', false);
} catch (error) {
	assert('monthly query overflow is entitlement_quota', error instanceof AsiServiceError && error.code === 'entitlement_quota');
}

const safeKo = asiSafeErrorMessage('unavailable', 'ko');
assert('user error has no OpenAI prefix', !safeKo.includes('OpenAI') && !safeKo.includes('Error:'));
assert('user error is the retry copy', safeKo.includes('AI 분석을 완료하지 못했습니다'));

const leaked = errorAsiResponse(
	'chatgpt',
	{ query: 'q', url: 'https://x.test', brand: 'X' },
	'OpenAI Error: incorrect api key',
	'OpenAI Error: incorrect api key',
);
assert('snapshot error is a code, not vendor text', leaked.meta?.error === 'unavailable');
assert('snapshot code is a code', leaked.meta?.code === 'unavailable');

const answer = read('components/ai-search-intelligence/primitives/AsiAnswerResult.tsx');
assert('answer result does not print raw error', answer.includes("tUx('analyzeFailed')") && !answer.includes('{error}</p>'));

const example = read('.env.example');
assert('no NEXT_PUBLIC LLM keys in example', !/NEXT_PUBLIC_(OPENAI|GEMINI|PERPLEXITY|ANTHROPIC)_API_KEY/.test(example));
const execute = read('lib/ai-search-intelligence/guard/execute.ts');
assert('live calls go through cache', execute.includes('readAsiQueryCache'));
assert('live calls go through cooldown', execute.includes('isAsiQueryCoolingDown'));
assert('live calls go through retry', execute.includes('withAsiRetry'));
assert('live calls go through provider rate limit', execute.includes('consumeAsiProviderRateLimit'));
const route = read('app/api/intelligence/route.ts');
assert('route logs requestId', route.includes('logAsiRequest(requestId'));
assert('route exposes accountUsage', route.includes('accountUsage'));
assert('route acquires concurrency', route.includes('acquireAsiConcurrency'));
assert('route checks monthly budget', route.includes('assertAsiMonthlyBudget'));
assert('route does not take remesasure from body', !/remeasure\s*:/.test(route) && route.includes('scheduler-only'));

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
