export type SeverityLevel = 'critical' | 'major' | 'warning' | 'info';

export interface DiagnosticItem {
	id: string;
	severity: SeverityLevel;
	title: string;
	businessLoss: string;
	/** Phrase inside `businessLoss` to bold for scanability. */
	lossEmphasis?: string;
	technicalCause: string;
	prescriptionEffect: string;
	/** Compact evidence chips under the technical cause. */
	causeTags?: string[];
}

import type { IndustryConfig } from '@/lib/registry/universalIndustryRegistry';

export interface QuickHookReportProps {
	diagnostics: DiagnosticItem[];
	/** @deprecated Unused — kept so existing call sites type-check. */
	clientName?: string;
	targetArea?: string;
	mainKeyword?: string;
	industryConfig?: IndustryConfig;
	hookStrip?: string;
}
