import type { LatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import {
	brandNameFromUrl,
	domainFromUrl,
	normalizeAsiSiteUrl,
} from '@/lib/ai-search-intelligence/normalize-site-url';
import type { AsiMentionType, AsiWarRoomSite } from '@/lib/ai-search-intelligence/types';

export type AsiResolvedSite = {
	url: string;
	boundFromAudit: boolean;
	site: AsiWarRoomSite;
};

/** Shared host + audit bind. Mock builders must not copy this. */
export function resolveAsiMockSite(input: { url: string; audit?: LatestAuditPayload | null }): AsiResolvedSite | null {
	const url = normalizeAsiSiteUrl(input.url);
	if (!url) return null;
	const auditUrl = input.audit?.report.url ? normalizeAsiSiteUrl(input.audit.report.url) : null;
	const boundFromAudit = Boolean(auditUrl && auditUrl === url);
	const meta = input.audit?.report.siteMeta;
	const brandName =
		(boundFromAudit && (meta?.brandName || meta?.organizationName)) || brandNameFromUrl(url);
	const location = boundFromAudit ? meta?.location || meta?.broadLocation || undefined : undefined;
	const category = boundFromAudit ? meta?.category || meta?.primaryKeyword || undefined : undefined;
	return {
		url,
		boundFromAudit,
		site: {
			url,
			brandName,
			domain: domainFromUrl(url),
			location,
			category,
		},
	};
}

export function mentionFromScore(value: number): AsiMentionType {
	if (value >= 72) return 'recommended';
	if (value >= 48) return 'simple_mention';
	return 'none';
}
