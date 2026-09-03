import { AsiServiceError } from '@/lib/ai-search-intelligence/api/errors';
import { ASI_GUARD } from '@/lib/ai-search-intelligence/guard/limits';

const SLOTS = new Map<string, number>();

function read(key: string): number {
	return SLOTS.get(key) ?? 0;
}

function write(key: string, value: number) {
	if (value <= 0) SLOTS.delete(key);
	else SLOTS.set(key, value);
}

export function clearAsiConcurrency() {
	SLOTS.clear();
}

export function readAsiConcurrency(usageKey: string) {
	return {
		user: read(`u:${usageKey}`),
		global: read('global'),
	};
}

export function acquireAsiConcurrency(usageKey: string) {
	const user = read(`u:${usageKey}`);
	const global = read('global');
	if (user >= ASI_GUARD.maxConcurrentPerUser || global >= ASI_GUARD.maxConcurrentGlobal) {
		throw new AsiServiceError('rate_limit');
	}
	write(`u:${usageKey}`, user + 1);
	write('global', global + 1);
}

export function releaseAsiConcurrency(usageKey: string) {
	write(`u:${usageKey}`, read(`u:${usageKey}`) - 1);
	write('global', read('global') - 1);
}
