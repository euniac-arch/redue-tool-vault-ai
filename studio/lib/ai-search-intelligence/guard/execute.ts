import { classifyAsiThrown } from '@/lib/ai-search-intelligence/api/errors';
import { getAsiRequestContext, runWithAsiCallContext, throwIfAsiAborted } from '@/lib/ai-search-intelligence/guard/context';
import { recordAsiAccountProviderCall } from '@/lib/ai-search-intelligence/guard/account-usage';
import { asiQueryCacheKey, isAsiQueryCoolingDown, markAsiQueryCooldown, readAsiQueryCache, writeAsiQueryCache } from '@/lib/ai-search-intelligence/guard/cache';
import { withAsiInflight } from '@/lib/ai-search-intelligence/guard/inflight';
import { asiProviderTimeoutMs } from '@/lib/ai-search-intelligence/guard/limits';
import { recordAsiUsage } from '@/lib/ai-search-intelligence/guard/metrics';
import { consumeAsiProviderRateLimit } from '@/lib/ai-search-intelligence/guard/rate-limit';
import { withAsiRetry } from '@/lib/ai-search-intelligence/guard/retry';
import { AsiServiceError } from '@/lib/ai-search-intelligence/api/errors';
import type { AIResponse, AsiEngineId } from '@/lib/ai-search-intelligence/types';

function usableLive(response: AIResponse): boolean {
	if (response.meta?.error || response.source === 'fallback') return false;
	return response.answer.trim().length > 0 || response.mentions.length > 0;
}

export async function guardAsiProviderCall(input: {
	provider: AsiEngineId;
	query: string;
	url: string;
	live: boolean;
	run: () => Promise<AIResponse>;
}): Promise<AIResponse> {
	const ctx = getAsiRequestContext();
	throwIfAsiAborted(ctx?.signal);
	const key = asiQueryCacheKey(input.provider, input.url, input.query);

	if (input.live) {
		const cached = readAsiQueryCache(key);
		if (cached) {
			recordAsiUsage({ provider: input.provider, ok: true, ms: 0, cacheHit: true });
			if (!cached.meta) return cached;
			return {
				...cached,
				meta: { ...cached.meta, cacheHit: true, retries: 0 },
			};
		}
		if (isAsiQueryCoolingDown(key)) {
			const stale = readAsiQueryCache(key, Date.now(), { allowStale: true });
			recordAsiUsage({ provider: input.provider, ok: Boolean(stale), ms: 0, skippedDuplicate: true, cacheHit: Boolean(stale) });
			if (stale) {
				return stale.meta ? { ...stale, meta: { ...stale.meta, cacheHit: true, retries: 0 } } : stale;
			}
			throw new AsiServiceError('rate_limit');
		}
		consumeAsiProviderRateLimit(ctx?.clientKey || 'local');
	}

	return withAsiInflight(key, async () => {
		const started = Date.now();
		let retries = 0;
		try {
			const response = await withAsiRetry(
				async (attempt) => {
					retries = attempt;
					throwIfAsiAborted(ctx?.signal);
					return runWithAsiCallContext(
						{ provider: input.provider, timeoutMs: asiProviderTimeoutMs(input.provider) },
						input.run,
					);
				},
				{ signal: ctx?.signal, maxRetries: input.live ? undefined : 0 },
			);
			if (input.live) {
				markAsiQueryCooldown(key);
				if (ctx?.usageKey) recordAsiAccountProviderCall(ctx.usageKey);
				if (usableLive(response)) writeAsiQueryCache(key, response);
			}
			recordAsiUsage({
				provider: input.provider,
				ok: !response.meta?.error,
				ms: Date.now() - started,
				retries,
				error: response.meta?.code || response.meta?.error,
				timeout: response.meta?.code === 'provider_timeout',
			});
			return {
				...response,
				meta: response.meta ? { ...response.meta, retries, cacheHit: false } : response.meta,
			};
		} catch (error) {
			if (input.live) {
				markAsiQueryCooldown(key);
				if (ctx?.usageKey) recordAsiAccountProviderCall(ctx.usageKey);
			}
			const classified = classifyAsiThrown(error);
			recordAsiUsage({
				provider: input.provider,
				ok: false,
				ms: Date.now() - started,
				retries,
				error: classified.code,
				cancelled: classified.code === 'cancelled',
				timeout: classified.code === 'provider_timeout',
			});
			throw error;
		}
	});
}
