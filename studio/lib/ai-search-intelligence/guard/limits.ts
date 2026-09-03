import type { AsiEngineId } from '@/lib/ai-search-intelligence/types';

/** Hard caps so button-mashing cannot fan out paid provider calls. */
export const ASI_GUARD = {
	httpPerMinute: 30,
	providerPerMinute: 40,
	providerGlobalPerMinute: 120,
	providerPerDay: 200,
	maxRetries: 1,
	backoffBaseMs: 400,
	backoffMaxMs: 2_000,
	batchSize: 10,
	/** Parallel query slots inside a request. 5 waves 10 queries under the 45s guard. */
	queryConcurrency: 5,
	maxQueriesPerRequest: 10,
	maxConcurrentPerUser: 2,
	maxConcurrentGlobal: 8,
	cacheTtlMs: 10 * 60 * 1000,
	cooldownMs: 15_000,
	requestTimeoutMs: 45_000,
	providerTimeoutMs: {
		chatgpt: 18_000,
		gemini: 20_000,
		perplexity: 22_000,
		claude: 18_000,
	} satisfies Record<AsiEngineId, number>,
} as const;

export function asiProviderTimeoutMs(provider: AsiEngineId): number {
	return ASI_GUARD.providerTimeoutMs[provider];
}

export function asiBackoffMs(attempt: number): number {
	const exp = Math.max(0, attempt);
	return Math.min(ASI_GUARD.backoffMaxMs, ASI_GUARD.backoffBaseMs * 2 ** exp);
}
