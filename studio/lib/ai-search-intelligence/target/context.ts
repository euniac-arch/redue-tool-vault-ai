/**
 * Shared Target Context for Competitor Intelligence.
 * Reuses Project / Site / Audit / Intelligence fields — no parallel site model.
 * The resolver never special-cases a domain, brand, location, or vertical.
 */
import { brandAliases } from '@/lib/ai-search-intelligence/competitors/normalize';
import { getAsiRequestContext } from '@/lib/ai-search-intelligence/guard/context';
import { resolveAsiMockSite } from '@/lib/ai-search-intelligence/mock/resolve-site';
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
	return {
		siteUrl: site.url,
		brandName: site.brandName,
		domain: site.domain,
		location: location || undefined,
		category: category || undefined,
		industry: industry || undefined,
		services,
		targetAudience: audience || undefined,
		aliases: brandAliases(site.brandName, site.domain),
		projectId: extras?.projectId ?? null,
		siteId: site.domain,
		auditId: extras?.auditId ?? null,
		intelligenceRunId: getAsiRequestContext()?.requestId ?? null,
		boundFromAudit: extras?.boundFromAudit ?? false,
	};
}

export function servicesFromAudit(
	input: Pick<AsiTargetInput, 'audit' | 'questions' | 'services'>,
	fallback?: string,
): string[] {
	const meta = input.audit?.report.siteMeta;
	return uniqueTrimmed(
		[
			input.questions?.service,
			...(input.services ?? []),
			...(meta?.coreSpecialties ?? []),
			...(meta?.serviceKeywords ?? []),
			meta?.primaryKeyword,
			meta?.category,
			fallback,
		],
		3,
	);
}

export function auditCompetitorNames(audit?: LatestAuditPayload | null, limit = 8): string[] {
	return uniqueTrimmed(audit?.report.realCompetitors?.names ?? [], limit);
}

export function resolveAsiTargetContext(input: AsiTargetInput): AsiTargetContext | null {
	const resolved = resolveAsiMockSite(input);
	if (!resolved) return null;
	const { site, boundFromAudit } = resolved;
	const meta = boundFromAudit ? input.audit?.report.siteMeta : undefined;
	const location = input.questions?.location?.trim() || site.location || meta?.broadLocation || undefined;
	const industry =
		input.questions?.industry?.trim() || meta?.category || site.category || undefined;
	const category =
		industry || input.questions?.service?.trim() || meta?.primaryKeyword || site.category || undefined;
	const audience = input.questions?.target?.trim() || undefined;
	return {
		siteUrl: site.url,
		brandName: site.brandName,
		domain: site.domain,
		location: location || undefined,
		category: category || undefined,
		industry: industry || undefined,
		services: servicesFromAudit(input, category || site.category),
		targetAudience: audience,
		aliases: brandAliases(site.brandName, site.domain),
		projectId: input.projectId ?? null,
		siteId: site.domain,
		auditId: input.audit?.auditId ?? null,
		intelligenceRunId: getAsiRequestContext()?.requestId ?? null,
		boundFromAudit,
	};
}
