const FALLBACK_ORIGIN = 'https://redue-tool-vault-ai.vercel.app';

export function siteLabelFromUrl(raw: string): string {
	try {
		return new URL(raw).hostname.replace(/^www\./, '') || raw;
	} catch {
		return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || raw;
	}
}

export function getAppOrigin(): string {
	if (typeof window !== 'undefined' && window.location?.origin) {
		return window.location.origin;
	}
	return (
		process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
		process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
		FALLBACK_ORIGIN
	);
}

export function buildPublicReportPath(reportId: string): string {
	return `/report/${encodeURIComponent(reportId.trim())}`;
}

export function buildPublicReportUrl(reportId: string, origin?: string): string {
	const id = reportId.trim();
	if (!id) return origin || getAppOrigin();
	return `${(origin || getAppOrigin()).replace(/\/$/, '')}${buildPublicReportPath(id)}`;
}
