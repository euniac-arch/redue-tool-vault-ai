'use client';

import { memo, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { AiEngineExposurePanel } from '@/components/audit/AiEngineExposurePanel';
import { BrandTrustPanel } from '@/components/audit/BrandTrustPanel';
import { CompetitorSovCard } from '@/components/audit/CompetitorSovCard';
import { DigitalFootprintSection } from '@/components/audit/DigitalFootprintSection';
import { GeoActionPlanPanel } from '@/components/audit/GeoActionPlanPanel';
import { GeoLocalNapCard } from '@/components/audit/GeoLocalNapCard';
import { GeoScoreOverviewHeader } from '@/components/audit/GeoScoreOverviewHeader';
import { GeoDiagnosticTabFromAudit } from '@/components/geo/GeoDiagnosticTab';
import { DeferredSection } from '@/components/audit/DeferredSection';
import { LlmsTxtCopyBox } from '@/components/audit/LlmsTxtCopyBox';
import { computeAdvancedGeoFromReport } from '@/lib/audit/advancedGeoFromReport';
import { generateSoVAnalysis, sovSiteDataFromReport } from '@/lib/audit/sov-analysis';
import { useAdminSession } from '@/lib/admin/use-admin-session';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { AuditReport } from '@/lib/site-auditor';

export interface Tab1ReputationSectionProps {
	report: AuditReport;
	/** Raw crawl used by the 6-engine diagnostic (before live overlay). */
	audit?: AuditReport;
	reportData?: GeoNarrativeReport | null;
	onOpenPdfPreview: () => void;
	publicView?: boolean;
}

/**
 * Track 2 tab — AI search trust & citation dominance (GEO).
 * Top: standardized market-ranking leaderboard (industry/region-aware
 * generic queries, realistic 3–12% → 60–75% SoV deficiency/recapture model).
 * E-E-A-T: entity identification gauge.
 * Bottom crawler diagnosis: /llms.txt status + jump to Answer Center module 5.
 */
function Tab1ReputationSectionInner({
	report,
	audit,
	reportData,
	onOpenPdfPreview,
	publicView = false,
}: Tab1ReputationSectionProps) {
	const locale = useLocale();
	const { isAdmin } = useAdminSession();
	const lang = locale === 'en' ? 'en' : 'ko';
	const showSovLeaderboard = isAdmin;
	const sovAnalysis = useMemo(
		() => (showSovLeaderboard ? generateSoVAnalysis({ ...sovSiteDataFromReport(report), lang }) : null),
		[showSovLeaderboard, report.url, report.siteMeta, report.metrics, report.detectedKeywords, lang],
	);
	const metrics = useMemo(() => computeAdvancedGeoFromReport(report), [report]);
	const diagnosticAudit = audit ?? report;

	return (
		<>
			{showSovLeaderboard && sovAnalysis ? (
				<CompetitorSovCard analysis={sovAnalysis} siteUrl={report.url || report.siteMeta?.targetUrl} />
			) : null}

			<GeoScoreOverviewHeader
				report={report}
				reportData={reportData}
				onOpenPdfPreview={onOpenPdfPreview}
			/>
			<AiEngineExposurePanel report={report} reportData={reportData} industryConfig={metrics.industry} />
			<GeoDiagnosticTabFromAudit
				key={`${diagnosticAudit.url}|${diagnosticAudit.fetchedAt}`}
				audit={diagnosticAudit}
				reportData={reportData}
			/>
			<BrandTrustPanel report={report} reportData={reportData} entity={metrics.entityDisambiguation} />
			<GeoLocalNapCard report={report} reportData={reportData} />
			<DeferredSection force={publicView} minHeight={160}>
				<DigitalFootprintSection report={report} reportData={reportData} />
			</DeferredSection>
			<LlmsTxtCopyBox
				present={metrics.hasLlmsTxt}
				report={report}
				reportData={reportData}
			/>
			<DeferredSection force={publicView} minHeight={120}>
				<GeoActionPlanPanel report={report} reportData={reportData} />
			</DeferredSection>
		</>
	);
}

export const Tab1ReputationSection = memo(Tab1ReputationSectionInner);
