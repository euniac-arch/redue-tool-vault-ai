export { ASI_LOOP_HREF, asiLoopStageFromPath, nextAsiLoopStage } from '@/lib/ai-search-intelligence/loop/stages';
// NOTE: `attachAsiLoop`/`composeAsiLoop` pull in the server-only persistence
// chain (`visibility/store.ts` -> `persist/*` -> `node:fs`). Import them
// directly from `loop/compose` in server-only code, never through this
// barrel from a client component.
export { attachAsiLoop, composeAsiLoop } from '@/lib/ai-search-intelligence/loop/compose';
export { emptyAsiLoop } from '@/lib/ai-search-intelligence/loop/empty';
export { composeAsiLoopChanges, emptyAsiLoopChanges } from '@/lib/ai-search-intelligence/loop/changes';
export { mergeLoopWithSession } from '@/lib/ai-search-intelligence/loop/session';
