'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
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
import type { DynamicSovResult } from '@/lib/audit/advancedGeoMetrics';
import {
	snapshotHasRealCompetitors,
	type RealCompetitorSnapshot,
} from '@/lib/audit/realCompetitors';
import { generateQueryMatrix } from '@/lib/geo/query-matrix';
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
 * Tab 1 — AI search trust & external reputation.
 * Top: unified market leaderboard (live top 3 including the client + To-Be).
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
	const lang = locale === 'en' ? 'en' : 'ko';
	const queryMatrix = useMemo(
		() =>
			generateQueryMatrix({
				lang,
				siteMeta: report.siteMeta,
				metrics: report.metrics,
				detectedKeywords: report.detectedKeywords,
			}),
		[report.siteMeta, report.metrics, report.detectedKeywords, lang],
	);
	const queryContext = useMemo(() => {
		const slots = queryMatrix.slots;
		const clientName = slots.brandName;
		const region = slots.location || '';
		const mainService = slots.categoryNouns[0] || '';
		const subService = slots.categoryNouns[1];
		return {
			clientName,
			region,
			mainService,
			subService,
			categoryName: report.siteMeta?.category || mainService,
			sovPresets: queryMatrix.sovPresets,
			defaultQuery: queryMatrix.sovPresets[0] || queryMatrix.sovPresets[1],
		};
	}, [queryMatrix, report.siteMeta?.category]);
	const [liveSnapshot, setLiveSnapshot] = useState<RealCompetitorSnapshot | null>(
		() => report.realCompetitors ?? null,
	);
	useEffect(() => {
		setLiveSnapshot(report.realCompetitors ?? null);
		if (snapshotHasRealCompetitors(report.realCompetitors)) return;
		const { clientName, region, mainService, categoryName } = queryContext;
		if (!clientName || !region || !mainService) return;
		const defaultQuery = queryContext.defaultQuery;
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch('/api/competitors', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						clientName,
						region,
						mainService,
						query: defaultQuery,
						categoryName,
						lang,
					}),
				});
				const data = (await res.json()) as { snapshot?: RealCompetitorSnapshot };
				if (cancelled || !res.ok || !snapshotHasRealCompetitors(data.snapshot)) return;
				setLiveSnapshot(data.snapshot ?? null);
			} catch {
				/* keep statistical fallback already bound on the report */
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [report.url, report.fetchedAt, report.realCompetitors, queryContext, lang]);
	const boundReport = useMemo(
		() => (liveSnapshot ? { ...report, realCompetitors: liveSnapshot } : report),
		[report, liveSnapshot],
	);
	const metrics = useMemo(() => computeAdvancedGeoFromReport(boundReport), [boundReport]);
	const diagnosticAudit = audit ?? report;

	const handleQueryChange = useCallback(
		async (newQuery: string): Promise<DynamicSovResult> => {
			const { clientName, region, mainService, categoryName } = queryContext;
			const res = await fetch('/api/competitors', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					clientName,
					region,
					mainService,
					query: newQuery,
					categoryName,
					lang,
				}),
			});
			const data = (await res.json()) as { snapshot?: RealCompetitorSnapshot; error?: string };
			if (!res.ok || !data.snapshot) {
				throw new Error(data.error || 'Failed to update SOV rankings');
			}
			setLiveSnapshot(data.snapshot);
			return computeAdvancedGeoFromReport({ ...report, realCompetitors: data.snapshot }).dynamicSov;
		},
		[queryContext, lang, report],
	);

	return (
		<>
			<CompetitorSovCard
				sovData={metrics.dynamicSov}
				industryConfig={metrics.industry}
				clientName={queryContext.clientName}
				region={queryContext.region}
				mainService={queryContext.mainService}
				subService={queryContext.subService}
				queryPresets={queryContext.sovPresets}
				siteUrl={report.url || report.siteMeta?.targetUrl}
				onQueryChange={handleQueryChange}
			/>

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
			<LlmsTxtCopyBox
				present={metrics.hasLlmsTxt}
				report={report}
				reportData={reportData}
			/>
			<GeoLocalNapCard report={report} reportData={reportData} />
			<DeferredSection force={publicView} minHeight={160}>
				<DigitalFootprintSection report={report} reportData={reportData} />
			</DeferredSection>
			<DeferredSection force={publicView} minHeight={120}>
				<GeoActionPlanPanel report={report} reportData={reportData} />
			</DeferredSection>
		</>
	);
}

export const Tab1ReputationSection = memo(Tab1ReputationSectionInner);
