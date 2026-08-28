/** Public search-strategy entry. Writes `auditId` + `url`; still reads legacy `id`. */

export function normalizeStrategySiteUrl(raw: string | null | undefined): string {
	const value = (raw || '').trim();
	if (!value) return '';
	try {
		const parsed = new URL(value.includes('://') ? value : `https://${value}`);
		const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
		const path = parsed.pathname.replace(/\/+$/, '') || '';
		return `${host}${path}`;
	} catch {
		return value.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').toLowerCase();
	}
}

export function sameStrategySite(left: string | null | undefined, right: string | null | undefined): boolean {
	const a = normalizeStrategySiteUrl(left);
	const b = normalizeStrategySiteUrl(right);
	return Boolean(a) && a === b;
}

export function readStrategyStudioParams(searchParams: { get(name: string): string | null }): {
	auditId: string;
	url: string;
	keyword: string;
} {
	return {
		auditId: searchParams.get('auditId')?.trim() || searchParams.get('id')?.trim() || '',
		url: searchParams.get('url')?.trim() || '',
		keyword: searchParams.get('keyword')?.trim() || '',
	};
}

export function buildStrategyStudioHref(
	auditId?: string | null,
	keyword?: string | null,
	url?: string | null,
): string {
	const params = new URLSearchParams();
	const id = (auditId || '').trim();
	const q = (keyword || '').trim();
	const site = (url || '').trim();
	if (id) params.set('auditId', id);
	if (site) params.set('url', site);
	if (q) params.set('keyword', q);
	const query = params.toString();
	return query ? `/strategy?${query}` : '/strategy';
}
