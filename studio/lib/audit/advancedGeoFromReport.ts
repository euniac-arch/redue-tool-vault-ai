/**
 * Bind next-gen GEO metrics to a crawled AuditReport (Tab 1 / Tab 2 cards).
 */

import {
	computeAdvancedGeoMetrics,
	extractPlaceCid,
	extractTaxId,
	type AdvancedGeoLang,
	type AdvancedGeoMetricsInput,
	type AdvancedGeoMetricsReport,
	type CompetitorSeed,
} from '@/lib/audit/advancedGeoMetrics';
import { extractRepresentative } from '@/lib/audit/extractors/entity';
import { snapshotHasRealCompetitors } from '@/lib/audit/realCompetitors';
import { resolveHasLlmsTxt } from '@/lib/audit/llms-txt-check';
import { napFromAuditReport } from '@/lib/geo/prescription-patches';
import type { AuditReport } from '@/lib/site-auditor';

function competitorSeedsFromReport(
	report: Pick<AuditReport, 'realCompetitors'>,
): { competitors?: CompetitorSeed[]; targetQuery?: string; rawSearchResults?: string[] } {
	const snapshot = report.realCompetitors;
	if (!snapshotHasRealCompetitors(snapshot) || !snapshot) return {};
	const competitors: CompetitorSeed[] = snapshot.names.slice(0, 2).map((name, i) => ({
		name,
		isRealData: snapshot.isRealData[i] !== false,
	}));
	if (!competitors.length) return {};
	const rankedNames = (snapshot.rankedNames ?? []).filter(Boolean);
	return {
		competitors,
		targetQuery: snapshot.query,
		rawSearchResults: rankedNames.length ? rankedNames : snapshot.names.filter(Boolean),
	};
}

export function advancedGeoInputFromReport(
	report: Pick<
		AuditReport,
		| 'url'
		| 'lang'
		| 'siteMeta'
		| 'metrics'
		| 'pageSizeBytes'
		| 'footerText'
		| 'detectedKeywords'
		| 'collectedUrls'
		| 'realCompetitors'
	>,
): AdvancedGeoMetricsInput {
	const meta = report.siteMeta;
	const metrics = report.metrics;
	const lang: AdvancedGeoLang = report.lang === 'en' ? 'en' : 'ko';
	const jsonLdCorpus = (metrics?.jsonLdSnippets ?? []).join('\n');
	const entityCorpus = [jsonLdCorpus, report.footerText, ...(report.collectedUrls ?? [])].filter(Boolean).join('\n');
	const textParts = [
		metrics?.pageTitle,
		metrics?.documentTitle,
		metrics?.metaDescription,
		metrics?.ogTitle,
		metrics?.ogDescription,
		...(metrics?.h1Texts ?? []),
		...(metrics?.h2Texts ?? []),
		report.footerText,
		jsonLdCorpus,
	].filter(Boolean);
	const schemaTypes = metrics?.schemaTypes ?? meta?.schemaEntityTypes ?? [];
	const hasSchema = (metrics?.jsonLdBlockCount ?? 0) > 0 || schemaTypes.length > 0;
	const extractedRep = extractRepresentative(entityCorpus, lang);
	const representativeName =
		meta?.representativeName || (extractedRep.isExtracted ? extractedRep.name : undefined);
	return {
		lang,
		brandName: meta?.brandName,
		location: meta?.location || meta?.broadLocation,
		industryType: undefined,
		legacyIndustry: meta?.industryType || meta?.category,
		title: meta?.title || metrics?.documentTitle || metrics?.pageTitle,
		description: meta?.metaDescription || metrics?.metaDescription || meta?.ogDescription,
		keywords: [
			meta?.metaKeywords,
			meta?.primaryKeyword,
			meta?.category,
			...(meta?.detectedKeywords ?? []),
			...(report.detectedKeywords ?? []),
		]
			.filter(Boolean)
			.join(' '),
		services: meta?.coreSpecialties,
		primaryKeyword: meta?.primaryKeyword,
		url: report.url || meta?.targetUrl,
		domain: meta?.domain,
		representativeName,
		nap: napFromAuditReport(report as AuditReport),
		jsonLdCorpus,
		html: entityCorpus,
		text: textParts.join('\n'),
		taxId: extractTaxId(entityCorpus),
		placeCid: extractPlaceCid(entityCorpus),
		htmlLength: report.pageSizeBytes || undefined,
		textLength: metrics?.bodyTextLength || undefined,
		hasArticle: schemaTypes.some((type) => /Article|Blog|WebPage|MedicalWebPage|AboutPage/i.test(type)),
		hasSection: Boolean(metrics?.h2Texts?.length),
		hasMain: (metrics?.bodyTextLength ?? 0) >= 300,
		hasSchema,
		...competitorSeedsFromReport(report),
	};
}

export function computeAdvancedGeoFromReport(
	report: Pick<
		AuditReport,
		| 'url'
		| 'lang'
		| 'siteMeta'
		| 'metrics'
		| 'pageSizeBytes'
		| 'footerText'
		| 'detectedKeywords'
		| 'collectedUrls'
		| 'realCompetitors'
	>,
): AdvancedGeoMetricsReport & { hasLlmsTxt: boolean } {
	const computed = computeAdvancedGeoMetrics(advancedGeoInputFromReport(report));
	return {
		...computed,
		hasLlmsTxt: resolveHasLlmsTxt(report),
	};
}
