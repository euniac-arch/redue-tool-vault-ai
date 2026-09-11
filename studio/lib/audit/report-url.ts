const FALLBACK_ORIGIN = 'https://reduegeo.com';

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

/**
 * "고객 납품용 읽기전용 링크" — 인터랙티브 대시보드(`/audit/result`)를 `?view=client`로
 * 열어, 확정(박제)된 회차 탭 + 4주 종합 Before/After만 읽기전용으로 노출한다.
 */
export function buildMilestoneClientShareUrl(reportId: string, origin?: string): string {
	const id = reportId.trim();
	if (!id) return origin || getAppOrigin();
	const base = (origin || getAppOrigin()).replace(/\/$/, '');
	return `${base}/audit/result?id=${encodeURIComponent(id)}&view=client`;
}
