'use client';

import { BusinessImpactPrescriptionCards } from '@/components/audit/BusinessImpactPrescriptionCards';
import { AuditExposureSimulator } from '@/components/audit/AuditExposureSimulator';
import { AuditTimelineSection } from '@/components/audit/AuditTimelineSection';
import { SolutionPackageCta } from '@/components/audit/SolutionPackageCta';
import { businessConversionFromAudit } from '@/lib/audit/business-conversion';
import { resolveTargetBrandName } from '@/lib/audit/target-entity';
import { useAuditData } from '@/components/audit/AuditDataContext';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { AuditReport } from '@/lib/site-auditor';

interface AuditConversionFooterProps {
	report: AuditReport;
	reportData?: GeoNarrativeReport | null;
	reportId?: string | null;
	publicView?: boolean;
	lang: 'ko' | 'en';
}

/**
 * Shared post-tab conversion funnel: business impact → simulator → history → packages.
 */
export function AuditConversionFooter({
	report,
	reportData,
	reportId,
	publicView = false,
	lang,
}: AuditConversionFooterProps) {
	const { scores } = useAuditData();
	const conversionModel = businessConversionFromAudit(report, null, lang);

	return (
		<div
			id="audit-conversion"
			className="print:hidden pdf-screen-only flex scroll-mt-24 flex-col gap-8"
		>
			<div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 dark:border-white/[0.08] dark:bg-[#0B0F28] md:px-6 md:py-6">
				<BusinessImpactPrescriptionCards report={report} reportData={reportData} />
			</div>

			<AuditExposureSimulator report={report} />

			<AuditTimelineSection report={report} reportId={reportId} publicView={publicView} />

			<div id="consulting-section" className="scroll-mt-24">
				<SolutionPackageCta
					targetUrl={report.url}
					brandName={resolveTargetBrandName(report)}
					targetQuery={conversionModel.targetQuery}
					currentScore={scores.totalScore}
				/>
			</div>
		</div>
	);
}
