'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { DiagnosisScoreSnapshot } from '@/lib/audit/diagnosis-scores';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { resolveExternalReputation, type GeoExternalReputationReport } from '@/lib/audit/geo-score';
import type { AuditScores } from '@/lib/audit/scoreCalculator';
import type { AuditReport } from '@/lib/site-auditor';

/**
 * One diagnosis packet for the result dashboard.
 * UI surfaces must render `scores` as-is — never recompute penalties.
 */
export interface AuditData {
	scores: AuditScores;
	snapshot: DiagnosisScoreSnapshot;
}

const AuditDataContext = createContext<AuditData | null>(null);

export function AuditDataProvider({
	value,
	children,
}: {
	value: AuditData;
	children: ReactNode;
}) {
	return <AuditDataContext.Provider value={value}>{children}</AuditDataContext.Provider>;
}

export function useAuditData(): AuditData {
	const ctx = useContext(AuditDataContext);
	if (!ctx) {
		throw new Error('useAuditData must be used within AuditDataProvider');
	}
	return ctx;
}

export function useOptionalAuditData(): AuditData | null {
	return useContext(AuditDataContext);
}

/**
 * Prefer the diagnosis snapshot already computed in AuditReportDocument.
 * Falls back to a local resolve only when the provider is absent.
 */
export function useResolvedReputation(
	report?: AuditReport | null,
	reportData?: GeoNarrativeReport | null,
	lang: 'ko' | 'en' = 'ko',
): GeoExternalReputationReport | null {
	const snapshot = useOptionalAuditData()?.snapshot;
	return useMemo(() => {
		if (snapshot?.reputation) return snapshot.reputation;
		if (!report) return null;
		return resolveExternalReputation(report, reportData, lang);
	}, [snapshot?.reputation, report, reportData, lang]);
}
