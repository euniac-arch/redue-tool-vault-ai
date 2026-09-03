import type { AsiFeatureId } from '@/lib/ai-search-intelligence/entitlement/catalog';
import type { AsiToolId } from '@/lib/ai-search-intelligence/routes';

/** Page-level gate. Partial tools stay open (`diagnose`). */
export function asiFeatureForTool(tool: AsiToolId): AsiFeatureId {
	if (tool === 'war-room') return 'war-room';
	if (tool === 'sov') return 'sov';
	if (tool === 'competitors') return 'competitor.basic';
	if (tool === 'gap') return 'competitor.gap';
	if (tool === 'action') return 'next-best-action';
	return 'diagnose';
}
