/**
 * Pure, client-safe helper for an empty Intelligence Loop.
 *
 * Kept separate from `loop/compose.ts` on purpose: `compose.ts` pulls in the
 * full server-side composer chain (`visibility/store.ts` -> `persist/*` ->
 * `node:fs`), which must never end up in a client bundle. `loop/session.ts`
 * (used from client components such as `WarRoomLoopPanel`) only needs the
 * empty fallback, so it imports from here instead of `compose.ts`.
 */
import { emptyAsiLoopChanges } from '@/lib/ai-search-intelligence/loop/changes';
import type { AsiIntelligenceLoop } from '@/lib/ai-search-intelligence/types';

function emptyDelta(current: number | null) {
	return { current, previous: null, change: null, changePct: null, provenance: 'observed' as const };
}

export function emptyAsiLoop(fallbackVisibility = 0): AsiIntelligenceLoop {
	return {
		health: { current: fallbackVisibility, previous: null, change: null, changePct: null, provenance: 'derived', changeProvenance: null },
		changes: emptyAsiLoopChanges(),
		opportunities: [],
		gaps: [],
		actions: [],
		alerts: [],
		trend7: emptyDelta(fallbackVisibility),
		trend30: emptyDelta(fallbackVisibility),
	};
}
