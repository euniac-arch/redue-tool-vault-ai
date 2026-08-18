'use client';

import { AiSearchResultSimulator } from '@/components/audit/AiSearchResultSimulator';
import { JsonLdFixSnippetsPanel } from '@/components/audit/JsonLdFixSnippetsPanel';
import { KeywordPipeline } from '@/components/audit/KeywordPipeline';
import { AuditActionPlan } from '@/components/AuditActionPlan';
import { GeoCitationAlgorithmSection } from '@/components/GeoCitationAlgorithmSection';
import { GeoNarrativeSkeleton } from '@/components/GeoNarrativeSkeleton';
import { ImpactPreviewSection } from '@/components/ImpactPreviewSection';
import { DeferredSection } from '@/components/audit/DeferredSection';
import { siteLabelFromUrl } from '@/lib/audit/report-url';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { AuditReport } from '@/lib/site-auditor';

export interface Tab2BelowFoldProps {
	report: AuditReport;
	geoNarrative: GeoNarrativeReport | null;
	geoNarrativeLoading: boolean;
	force?: boolean;
}

/**
 * Tab 2 blocks that sit below PageSpeed / technical evidence.
 * Loaded as a separate chunk so the first paint of the dashboard stays light.
 */
export function Tab2BelowFold({
	report,
	geoNarrative,
	geoNarrativeLoading,
	force = false,
}: Tab2BelowFoldProps) {
	const domain = siteLabelFromUrl(report.url);

	return (
		<>
			<div className="print:hidden pdf-screen-only flex flex-col gap-6">
				<DeferredSection force={force} minHeight={120}>
					<ImpactPreviewSection
						siteName={domain}
						reportData={geoNarrative}
						auditReport={report}
					/>
				</DeferredSection>
				{geoNarrativeLoading && !geoNarrative ? (
					<GeoNarrativeSkeleton />
				) : (
					<DeferredSection force={force} minHeight={160}>
						<GeoCitationAlgorithmSection
							domain={domain}
							reportData={geoNarrative}
							auditReport={report}
						/>
						<AiSearchResultSimulator meta={report.siteMeta} domain={domain} reportData={geoNarrative} />
					</DeferredSection>
				)}
			</div>

			<DeferredSection force={force} minHeight={80}>
				<JsonLdFixSnippetsPanel report={report} />
			</DeferredSection>
			<DeferredSection force={force} minHeight={80}>
				<AuditActionPlan report={report} />
			</DeferredSection>
			<DeferredSection force={force} minHeight={80}>
				<KeywordPipeline report={report} />
			</DeferredSection>
		</>
	);
}
