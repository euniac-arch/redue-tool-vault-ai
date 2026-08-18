/**
 * Owner-facing 3-card business impact model.
 * Maps live audit evidence (JSON-LD / Organization / alt) onto
 * registry-driven audience / action nouns — no hardcoded vertical leftovers.
 */

import { businessConversionFromAudit } from '@/lib/audit/business-conversion';
import { resolveTargetBrandName } from '@/lib/audit/target-entity';
import { buildGeoDiagnosticReportFromAudit } from '@/lib/geo/from-visibility';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { IndustryType } from '@/lib/audit/site-metadata';
import { withJosa } from '@/lib/korean-josa';
import {
	resolveIndustryConfig,
	type IndustryConfig,
} from '@/lib/registry/universalIndustryRegistry';
import type { AuditCheckStatus, AuditLang, AuditReport } from '@/lib/site-auditor';
import type { SeverityLevel } from '@/types/quick-hook-report';

export type ImpactCardId = 'patientLeak' | 'trustUndervalued' | 'conversionDrop';
export type ImpactSeverity = 'critical' | 'major' | 'minor';
export type ImpactTone = 'critical' | 'partial' | 'healthy';
/** @deprecated Use `industryConfig.audienceName` — kept for existing i18n fallbacks. */
export type ImpactVoice = 'medical' | 'general';

export interface BusinessImpactContext {
	brandName: string;
	region: string;
	targetKeyword: string;
	category: string;
	industryType: IndustryType;
	voice: ImpactVoice;
	industryConfig: IndustryConfig;
}

export interface BusinessImpactCardModel {
	id: ImpactCardId;
	index: 1 | 2 | 3;
	severity: ImpactSeverity;
	tone: ImpactTone;
	/** Related checklist ids used to bind evidence. */
	checkIds: readonly string[];
	vars: BusinessImpactCardVars;
}

export interface BusinessImpactCardVars {
	brand: string;
	region: string;
	targetKeyword: string;
	category: string;
	jsonLdCount: number;
	orgMissing: string;
	altMissing: number;
	altTotal: number;
	/** `12/14` or a no-image fallback — never a leftover `{keyword}` tag. */
	altLabel: string;
	audienceName: string;
	/** `audienceName` + 이/가 (e.g. 의뢰인 → 의뢰인이) */
	audienceNameJosa: string;
	actionName: string;
	representativeTitle: string;
	representativeTitleJosa: string;
}

export interface BusinessImpactCardsModel {
	context: BusinessImpactContext;
	cards: BusinessImpactCardModel[];
}

/** Optional explicit overrides — hospital / region / keyword from the client brief. */
export interface BusinessImpactOverrides {
	brandName?: string | null;
	region?: string | null;
	targetKeyword?: string | null;
	category?: string | null;
}

const CARD_DEFS: readonly {
	id: ImpactCardId;
	index: 1 | 2 | 3;
	defaultSeverity: ImpactSeverity;
	checkIds: readonly string[];
}[] = [
	{
		id: 'patientLeak',
		index: 1,
		defaultSeverity: 'critical',
		checkIds: ['jsonld-present', 'faq-howto-schema', 'ai-bots-allowed', 'crawlable-text'],
	},
	{
		id: 'trustUndervalued',
		index: 2,
		defaultSeverity: 'major',
		checkIds: ['organization', 'person-eeat', 'eeat-author', 'article-fields', 'website-schema'],
	},
	{
		id: 'conversionDrop',
		index: 3,
		defaultSeverity: 'minor',
		checkIds: ['image-alt', 'html-lang', 'heading-structure', 'page-weight', 'render-blocking'],
	},
];

const ORG_REQUIRED = ['logo', 'url', 'sameAs'] as const;

function cleanPhrase(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

function voiceFromIndustry(industryType: IndustryType): ImpactVoice {
	return industryType === 'MEDICAL' ? 'medical' : 'general';
}

function resolveImpactIndustryConfig(
	report: AuditReport,
	lang: AuditLang,
	ctx: { brandName: string; region: string; targetKeyword: string; category: string },
): IndustryConfig {
	const meta = report.siteMeta;
	return resolveIndustryConfig({
		lang,
		brandName: ctx.brandName,
		location: ctx.region,
		primaryKeyword: ctx.targetKeyword,
		services: [
			...(meta?.coreSpecialties ?? []),
			ctx.targetKeyword,
			ctx.category,
			meta?.primaryKeyword,
			meta?.category,
		],
		domain: meta?.domain,
		url: report.url,
		legacyIndustry: meta?.industryType,
		title: meta?.title,
		description: meta?.metaDescription || meta?.ogDescription,
		keywords: [meta?.metaKeywords, meta?.primaryKeyword, meta?.category, ...(meta?.detectedKeywords ?? [])]
			.filter(Boolean)
			.join(' '),
		extraText: [...(meta?.schemaEntityTypes ?? []), ...(meta?.navMenuTexts ?? [])].join(' '),
	});
}

function formatMissingFields(fields: readonly string[] | null | undefined, lang: AuditLang): string {
	const cleaned = (fields || []).map(cleanPhrase).filter(Boolean);
	if (cleaned.length) return cleaned.join(lang === 'en' ? ', ' : ', ');
	return ORG_REQUIRED.join(lang === 'en' ? ', ' : ', ');
}

export function resolveCheckStatus(report: AuditReport, checkId: string): AuditCheckStatus | null {
	const fromChecklist = report.checklist?.find((item) => item.id === checkId);
	if (fromChecklist) return fromChecklist.status ?? (fromChecklist.passed ? 'pass' : 'fail');

	const fromCategories = report.categories?.flatMap((category) => category.checks).find((item) => item.id === checkId);
	if (fromCategories) return fromCategories.status ?? (fromCategories.passed ? 'pass' : 'fail');

	const finding = report.findings?.find((item) => item.checkId === checkId);
	if (finding) return finding.severity === 'critical' ? 'fail' : 'warning';
	return null;
}

function clusterState(
	statuses: readonly (AuditCheckStatus | null)[],
	defaultSeverity: ImpactSeverity,
): { severity: ImpactSeverity; tone: ImpactTone } {
	const known = statuses.filter((status): status is AuditCheckStatus => Boolean(status));
	if (known.some((status) => status === 'fail')) {
		return { severity: defaultSeverity, tone: 'critical' };
	}
	if (known.some((status) => status === 'warning')) {
		const severity: ImpactSeverity = defaultSeverity === 'critical' ? 'major' : defaultSeverity;
		return { severity, tone: 'partial' };
	}
	if (known.length > 0 && known.every((status) => status === 'pass')) {
		return { severity: 'minor', tone: 'healthy' };
	}
	return { severity: defaultSeverity, tone: 'critical' };
}

/** Map cluster severity + tone onto the executive strip's 4-level scale. */
export function toSeverityLevel(severity: ImpactSeverity, tone: ImpactTone): SeverityLevel {
	if (tone === 'healthy') return 'info';
	if (severity === 'critical') return 'critical';
	if (severity === 'major') return 'major';
	return 'warning';
}

/** Split measured-evidence copy into compact cause chips. */
export function splitEvidenceTags(evidence: string): string[] {
	return evidence
		.replace(/^(실측 근거|Measured)\s*[:：]\s*/i, '')
		.split(/\s*[·•|]\s*/)
		.map((part) => part.trim())
		.filter(Boolean)
		.slice(0, 4);
}

export function buildBusinessImpactCards(
	report: AuditReport,
	reportData?: GeoNarrativeReport | null,
	lang: AuditLang = 'ko',
	overrides?: BusinessImpactOverrides | null,
): BusinessImpactCardsModel {
	const geo = buildGeoDiagnosticReportFromAudit(report, lang, reportData);
	const conversion = businessConversionFromAudit(report, geo, lang);
	const meta = report.siteMeta;

	const brandName =
		cleanPhrase(overrides?.brandName) ||
		resolveTargetBrandName(report, reportData) ||
		conversion.brandName;
	const region =
		cleanPhrase(overrides?.region) ||
		conversion.location ||
		cleanPhrase(meta?.broadLocation) ||
		(lang === 'en' ? 'your' : '해당');
	const industryConfig = resolveImpactIndustryConfig(report, lang, {
		brandName,
		region,
		targetKeyword:
			cleanPhrase(overrides?.targetKeyword) ||
			conversion.primaryKeyword ||
			conversion.targetKeywords[0] ||
			'',
		category: cleanPhrase(overrides?.category) || conversion.category || cleanPhrase(reportData?.industry) || '',
	});
	const category =
		cleanPhrase(overrides?.category) ||
		conversion.category ||
		cleanPhrase(reportData?.industry) ||
		industryConfig.defaultCategory;
	const targetKeyword =
		cleanPhrase(overrides?.targetKeyword) ||
		conversion.primaryKeyword ||
		conversion.targetKeywords[0] ||
		industryConfig.services[0] ||
		category;
	const industryType = conversion.industryType || meta?.industryType || 'GENERAL';
	const voice = voiceFromIndustry(industryType);

	const jsonLdCount = report.metrics?.jsonLdBlockCount ?? 0;
	const orgMissing = formatMissingFields(report.metrics?.organizationMissing, lang);
	const altMissing = report.metrics?.imagesMissingAlt ?? 0;
	const altTotal = report.metrics?.imagesTotal ?? 0;
	const altLabel =
		altTotal > 0
			? `${altMissing}/${altTotal}`
			: lang === 'en'
				? 'no images detected'
				: '이미지 미검출';

	const vars: BusinessImpactCardVars = {
		brand: brandName,
		region,
		targetKeyword,
		category,
		jsonLdCount,
		orgMissing,
		altMissing,
		altTotal,
		altLabel,
		audienceName: industryConfig.audienceName,
		audienceNameJosa: lang === 'en' ? industryConfig.audienceName : withJosa(industryConfig.audienceName, '이/가'),
		actionName: industryConfig.actionName,
		representativeTitle: industryConfig.representativeTitle,
		representativeTitleJosa:
			lang === 'en' ? industryConfig.representativeTitle : withJosa(industryConfig.representativeTitle, '을/를'),
	};

	const cards = CARD_DEFS.map((def) => {
		const { severity, tone } = clusterState(
			def.checkIds.map((id) => resolveCheckStatus(report, id)),
			def.defaultSeverity,
		);
		return {
			id: def.id,
			index: def.index,
			severity,
			tone,
			checkIds: def.checkIds,
			vars,
		};
	});

	return {
		context: {
			brandName,
			region,
			targetKeyword,
			category,
			industryType,
			voice,
			industryConfig,
		},
		cards,
	};
}
