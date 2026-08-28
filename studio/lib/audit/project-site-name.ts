/**
 * Canonical project / diagnosis display name.
 * Priority: crawled siteName (og:site_name, JSON-LD Organization) → title brand → hostname.
 */
import {
	cleanSiteName,
	extractOfficialBrandName,
	isDomainLikeSiteName,
	looksLikeKeywordBrand,
} from '@/lib/audit/brand-name';
import type { AuditReport } from '@/lib/site-auditor';

export { cleanSiteName, isDomainLikeSiteName };

export function hostnameFromTargetUrl(raw: string): string {
	try {
		return new URL(raw).hostname.replace(/^www\./i, '').toLowerCase() || raw;
	} catch {
		return raw
			.replace(/^https?:\/\//i, '')
			.replace(/^www\./i, '')
			.split('/')[0]
			.toLowerCase();
	}
}

function isUsableBrand(name: string, domain: string): boolean {
	const cleaned = cleanSiteName(name);
	if (!cleaned || cleaned.length < 2) return false;
	if (looksLikeKeywordBrand(cleaned)) return false;
	return !isDomainLikeSiteName(cleaned, domain);
}

type SiteNameSource = {
	url: string;
	siteMeta?: {
		domain?: string;
		brandName?: string;
		ogSiteName?: string;
		organizationName?: string;
		ogTitle?: string;
		title?: string;
	} | null;
	metrics?: {
		pageTitle?: string;
		documentTitle?: string;
	} | null;
};

/**
 * 1) og:site_name / JSON-LD Organization name / crawled brandName
 * 2) `<title>` / og:title brand head
 * 3) domain hostname (last resort)
 */
export function resolveProjectSiteName(report: SiteNameSource | AuditReport): string {
	const domain = (report.siteMeta?.domain || hostnameFromTargetUrl(report.url)).replace(/^www\./i, '');

	const crawled = [
		report.siteMeta?.ogSiteName,
		report.siteMeta?.organizationName,
		report.siteMeta?.brandName,
	];
	for (const raw of crawled) {
		const cleaned = cleanSiteName(raw);
		if (isUsableBrand(cleaned, domain)) return cleaned;
	}

	const titleParts = [
		report.siteMeta?.ogTitle,
		report.siteMeta?.title,
		report.metrics?.pageTitle,
		report.metrics?.documentTitle,
	];
	for (const raw of titleParts) {
		const cleaned = cleanSiteName(raw);
		if (isUsableBrand(cleaned, domain)) return cleaned;
	}

	const titleSource = titleParts
		.filter((part): part is string => Boolean(part && String(part).trim()))
		.join(' | ');
	const fromTitle = extractOfficialBrandName(titleSource, domain, report.siteMeta?.brandName);
	if (isUsableBrand(fromTitle, domain)) return cleanSiteName(fromTitle);

	return domain;
}

/** Prefer a Hangul/brand label over a domain string when merging rows. */
export function preferProjectName(
	primary?: string | null,
	secondary?: string | null,
	urlOrDomain?: string | null,
): string {
	const domain = hostnameFromTargetUrl(urlOrDomain || '');
	const left = cleanSiteName(primary);
	const right = cleanSiteName(secondary);
	if (left && !isDomainLikeSiteName(left, domain)) return left;
	if (right && !isDomainLikeSiteName(right, domain)) return right;
	return left || right || domain;
}

export function displayNameFromProjectFields(fields: {
	siteName?: string | null;
	name?: string | null;
	title?: string | null;
	projectName?: string | null;
	domain?: string | null;
	targetUrl?: string | null;
}): string {
	const domain = fields.domain || hostnameFromTargetUrl(fields.targetUrl || '');
	return preferProjectName(
		fields.siteName || fields.name || fields.projectName || fields.title,
		fields.title,
		domain,
	);
}
