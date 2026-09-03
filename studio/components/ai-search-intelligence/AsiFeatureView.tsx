'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { EvidenceDashboard } from '@/components/ai-search-intelligence/evidence/EvidenceDashboard';
import { AgentReadinessDashboard } from '@/components/ai-search-intelligence/future/AgentReadinessDashboard';
import { PerceptionDashboard } from '@/components/ai-search-intelligence/perception/PerceptionDashboard';
import { RecommendationDashboard } from '@/components/ai-search-intelligence/recommendation/RecommendationDashboard';
import { AsiToolPlaceholder } from '@/components/ai-search-intelligence/tools/AsiToolPlaceholder';
import { CompetitorGapDashboard } from '@/components/ai-search-intelligence/competitor-gap/CompetitorGapDashboard';
import { NextActionDashboard } from '@/components/ai-search-intelligence/next-action/NextActionDashboard';
import { VisibilityMonitorDashboard } from '@/components/ai-search-intelligence/visibility/VisibilityMonitorDashboard';
import { EvidenceExplorerDashboard } from '@/components/ai-search-intelligence/evidence-explorer/EvidenceExplorerDashboard';
import { OpportunityDashboard } from '@/components/ai-search-intelligence/opportunity/OpportunityDashboard';
import { WarRoomDashboard } from '@/components/ai-search-intelligence/war-room/WarRoomDashboard';
import { AsiEntitlementGate } from '@/components/ai-search-intelligence/entitlement/AsiEntitlementGate';
import { asiFeatureForTool } from '@/lib/ai-search-intelligence/entitlement/feature-for-tool';
import { resolveAsiPathname, type AsiResolvedRoute } from '@/lib/ai-search-intelligence/routes';

export function AsiFeatureView({ route }: { route?: AsiResolvedRoute }) {
	const pathname = usePathname();
	const resolved = resolveAsiPathname(pathname);
	const active = resolved.tool.id ? resolved : route ?? resolved;
	const tool = active.tool.id;

	const gated = (node: ReactNode) => (
		<AsiEntitlementGate feature={asiFeatureForTool(tool)}>{node}</AsiEntitlementGate>
	);

	if (tool === 'war-room') return <WarRoomDashboard />;
	if (tool === 'opportunity') return <OpportunityDashboard />;
	if (tool === 'explorer') return <EvidenceExplorerDashboard />;
	if (tool === 'gap') return gated(<CompetitorGapDashboard />);
	if (tool === 'action') return gated(<NextActionDashboard />);
	if (tool === 'brand' || tool === 'reputation' || tool === 'snapshot') {
		return <PerceptionDashboard key={tool} tool={tool} />;
	}
	if (tool === 'test' || tool === 'simulator') {
		return <RecommendationDashboard key={tool} tool={tool} />;
	}
	if (tool === 'sov' || tool === 'competitors') {
		return gated(<RecommendationDashboard key={tool} tool={tool} />);
	}
	if (tool === 'visibility') return <VisibilityMonitorDashboard />;
	if (tool === 'citations' || tool === 'questions') {
		return <EvidenceDashboard key={tool} tool={tool} />;
	}
	if (tool === 'agent-readiness') return <AgentReadinessDashboard />;
	return <AsiToolPlaceholder route={active} />;
}
