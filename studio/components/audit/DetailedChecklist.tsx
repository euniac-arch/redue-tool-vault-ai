'use client';

import { useMemo } from 'react';
import { AuditChecklist } from '@/components/AuditChecklist';
import { useOptionalAuditData } from '@/components/audit/AuditDataContext';
import { hydrateChecklistItems } from '@/lib/audit/hydrate-checklist-details';
import { ensureLlmsTxtChecklistItem } from '@/lib/audit/llms-txt-check';
import { ensureRssFeedChecklistItem } from '@/lib/audit/rss-feed-check';
import { normalizeChecklistItems } from '@/lib/audit/onpage-diagnostic';
import type { AuditCheckItem, AuditReport } from '@/lib/site-auditor';

export interface DetailedChecklistProps {
	report?: AuditReport | null;
	checks?: AuditCheckItem[];
	rawTechnicalScore?: number;
	maxRawScore?: number;
}

/**
 * Dynamic-max / 25-item on-page checklist.
 * Pass items always show “[평가 기준 및 통과 근거]”; NewsArticle is remapped
 * to the industry-core schema weight for clinic/business verticals.
 * `/llms.txt` is a regular 6-point GEO slot (Warn when missing).
 * RSS is a 3-point SEO slot (Warn when `/rss.php` or RSS link tag is missing).
 */
export function DetailedChecklist({
	report,
	checks,
	rawTechnicalScore,
	maxRawScore,
}: DetailedChecklistProps) {
	const auditData = useOptionalAuditData();
	const officialRaw = auditData?.scores.rawScore122 ?? rawTechnicalScore;
	const officialMax = auditData?.scores.maxRawScore ?? maxRawScore;
	const normalized = useMemo(() => {
		const items = normalizeChecklistItems(report, checks ?? report?.checklist);
		return hydrateChecklistItems(
			ensureRssFeedChecklistItem(ensureLlmsTxtChecklistItem(items, report), report),
			report?.metrics,
			report?.pageMetas,
		);
	}, [report, checks]);

	return (
		<AuditChecklist
			checks={normalized}
			rawTechnicalScore={officialRaw}
			maxRawScore={officialMax}
		/>
	);
}
