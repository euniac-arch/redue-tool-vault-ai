'use client';

import { useState } from 'react';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { AuditReport } from '@/lib/site-auditor';
import { DigitalFootprintPanel } from './DigitalFootprintPanel';
import { DigitalFootprintReportTabs, type DfTabId } from './DigitalFootprintReportTabs';

interface DigitalFootprintSectionProps {
	report: AuditReport;
	reportData?: GeoNarrativeReport | null;
}

export function DigitalFootprintSection({ report, reportData }: DigitalFootprintSectionProps) {
	const [activeTab, setActiveTab] = useState<DfTabId>('df-google');

	return (
		<>
			<DigitalFootprintPanel
				report={report}
				reportData={reportData}
				activeTab={activeTab}
				onTabChange={setActiveTab}
			/>
			<DigitalFootprintReportTabs
				report={report}
				reportData={reportData}
				activeTab={activeTab}
				onTabChange={setActiveTab}
			/>
		</>
	);
}
