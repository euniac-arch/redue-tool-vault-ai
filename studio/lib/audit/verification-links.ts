/**
 * Official external SEO / schema verification tool URLs,
 * bound to the currently diagnosed project domain.
 */

export type VerificationToolId =
	| 'pagespeed'
	| 'schemaValidator'
	| 'richResults'
	| 'seoptimer';

export interface VerificationToolLink {
	id: VerificationToolId;
	href: string;
	/** Short badge label (tool name) */
	labelKey: VerificationToolId;
}

function normalizeProjectUrl(raw: string): string | null {
	const trimmed = raw?.trim();
	if (!trimmed) return null;
	try {
		const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
		const url = new URL(withProtocol);
		if (!url.hostname) return null;
		return url.toString();
	} catch {
		return null;
	}
}

export function hostnameFromProjectUrl(raw: string): string | null {
	const normalized = normalizeProjectUrl(raw);
	if (!normalized) return null;
	try {
		return new URL(normalized).hostname.replace(/^www\./, '');
	} catch {
		return null;
	}
}

/** Build dynamic quick-link hrefs for PageSpeed, Schema.org, Rich Results, SEOptimer. */
export function buildExternalVerificationLinks(projectUrl: string): VerificationToolLink[] {
	const normalized = normalizeProjectUrl(projectUrl);
	if (!normalized) return [];

	const encoded = encodeURIComponent(normalized);
	const host = hostnameFromProjectUrl(normalized);
	if (!host) return [];

	return [
		{
			id: 'pagespeed',
			href: `https://pagespeed.web.dev/analysis?url=${encoded}`,
			labelKey: 'pagespeed',
		},
		{
			id: 'schemaValidator',
			href: `https://validator.schema.org/#url=${encoded}`,
			labelKey: 'schemaValidator',
		},
		{
			id: 'richResults',
			href: `https://search.google.com/test/rich-results?url=${encoded}`,
			labelKey: 'richResults',
		},
		{
			id: 'seoptimer',
			href: `https://www.seoptimer.com/${host}`,
			labelKey: 'seoptimer',
		},
	];
}
