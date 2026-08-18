'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { EeatAndEntityDisambiguationSection } from '@/components/audit/EeatAndEntityDisambiguationSection';
import { GEO_PILLAR_ANCHOR_IDS } from '@/lib/audit/geoScoreCalculator';
import { computeAdvancedGeoFromReport } from '@/lib/audit/advancedGeoFromReport';
import type { EntityDisambiguationResult } from '@/lib/audit/advancedGeoMetrics';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { useResolvedReputation } from '@/components/audit/AuditDataContext';
import { buildSchemaPropertyChecksFromAudit } from '@/lib/geo/precision-diagnostics';
import { resolveIndustryConfigFromSite } from '@/lib/registry/universalIndustryRegistry';
import type { AuditReport } from '@/lib/site-auditor';

export interface EeatReportProps {
	report: AuditReport;
	reportData?: GeoNarrativeReport | null;
	/** Precomputed entity score from Tab 1 (avoids a second pass). */
	entity?: EntityDisambiguationResult;
}

export function EeatReport({ report, reportData, entity }: EeatReportProps) {
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const resolvedEntity = useMemo(
		() => entity ?? computeAdvancedGeoFromReport(report).entityDisambiguation,
		[entity, report],
	);
	const brandTrust = useResolvedReputation(report, reportData, lang)?.brandTrust;
	if (!brandTrust) return null;
	const schemaProperties =
		brandTrust.schemaProperties?.length
			? brandTrust.schemaProperties
			: buildSchemaPropertyChecksFromAudit(report, lang);
	const meta = report.siteMeta;
	const industry = resolveIndustryConfigFromSite({
		lang,
		brandName: meta?.brandName,
		location: meta?.location || meta?.broadLocation,
		primaryKeyword: meta?.primaryKeyword,
		category: meta?.category,
		services: meta?.coreSpecialties,
		domain: meta?.domain,
		url: report.url,
		legacyIndustry: meta?.industryType,
		title: meta?.title,
		description: meta?.metaDescription || meta?.ogDescription,
		keywords: [meta?.metaKeywords, meta?.primaryKeyword, meta?.category, ...(meta?.detectedKeywords ?? [])]
			.filter(Boolean)
			.join(' '),
		schemaTypes: report.metrics?.schemaTypes ?? meta?.schemaEntityTypes,
		navMenuTexts: meta?.navMenuTexts,
	});
	const personJobTitle = brandTrust.personJobTitle || industry.personJobTitle;
	const personName = brandTrust.personName || '';
	const recommendedSchema = brandTrust.recommendedSchemaType || industry.schemaType;

	return (
		<section
			id={GEO_PILLAR_ANCHOR_IDS.entity}
			data-geo-pillar="entity"
			className="pdf-page-item audit-report-section scroll-mt-24 flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-5 sm:p-6"
		>
			<EeatAndEntityDisambiguationSection
				entity={resolvedEntity}
				industry={industry}
				personName={personName}
				personJobTitle={personJobTitle}
				recommendedSchema={recommendedSchema}
				industryCategory={industry.defaultCategory}
				keywords={brandTrust.keywords}
				missingKeyword={brandTrust.missingKeyword}
				schemaProperties={schemaProperties}
			/>
		</section>
	);
}
