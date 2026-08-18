import {
	alignRecommendedSchemas,
	detectSchemaVertical,
	type SchemaMappingInput,
} from '@/lib/audit/recommended-schemas';
import { inferCmsFromAuditReport, isHttpsUrl } from '@/lib/audit/target-entity';
import type { AuditReport } from '@/lib/site-auditor';

export interface TechnicalEvidenceData {
	cms: string;
	isHttps: boolean;
	ttfbMs: number;
	isRobotsAllowed: boolean;
	h1Count: number;
	h1Sample: string;
	altMissingCount: number;
	altTotalCount: number;
	jsonLdBlocksCount: number;
	headingSkips: string[];
	renderBlockingCount: number;
}

export interface LiveCriteriaReportProps {
	clientName: string;
	categoryName: string;
	region: string;
	mainSpecialty: string;
	recommendedSchemas: string[];
	evidence: TechnicalEvidenceData;
}

export function buildTechnicalEvidenceData(
	report: AuditReport,
	lang: 'ko' | 'en' = 'ko',
): TechnicalEvidenceData {
	const m = report.metrics;
	const cms =
		report.cmsType && report.cmsType !== 'UNKNOWN'
			? report.cmsType
			: inferCmsFromAuditReport(report, lang);
	const botAllowed = Boolean(
		m?.aiBotAccess && Object.values(m.aiBotAccess).some((allowed) => allowed === true),
	);
	const robotsAllowed = report.indexStatus?.allowed ?? botAllowed;

	return {
		cms,
		isHttps: isHttpsUrl(report.url),
		ttfbMs: report.responseTimeMs ?? 0,
		isRobotsAllowed: robotsAllowed,
		h1Count: m?.h1Count ?? 0,
		h1Sample: m?.h1Texts?.[0] ?? '',
		altMissingCount: m?.imagesMissingAlt ?? 0,
		altTotalCount: m?.imagesTotal ?? 0,
		jsonLdBlocksCount: m?.jsonLdBlockCount ?? 0,
		headingSkips: m?.headingSkipExamples ?? [],
		renderBlockingCount: m?.renderBlockingScripts ?? 0,
	};
}

export function buildLiveCriteriaReportProps(
	report: AuditReport,
	lang: 'ko' | 'en' = 'ko',
	overrides?: Partial<Pick<LiveCriteriaReportProps, 'clientName' | 'categoryName' | 'region' | 'mainSpecialty'>>,
): LiveCriteriaReportProps {
	const meta = report.siteMeta;
	const mapping: SchemaMappingInput = {
		industry: meta?.category,
		category: meta?.category,
		siteTitle: report.metrics?.documentTitle || meta?.title,
		brandName: meta?.brandName,
		domain: meta?.domain,
		primaryKeyword: meta?.primaryKeyword,
		industryType: meta?.industryType,
		schemaTypes: report.metrics?.schemaTypes,
	};
	const clientName = overrides?.clientName?.trim() || meta?.brandName || '';
	const categoryName = overrides?.categoryName?.trim() || meta?.category || '';
	const region = overrides?.region?.trim() || meta?.location || meta?.broadLocation || '';
	const mainSpecialty =
		overrides?.mainSpecialty?.trim() ||
		meta?.coreSpecialties?.[0] ||
		meta?.primaryKeyword ||
		categoryName;

	return {
		clientName,
		categoryName,
		region,
		mainSpecialty,
		recommendedSchemas: alignRecommendedSchemas([], mapping),
		evidence: buildTechnicalEvidenceData(report, lang),
	};
}

export function schemaMappingFromReport(report: AuditReport | null | undefined): SchemaMappingInput {
	const meta = report?.siteMeta;
	return {
		industry: meta?.category,
		category: meta?.category,
		siteTitle: report?.metrics?.documentTitle || meta?.title,
		brandName: meta?.brandName,
		domain: meta?.domain,
		primaryKeyword: meta?.primaryKeyword,
		industryType: meta?.industryType,
		schemaTypes: report?.metrics?.schemaTypes,
	};
}

export function reportSchemaVertical(report: AuditReport | null | undefined) {
	return detectSchemaVertical(schemaMappingFromReport(report));
}
