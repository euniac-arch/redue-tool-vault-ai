import { resolveAsiMode } from '@/lib/ai-search-intelligence/providers/resolve-mode';

/** Live/hybrid persist by default. Mock stays memory-only unless ASI_PERSIST=1. */
export function isAsiPersistEnabled(): boolean {
	const flag = (process.env.ASI_PERSIST || '').trim().toLowerCase();
	if (flag === '0' || flag === 'false' || flag === 'no') return false;
	if (flag === '1' || flag === 'true' || flag === 'yes') return true;
	return resolveAsiMode() !== 'mock';
}
