'use client';

import { KeywordRecommendationPanel } from '@/components/audit/KeywordRecommendationPanel';
import type { AuditReport } from '@/lib/site-auditor';

export interface KeywordPipelineProps {
	report: AuditReport;
}

/**
 * GEO · SEO Keyword Pipeline — registry.actionName intent chips
 * (6 AI prompts / 6 brand entities / 8 conversion long-tails / 8 local LSI).
 * P2 Title Tag labels are hardcoded so next-intl never leaks `audit.keywordRecommend.sources…`.
 */
export function KeywordPipeline({ report }: KeywordPipelineProps) {
	return <KeywordRecommendationPanel report={report} />;
}
