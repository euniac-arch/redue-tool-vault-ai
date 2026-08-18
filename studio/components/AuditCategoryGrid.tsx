'use client';

import { useMemo } from 'react';
import { FiveCategoryCardsGrid } from '@/components/audit/FiveCategoryCardsGrid';
import {
	buildOnPageDiagnostic,
	type OnPageDiagnosticProps,
} from '@/lib/audit/onpage-diagnostic';
import type { AuditCategory, AuditReport } from '@/lib/site-auditor';

interface AuditCategoryGridProps {
	categories?: AuditCategory[];
	report?: AuditReport;
	diagnostic?: OnPageDiagnosticProps;
}

export function AuditCategoryGrid({ categories, report, diagnostic: diagnosticProp }: AuditCategoryGridProps) {
	const diagnostic = useMemo(() => {
		if (diagnosticProp) return diagnosticProp;
		if (report) return buildOnPageDiagnostic(report);
		return buildOnPageDiagnostic({
			score: 0,
			maxScore: 0,
			lang: 'ko',
			categories: categories ?? [],
		});
	}, [categories, diagnosticProp, report]);

	return <FiveCategoryCardsGrid categories={diagnostic.categories} />;
}
