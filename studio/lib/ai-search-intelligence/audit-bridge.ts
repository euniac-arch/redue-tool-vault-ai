/**
 * Read-only bridge from an existing SEO/GEO audit into AI Intelligence.
 * Does not mutate AuditReport or recalculate diagnostic scores.
 */
import type { LatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import { asiSitesMatch } from '@/lib/ai-search-intelligence/normalize-site-url';
import type {
	AsiAuditBind,
	AsiAuditSignalId,
	AsiSignalLink,
	AsiSignalLinkId,
} from '@/lib/ai-search-intelligence/types';
import type { AuditCheckItem, AuditReport } from '@/lib/site-auditor';

/** ASI-only deductions. Never written back onto `report.score`. */
export const ASI_AUDIT_INFLUENCE = {
	schemaToTrust: 8,
	localToLocal: 10,
	faqToRecommendation: 9,
	entityToPerception: 8,
	citationToExplorer: 12,
	aeoToReadiness: 7,
} as const;

export type AsiAuditInfluence = {
	trust: number;
	local: number;
	recommendation: number;
	perception: number;
	citation: number;
	readiness: number;
};

const ZERO_INFLUENCE: AsiAuditInfluence = {
	trust: 0,
	local: 0,
	recommendation: 0,
	perception: 0,
	citation: 0,
	readiness: 0,
};

export const ASI_AUDIT_SIGNAL_IDS: readonly AsiAuditSignalId[] = [
	'schema',
	'entity',
	'local',
	'content',
	'faq',
	'citation',
	'technical',
];

export type AsiAuditSignals = Record<AsiAuditSignalId, boolean>;

export type AsiAuditBridge = {
	seoScore: number;
	seoMaxScore: number;
	influence: AsiAuditInfluence;
	links: AsiSignalLink[];
	signals: AsiAuditSignals;
};

function flattenChecks(report: AuditReport): AuditCheckItem[] {
	if (report.checklist?.length) return report.checklist;
	return report.categories?.flatMap((category) => category.checks ?? []) ?? [];
}

function checkFailed(checks: AuditCheckItem[], id: string): boolean | null {
	const item = checks.find((row) => row.id === id);
	if (!item) return null;
	if (item.status === 'fail') return true;
	if (item.status === 'pass') return false;
	if (item.status === 'warning') return false;
	return !item.passed;
}

function schemaGap(report: AuditReport, checks: AuditCheckItem[]): boolean {
	if (checkFailed(checks, 'jsonld-present') === true) return true;
	if (typeof report.schemaCoverage === 'number' && report.schemaCoverage < 45) return true;
	const schemaCat = report.categories?.find((category) => category.id === 'schema');
	if (schemaCat && schemaCat.maxScore > 0 && schemaCat.score / schemaCat.maxScore < 0.45) return true;
	return false;
}

function localBusinessGap(report: AuditReport, checks: AuditCheckItem[]): boolean {
	if (checkFailed(checks, 'organization') === true) return true;
	const meta = report.siteMeta;
	const hasNap = Boolean(meta?.telephone || meta?.address);
	if (meta && !hasNap && !meta.location) return true;
	return false;
}

function faqGap(report: AuditReport, checks: AuditCheckItem[]): boolean {
	if (checkFailed(checks, 'faq-howto-schema') === true) return true;
	const faqs = report.siteMeta?.faqItems;
	if (Array.isArray(faqs) && faqs.length === 0) return true;
	return false;
}

function entityGap(report: AuditReport): boolean {
	if ((report.metrics?.organizationMissing?.length ?? 0) > 0) return true;
	if ((report.metrics?.personMissing?.length ?? 0) > 0) return true;
	const brand = (report.siteMeta?.brandName || report.siteMeta?.organizationName || '').trim().toLowerCase();
	const names = (report.siteMeta?.schemaOrganizationNames ?? [])
		.map((name) => name.trim().toLowerCase())
		.filter(Boolean);
	if (brand && names.length && !names.some((name) => name.includes(brand) || brand.includes(name))) {
		return true;
	}
	return false;
}

function citationGap(report: AuditReport): boolean {
	if (typeof report.geoCitationScore === 'number' && report.geoCitationScore < 45) return true;
	const sameAs = report.siteMeta?.sameAs ?? [];
	if (typeof report.geoCitationScore !== 'number' && sameAs.length === 0) return true;
	return false;
}

function aeoGap(report: AuditReport, checks: AuditCheckItem[]): boolean {
	if (checkFailed(checks, 'llms-txt') === true) return true;
	if (checkFailed(checks, 'ai-bots-allowed') === true) return true;
	if (report.metrics && report.metrics.hasLlmsTxt === false) return true;
	return false;
}

function categoryWeak(report: AuditReport, id: string, threshold = 0.45): boolean {
	const category = report.categories?.find((row) => row.id === id);
	if (!category || category.maxScore <= 0) return false;
	return category.score / category.maxScore < threshold;
}

function contentGap(report: AuditReport, checks: AuditCheckItem[]): boolean {
	if (checkFailed(checks, 'heading-hierarchy') === true) return true;
	if (checkFailed(checks, 'heading_hierarchy') === true) return true;
	if (checkFailed(checks, 'heading_structure_exist') === true) return true;
	if (checkFailed(checks, 'h1_single') === true) return true;
	return categoryWeak(report, 'seo');
}

function technicalGap(report: AuditReport, checks: AuditCheckItem[]): boolean {
	if (checkFailed(checks, 'https-ssl') === true) return true;
	if (checkFailed(checks, 'https') === true) return true;
	return categoryWeak(report, 'performance') || categoryWeak(report, 'security');
}

function link(id: AsiSignalLinkId, family: AsiSignalLink['family'], href: string, gap: boolean): AsiSignalLink {
	return { id, family, href, gap };
}

export function applyAsiInfluence(base: number, penalty: number): number {
	if (!penalty) return base;
	return Math.max(4, Math.min(100, Math.round(base - penalty)));
}

export function toAsiAuditBind(bridge: AsiAuditBridge | null): AsiAuditBind | null {
	if (!bridge) return null;
	return {
		seoScore: bridge.seoScore,
		seoMaxScore: bridge.seoMaxScore,
		signalLinks: bridge.links,
	};
}

/**
 * Returns a bridge only when the Intelligence URL matches the saved audit URL.
 * SEO score is copied for display — never used as an ASI KPI.
 */
export function extractAsiAuditBridge(
	audit: LatestAuditPayload | null | undefined,
	siteUrl: string,
): AsiAuditBridge | null {
	if (!audit?.report?.url) return null;
	if (!asiSitesMatch(audit.report.url, siteUrl)) return null;

	const report = audit.report;
	const checks = flattenChecks(report);
	const gaps = {
		schema: schemaGap(report, checks),
		local: localBusinessGap(report, checks),
		faq: faqGap(report, checks),
		entity: entityGap(report),
		citation: citationGap(report),
		aeo: aeoGap(report, checks),
		content: contentGap(report, checks),
		technical: technicalGap(report, checks),
	};

	const influence: AsiAuditInfluence = {
		trust: gaps.schema ? ASI_AUDIT_INFLUENCE.schemaToTrust : 0,
		local: gaps.local ? ASI_AUDIT_INFLUENCE.localToLocal : 0,
		recommendation: gaps.faq ? ASI_AUDIT_INFLUENCE.faqToRecommendation : 0,
		perception: gaps.entity ? ASI_AUDIT_INFLUENCE.entityToPerception : 0,
		citation: gaps.citation ? ASI_AUDIT_INFLUENCE.citationToExplorer : 0,
		readiness: gaps.aeo ? ASI_AUDIT_INFLUENCE.aeoToReadiness : 0,
	};

	const signals: AsiAuditSignals = {
		schema: gaps.schema,
		entity: gaps.entity,
		local: gaps.local,
		content: gaps.content,
		faq: gaps.faq,
		citation: gaps.citation,
		technical: gaps.technical,
	};

	const links: AsiSignalLink[] = [
		link('schema_to_reputation', 'schema', '/intelligence/reputation-radar', gaps.schema),
		link('localbusiness_to_local', 'local', '/intelligence/brand-perception', gaps.local),
		link('faq_to_recommendation', 'faq', '/intelligence/recommendation-simulator', gaps.faq),
		link('entity_to_perception', 'entity', '/intelligence/brand-perception', gaps.entity),
		link('citation_to_explorer', 'citation', '/intelligence/citation-explorer', gaps.citation),
		link('aeo_to_readiness', 'aeo', '/intelligence/agent-readiness', gaps.aeo),
	];

	const seoScore = Number.isFinite(audit.score)
		? Math.round(Number(audit.score) * 10) / 10
		: Number.isFinite(report.score)
			? Math.round(Number(report.score) * 10) / 10
			: 0;

	return {
		seoScore,
		seoMaxScore: audit.maxScore || report.maxScore || 100,
		influence,
		links,
		signals,
	};
}

export function emptyAsiInfluence(): AsiAuditInfluence {
	return { ...ZERO_INFLUENCE };
}
