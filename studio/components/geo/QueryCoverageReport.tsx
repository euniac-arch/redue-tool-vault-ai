'use client';

import {
	GeoPrescriptionCoverageSection,
	type GeoPrescriptionCoverageSectionProps,
} from '@/components/geo/GeoPrescriptionCoverageSection';

export type QueryCoverageReportProps = GeoPrescriptionCoverageSectionProps;

/** @deprecated Use GeoPrescriptionCoverageSection — kept as a thin alias. */
export function QueryCoverageReport(props: QueryCoverageReportProps) {
	return <GeoPrescriptionCoverageSection {...props} />;
}
