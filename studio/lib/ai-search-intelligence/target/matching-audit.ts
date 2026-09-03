/**
 * Bind a saved SEO/GEO diagnosis to Intelligence only when it is the same site.
 * The latest audit in localStorage must never leak industry / services / competitors
 * into a different analysis URL.
 */
import { loadLatestAuditPayload, type LatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import { asiSitesMatch } from '@/lib/ai-search-intelligence/normalize-site-url';
import type { SiteMetadata } from '@/lib/audit/site-metadata';

export function matchingAuditForUrl(
	audit: LatestAuditPayload | null | undefined,
	url: string,
): LatestAuditPayload | null {
	if (!audit?.report?.url || !url) return null;
	return asiSitesMatch(audit.report.url, url) ? audit : null;
}

export function matchingSiteMeta(
	audit: LatestAuditPayload | null | undefined,
	url: string,
): SiteMetadata | undefined {
	return matchingAuditForUrl(audit, url)?.report.siteMeta;
}

/** Client-only. Returns the latest audit only when it belongs to `url`. */
export function loadMatchingAuditPayload(url: string): LatestAuditPayload | null {
	return matchingAuditForUrl(loadLatestAuditPayload(), url);
}
