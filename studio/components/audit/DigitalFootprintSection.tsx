'use client';

import { useState, type ReactNode } from 'react';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { AuditReport } from '@/lib/site-auditor';
import { DigitalFootprintPanel } from './DigitalFootprintPanel';
import { DigitalFootprintReportTabs, type DfTabId } from './DigitalFootprintReportTabs';

interface DigitalFootprintSectionProps {
	report: AuditReport;
	reportData?: GeoNarrativeReport | null;
	/** Extra card mounted inside the footprint cluster (entity / sameAs bars). */
	afterSummary?: ReactNode;
}

export function DigitalFootprintSection({ report, reportData, afterSummary }: DigitalFootprintSectionProps) {
	const [activeTab, setActiveTab] = useState<DfTabId>('df-google');

	return (
		<>
			<DigitalFootprintPanel
				report={report}
				reportData={reportData}
				activeTab={activeTab}
				onTabChange={setActiveTab}
			/>
			{afterSummary}
			<DigitalFootprintReportTabs
				report={report}
				reportData={reportData}
				activeTab={activeTab}
				onTabChange={setActiveTab}
			/>
		</>
	);
}
