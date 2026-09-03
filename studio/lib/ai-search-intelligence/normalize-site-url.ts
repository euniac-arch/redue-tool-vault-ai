/** Client-side URL normalize for War Room input. Server crawl still uses SSRF guards. */
export function normalizeAsiSiteUrl(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
	try {
		const url = new URL(withProto);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
		const host = url.hostname.replace(/^www\./i, '').toLowerCase();
		if (!host.includes('.') || host.startsWith('.')) return null;
		const path = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');
		return `${url.protocol}//${host}${path}`;
	} catch {
		return null;
	}
}

export function brandNameFromUrl(url: string): string {
	try {
		const host = new URL(url).hostname.replace(/^www\./i, '');
		const head = host.split('.')[0] || host;
		return head.charAt(0).toUpperCase() + head.slice(1);
	} catch {
		return url;
	}
}

export function domainFromUrl(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./i, '');
	} catch {
		return url;
	}
}

/** Host + path identity. http/https and www. differences must not split one site. */
export function asiSitesMatch(left?: string | null, right?: string | null): boolean {
	const a = normalizeAsiSiteUrl(left || '');
	const b = normalizeAsiSiteUrl(right || '');
	if (!a || !b) return false;
	try {
		const urlA = new URL(a);
		const urlB = new URL(b);
		return urlA.hostname === urlB.hostname && urlA.pathname === urlB.pathname;
	} catch {
		return a === b;
	}
}
