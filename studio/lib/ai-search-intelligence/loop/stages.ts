import { ASI_LOOP_STAGES, type AsiLoopStage } from '@/lib/ai-search-intelligence/types';

export const ASI_LOOP_HREF: Record<AsiLoopStage, string> = {
	measure: '/intelligence/visibility-monitor',
	discover: '/intelligence/opportunity-finder',
	explain: '/intelligence/evidence-explorer',
	compete: '/intelligence/competitor-gap',
	act: '/intelligence/next-best-action',
	monitor: '/intelligence/visibility-monitor',
	alert: '/intelligence/visibility-monitor#asi-alerts',
};

export function nextAsiLoopStage(stage: AsiLoopStage): AsiLoopStage {
	const index = ASI_LOOP_STAGES.indexOf(stage);
	return ASI_LOOP_STAGES[(index + 1) % ASI_LOOP_STAGES.length];
}

export function asiLoopStageFromPath(pathname: string): AsiLoopStage | null {
	if (pathname.includes('opportunity-finder')) return 'discover';
	if (pathname.includes('evidence-explorer')) return 'explain';
	if (pathname.includes('competitor-gap')) return 'compete';
	if (pathname.includes('next-best-action')) return 'act';
	if (pathname.includes('visibility-monitor')) return 'monitor';
	if (pathname === '/intelligence' || pathname.endsWith('/intelligence') || pathname.includes('war-room')) {
		return 'measure';
	}
	return null;
}
