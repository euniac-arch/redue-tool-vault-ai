/**
 * Shared Target Context for Competitor Intelligence.
 * Reuses Project / Site / Audit / Intelligence fields — no parallel site model.
 * The resolver never special-cases a domain, brand, location, or vertical.
 */
import { brandAliases } from '@/lib/ai-search-intelligence/competitors/normalize';
import { resolveAsiMockSite } from '@/lib/ai-search-intelligence/mock/resolve-site';
import { matchingAuditForUrl, matchingSiteMeta } from '@/lib/ai-search-intelligence/target/matching-audit';
import {
	composeIntelligenceIndustry,
	composeIntelligenceLocation,
	composeIntelligenceServices,
	extractIntelligenceKeywords,
	inferIntelligenceTarget,
	intelligenceCorpus,
} from '@/lib/ai-search-intelligence/target/site-intelligence-derive';
import type { AsiQuestionInput, AsiWarRoomSite } from '@/lib/ai-search-intelligence/types';
import type { LatestAuditPayload } from '@/lib/audit/latest-audit-payload';

export type AsiTargetContext = {
	siteUrl: string;
	brandName: string;
	domain: string;
	location?: string;
	category?: string;
	industry?: string;
	services: string[];
	targetAudience?: string;
	keywords: string[];
	aliases: string[];
	projectId?: string | null;
	siteId?: string | null;
	auditId?: string | null;
	intelligenceRunId?: string | null;
	boundFromAudit: boolean;
};

export type AsiTargetInput = {
	url: string;
	audit?: LatestAuditPayload | null;
	questions?: Partial<AsiQuestionInput>;
	projectId?: string | null;
	services?: readonly string[];
};

function uniqueTrimmed(values: readonly (string | undefined | null)[], limit = 6): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const value = (raw || '').trim();
		if (!value) continue;
		const key = value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(value);
		if (out.length >= limit) break;
	}
	return out;
}

export function toAsiWarRoomSite(context: AsiTargetContext): AsiWarRoomSite {
	return {
		url: context.siteUrl,
		brandName: context.brandName,
		domain: context.domain,
		location: context.location,
		category: context.category,
	};
}

export function targetContextFromSite(
	site: AsiWarRoomSite,
	extras?: {
	services?: readonly string[];
	keywords?: readonly string[];
	questions?: Partial<AsiQuestionInput>;
	auditId?: string | null;
	projectId?: string | null;
	boundFromAudit?: boolean;
	},
): AsiTargetContext {
	const location = extras?.questions?.location?.trim() || site.location;
	const industry = extras?.questions?.industry?.trim() || site.category;
	const category = industry || extras?.questions?.service?.trim() || site.category;
	const audience = extras?.questions?.target?.trim();
	const services = uniqueTrimmed([
		extras?.questions?.service,
		...(extras?.services ?? []),
		category,
	]);
	const corpus = [site.brandName, site.domain, location, category, industry, ...services].join(' ');
	return {
		siteUrl: site.url,
		brandName: site.brandName,
		domain: site.domain,
		location: location || undefined,
		category: category || undefined,
		industry: industry || undefined,
		services,
		targetAudience: audience || undefined,
		keywords: uniqueTrimmed([...(extras?.keywords ?? []), ...extractIntelligenceKeywords(corpus, services)]),
		aliases: brandAliases(site.brandName, site.domain),
		projectId: extras?.projectId ?? null,
		siteId: site.domain,
		auditId: extras?.auditId ?? null,
		intelligenceRunId: null,
		boundFromAudit: extras?.boundFromAudit ?? false,
	};
}

export function servicesFromAudit(
	input: Pick<AsiTargetInput, 'url' | 'audit' | 'questions' | 'services'>,
	fallback?: string,
): string[] {
	const meta = matchingSiteMeta(input.audit, input.url);
	const brand = meta?.brandName || '';
	const corpus = intelligenceCorpus(meta, brand, '');
	return composeIntelligenceServices({
		corpus,
		meta,
		industry: fallback,
		overrides: [input.questions?.service, ...(input.services ?? []), fallback],
	}).slice(0, 3);
}

export function auditCompetitorNames(
	audit?: LatestAuditPayload | null,
	limit = 8,
	siteUrl?: string,
): string[] {
	if (siteUrl && !matchingAuditForUrl(audit, siteUrl)) return [];
	return uniqueTrimmed(audit?.report.realCompetitors?.names ?? [], limit);
}

/**
 * Common adapter every Intelligence sub-tool must read.
 * Industry / region / services / target come from the matching diagnosis only.
 */
export function getSiteIntelligenceContext(siteData: AsiTargetInput): AsiTargetContext | null {
	const resolved = resolveAsiMockSite(siteData);
	if (!resolved) return null;
	const { site, boundFromAudit } = resolved;
	const matched = matchingAuditForUrl(siteData.audit, siteData.url);
	const meta = boundFromAudit ? matched?.report.siteMeta ?? siteData.audit?.report.siteMeta : undefined;
	const corpus = intelligenceCorpus(meta, site.brandName, site.domain);
	const location =
		siteData.questions?.location?.trim() ||
		site.location ||
		composeIntelligenceLocation(meta, boundFromAudit) ||
		undefined;
	const industry =
		siteData.questions?.industry?.trim() ||
		composeIntelligenceIndustry(corpus, meta, site.brandName) ||
		site.category ||
		undefined;
	const category =
		industry ||
		siteData.questions?.service?.trim() ||
		meta?.primaryKeyword ||
		site.category ||
		undefined;
	const services = composeIntelligenceServices({
		corpus,
		meta,
		industry,
		overrides: [siteData.questions?.service, ...(siteData.services ?? [])],
	});
	const keywords = extractIntelligenceKeywords(corpus, [
		...services,
		industry,
		category,
		meta?.primaryKeyword,
		meta?.businessEntity,
	]);
	const audience =
		siteData.questions?.target?.trim() || (boundFromAudit ? inferIntelligenceTarget(corpus) : undefined);
	return {
		siteUrl: site.url,
		brandName: site.brandName,
		domain: site.domain,
		location: location || undefined,
		category: category || undefined,
		industry: industry || undefined,
		services,
		targetAudience: audience || undefined,
		keywords,
		aliases: brandAliases(site.brandName, site.domain),
		projectId: siteData.projectId ?? null,
		siteId: site.domain,
		auditId: matched?.auditId ?? (boundFromAudit ? siteData.audit?.auditId ?? null : null),
		intelligenceRunId: null,
		boundFromAudit,
	};
}

export function resolveAsiTargetContext(input: AsiTargetInput): AsiTargetContext | null {
	return getSiteIntelligenceContext(input);
}
