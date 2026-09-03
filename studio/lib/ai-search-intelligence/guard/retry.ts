import { classifyAsiThrown, type AsiErrorCode } from '@/lib/ai-search-intelligence/api/errors';
import { throwIfAsiAborted } from '@/lib/ai-search-intelligence/guard/context';
import { ASI_GUARD, asiBackoffMs } from '@/lib/ai-search-intelligence/guard/limits';

const RETRYABLE: readonly AsiErrorCode[] = ['network_error', 'provider_timeout'];

export function asiShouldRetry(error: unknown): boolean {
	const code = classifyAsiThrown(error).code;
	return RETRYABLE.includes(code);
}

export async function sleepAsi(ms: number, signal?: AbortSignal): Promise<void> {
	if (ms <= 0) return;
	throwIfAsiAborted(signal);
	await new Promise<void>((resolve, reject) => {
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			try {
				throwIfAsiAborted(signal);
				resolve();
			} catch (error) {
				reject(error);
			}
		};
		signal?.addEventListener('abort', onAbort, { once: true });
	});
}

export async function withAsiRetry<T>(
	fn: (attempt: number) => Promise<T>,
	options?: {
		maxRetries?: number;
		signal?: AbortSignal;
		sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
		shouldRetry?: (error: unknown) => boolean;
	},
): Promise<T> {
	const maxRetries = options?.maxRetries ?? ASI_GUARD.maxRetries;
	const sleep = options?.sleep ?? sleepAsi;
	const shouldRetry = options?.shouldRetry ?? asiShouldRetry;
	let last: unknown;
	for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
		throwIfAsiAborted(options?.signal);
		try {
			return await fn(attempt);
		} catch (error) {
			last = error;
			if (attempt >= maxRetries || !shouldRetry(error)) throw error;
			await sleep(asiBackoffMs(attempt), options?.signal);
		}
	}
	throw last;
}
