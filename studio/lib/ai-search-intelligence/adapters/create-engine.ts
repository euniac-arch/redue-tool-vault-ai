import { liveAsiEngine } from '@/lib/ai-search-intelligence/adapters/live-engine';
import { mockAsiEngine } from '@/lib/ai-search-intelligence/adapters/mock-engine';
import type { AsiEnginePort } from '@/lib/ai-search-intelligence/adapters/port';
import { resolveAsiMode, type AsiRuntimeMode } from '@/lib/ai-search-intelligence/providers/resolve-mode';

/** Server-only. Client UI must use `asi-client` → /api/intelligence. */
export function createAsiEngine(mode?: AsiRuntimeMode): AsiEnginePort {
	const resolved = mode ?? resolveAsiMode();
	return resolved === 'mock' ? mockAsiEngine : liveAsiEngine;
}
