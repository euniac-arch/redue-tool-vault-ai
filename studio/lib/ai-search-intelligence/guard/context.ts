import 'server-only';
import { AsyncLocalStorage } from 'async_hooks';
import { AsiServiceError } from '@/lib/ai-search-intelligence/api/errors';
import type { AsiTierLimits } from '@/lib/ai-search-intelligence/entitlement/catalog';
import type { AsiTier } from '@/lib/ai-search-intelligence/entitlement/tiers';
import type { AsiEngineId } from '@/lib/ai-search-intelligence/types';

export type AsiRequestContext = {
	requestId: string;
	clientKey: string;
	signal: AbortSignal;
	tier?: AsiTier;
	limits?: AsiTierLimits;
	usageKey?: string;
};

export type AsiCallContext = {
	provider: AsiEngineId;
	timeoutMs: number;
};

const REQUEST = new AsyncLocalStorage<AsiRequestContext>();
const CALL = new AsyncLocalStorage<AsiCallContext>();

export function runWithAsiRequestContext<T>(ctx: AsiRequestContext, fn: () => T): T {
	return REQUEST.run(ctx, fn);
}

export function getAsiRequestContext(): AsiRequestContext | undefined {
	return REQUEST.getStore();
}

export function runWithAsiCallContext<T>(ctx: AsiCallContext, fn: () => T): T {
	return CALL.run(ctx, fn);
}

export function getAsiCallContext(): AsiCallContext | undefined {
	return CALL.getStore();
}

export function throwIfAsiAborted(signal?: AbortSignal) {
	if (!signal?.aborted) return;
	throw new AsiServiceError(asiAbortCode(signal));
}

export function asiAbortCode(signal?: AbortSignal): 'cancelled' | 'provider_timeout' {
	const reason = String(signal?.reason || '');
	if (reason === 'cancelled' || reason === 'cancel') return 'cancelled';
	return 'provider_timeout';
}

export function asiClientKeyFromRequest(req: Request): string {
	const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
	const real = req.headers.get('x-real-ip')?.trim();
	return (forwarded || real || 'local').slice(0, 64);
}
