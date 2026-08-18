/**
 * Client-safe logo URL helpers — no Node built-ins (dns / fs / net).
 * History cards and other client components must import from here,
 * not from `extract-site-logo` or `resolve-site-logo`.
 */

export interface ReportLogoSource {
	logoUrl?: string;
	siteMeta?: { logoUrl?: string; ogImage?: string };
}

export function hostnameFromUrl(raw: string): string {
	const value = (raw || '').trim();
	if (!value) return '';
	try {
		const host = new URL(value.includes('://') ? value : `https://${value}`).hostname;
		return host.replace(/^www\./i, '').toLowerCase();
	} catch {
		return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]?.toLowerCase() || '';
	}
}

export function originFromUrl(raw: string): string {
	try {
		return new URL(raw).origin;
	} catch {
		return '';
	}
}

export function googleFaviconV2Url(baseUrl: string): string {
	const target = originFromUrl(baseUrl) || baseUrl;
	if (!target) return '';
	return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAV&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(target)}&size=128`;
}

export function clearbitLogoUrl(domain: string): string {
	const host = hostnameFromUrl(domain);
	return host ? `https://logo.clearbit.com/${host}` : '';
}

/** History / prescription fallback: stored logo → siteMeta.logoUrl → og:image. */
export function resolveReportLogoUrl(report?: ReportLogoSource | null): string | undefined {
	const raw = report?.logoUrl || report?.siteMeta?.logoUrl || report?.siteMeta?.ogImage;
	return raw?.trim() || undefined;
}
